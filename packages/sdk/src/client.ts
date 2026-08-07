import type { MeResponse, TokenPair } from "@bop/shared-types";

import { ApiRequestError, type ApiEnvelope } from "./envelope";

/**
 * Where tokens live is the caller's problem — Expo uses `expo-secure-store`,
 * a future non-Expo client might use something else. The client only ever
 * talks to this interface.
 */
export interface TokenStorage {
  getAccessToken(): Promise<string | null>;
  getRefreshToken(): Promise<string | null>;
  setTokens(tokens: TokenPair): Promise<void>;
  clearTokens(): Promise<void>;
}

export interface ApiClientOptions {
  baseUrl: string;
  storage: TokenStorage;
}

export interface ApiClient {
  login(email: string, password: string, rememberMe?: boolean): Promise<TokenPair>;
  logout(): Promise<void>;
  me(): Promise<MeResponse>;
  /** Authenticated request. Retries once after a silent refresh on 401. */
  request<T>(path: string, init?: RequestInit): Promise<T>;
  /**
   * Same auth + refresh-retry as `request`, but returns the raw `Response`
   * instead of unwrapping an envelope — for endpoints that don't return
   * `{success, data}` JSON (binary file downloads: register .xlsx exports).
   */
  requestRaw(path: string, init?: RequestInit): Promise<Response>;
}

async function parseEnvelope<T>(response: Response): Promise<T> {
  const text = await response.text();
  let envelope: ApiEnvelope<T>;
  try {
    envelope = JSON.parse(text) as ApiEnvelope<T>;
  } catch {
    throw new ApiRequestError(response.status, {
      code: "invalid_response",
      message: `Server returned a non-JSON response (${response.status}).`,
      details: text.slice(0, 200),
    });
  }
  if (!envelope.success) {
    throw new ApiRequestError(response.status, envelope.error);
  }
  return envelope.data;
}

export function createApiClient({ baseUrl, storage }: ApiClientOptions): ApiClient {
  const base = baseUrl.replace(/\/+$/, "");
  // Dedupes concurrent 401s into one refresh call instead of one per request.
  let refreshing: Promise<string> | null = null;

  async function rawFetch(
    path: string,
    init: RequestInit,
    token: string | null,
  ): Promise<Response> {
    const headers = new Headers(init.headers);
    // FormData (multipart uploads: check-in selfie, face enrollment, expense
    // receipts) must set its own boundary-bearing Content-Type — forcing
    // application/json here would silently corrupt the request body.
    if (!(init.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(`${base}${path}`, { ...init, headers });
  }

  async function requestWithAuth(path: string, init: RequestInit = {}): Promise<Response> {
    let token = await storage.getAccessToken();
    let response = await rawFetch(path, init, token);

    if (response.status === 401) {
      refreshing ??= doRefresh().finally(() => {
        refreshing = null;
      });
      token = await refreshing;
      response = await rawFetch(path, init, token);
    }

    return response;
  }

  async function doRefresh(): Promise<string> {
    const refreshToken = await storage.getRefreshToken();
    if (!refreshToken)
      throw new ApiRequestError(401, {
        code: "not_authenticated",
        message: "Signed out.",
        details: null,
      });

    const response = await fetch(`${base}/api/v1/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });
    if (!response.ok) {
      await storage.clearTokens();
      throw new ApiRequestError(401, {
        code: "not_authenticated",
        message: "Session expired. Sign in again.",
        details: null,
      });
    }
    const { access } = await parseEnvelope<{ access: string }>(response);
    const currentRefresh = (await storage.getRefreshToken()) ?? refreshToken;
    await storage.setTokens({ access, refresh: currentRefresh });
    return access;
  }

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await requestWithAuth(path, init);
    return parseEnvelope<T>(response);
  }

  return {
    async login(email, password, rememberMe = false) {
      const response = await fetch(`${base}/api/v1/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember_me: rememberMe }),
      });
      const tokens = await parseEnvelope<TokenPair>(response);
      await storage.setTokens(tokens);
      return tokens;
    },

    async logout() {
      const refreshToken = await storage.getRefreshToken();
      if (refreshToken) {
        try {
          await request("/api/v1/auth/logout/", {
            method: "POST",
            body: JSON.stringify({ refresh: refreshToken }),
          });
        } catch {
          // Sign the device out locally even if the server call fails —
          // an unreachable backend must never trap the operator signed in.
        }
      }
      await storage.clearTokens();
    },

    me() {
      return request<MeResponse>("/api/v1/auth/me/");
    },

    request,
    requestRaw: requestWithAuth,
  };
}
