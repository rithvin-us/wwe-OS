import { createApiClient } from "@bop/sdk";

import { secureTokenStorage } from "@/lib/token-storage";

/**
 * A physical device (Expo Go, or a dev build) can't reach `localhost` — that
 * resolves to the phone itself, not this machine. Point EXPO_PUBLIC_API_URL
 * at the LAN address Metro is already bundling from (see the `exp://` URL
 * printed on `expo start`), with the Django server bound to 0.0.0.0:8000,
 * not 127.0.0.1:8000.
 */
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

export const api = createApiClient({
  baseUrl: API_URL,
  storage: secureTokenStorage,
});
