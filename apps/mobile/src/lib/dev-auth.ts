/**
 * Dev-only auto sign-in — skips the /login screen entirely by silently
 * authenticating with real credentials against the real backend on launch.
 * Not a fake session: it's a genuine `api.login()` call, same as typing into
 * the form, just automated.
 *
 * To bring the login screen back: set EXPO_PUBLIC_DEV_AUTO_LOGIN=false (or
 * delete the var) in `.env`. Nothing else changes — `login.tsx` and the
 * `Stack.Protected` guard in `_layout.tsx` are untouched and still fully
 * wired; this only decides whether `AuthProvider` beats the operator to it.
 */
export const DEV_AUTO_LOGIN = process.env.EXPO_PUBLIC_DEV_AUTO_LOGIN !== "false";
export const DEV_EMAIL = process.env.EXPO_PUBLIC_DEV_EMAIL ?? "admin@wwe.local";
export const DEV_PASSWORD = process.env.EXPO_PUBLIC_DEV_PASSWORD ?? "AdminPassword123!";
