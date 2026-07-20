/**
 * The platform API's response shape (`platform/shared/renderers.py` +
 * `exceptions.py`). Every fetch to Django resolves to one of these — never
 * a raw, unwrapped payload.
 */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: {
    count: number;
    page: number;
    pages: number;
    page_size: number;
    next: string | null;
    previous: string | null;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details: unknown;
  };
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiError;

export class ApiRequestError extends Error {
  code: string;
  status: number;
  details: unknown;

  constructor(status: number, error: ApiError["error"]) {
    super(error.message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = error.code;
    this.details = error.details;
  }
}

/** True for the one error code that means "the session is no longer valid." */
export function isAuthError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError && error.status === 401;
}
