/**
 * Mirrors `platform/users/serializers.py::UserSerializer` and
 * `platform/auth/views.py::MeView` / `LoginView` — the platform kernel's own
 * response shapes, not app-invented ones. Keep in sync with those, not the
 * other way around.
 */

export interface User {
  id: string;
  username: string;
  email: string;
  phone: string;
  avatar_url: string;
  status: string;
  is_active: boolean;
  is_email_verified: boolean;
  timezone: string;
  language: string;
  preferences: Record<string, unknown>;
  tenant: string | null;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeResponse {
  user: User;
  permissions: string[];
}

export interface TokenPair {
  access: string;
  refresh: string;
}

/** Mirrors `modules/purchase/backend/api/views.py`'s `stats` action. */
export interface PurchaseBillStats {
  processed: number;
  needs_attention: number;
  total: number;
  unpaid: number;
}

export * from "./hr";
export * from "./purchase";
export * from "./finance";
export * from "./tags";
export * from "./dms";
export * from "./assets";
export * from "./reports";
export * from "./ai";
export * from "./audit";
export * from "./automation";
