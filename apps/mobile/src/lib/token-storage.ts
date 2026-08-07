import type { TokenStorage } from "@bop/sdk";
import type { TokenPair } from "@bop/shared-types";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const ACCESS_KEY = "wweos_access_token";
const REFRESH_KEY = "wweos_refresh_token";

/**
 * expo-secure-store has no web implementation (Keychain/Keystore don't exist
 * in a browser) — `localStorage` is the standard fallback there. Native
 * builds always use SecureStore; only `expo start --web` takes this branch.
 */
const webStorage = {
  async getItemAsync(key: string): Promise<string | null> {
    return globalThis.localStorage?.getItem(key) ?? null;
  },
  async setItemAsync(key: string, value: string): Promise<void> {
    globalThis.localStorage?.setItem(key, value);
  },
  async deleteItemAsync(key: string): Promise<void> {
    globalThis.localStorage?.removeItem(key);
  },
};

const backend = Platform.OS === "web" ? webStorage : SecureStore;

export const secureTokenStorage: TokenStorage = {
  async getAccessToken() {
    return backend.getItemAsync(ACCESS_KEY);
  },
  async getRefreshToken() {
    return backend.getItemAsync(REFRESH_KEY);
  },
  async setTokens(tokens: TokenPair) {
    await Promise.all([
      backend.setItemAsync(ACCESS_KEY, tokens.access),
      backend.setItemAsync(REFRESH_KEY, tokens.refresh),
    ]);
  },
  async clearTokens() {
    await Promise.all([backend.deleteItemAsync(ACCESS_KEY), backend.deleteItemAsync(REFRESH_KEY)]);
  },
};
