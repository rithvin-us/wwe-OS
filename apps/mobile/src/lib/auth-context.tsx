import { isAuthError } from "@bop/sdk";
import type { User } from "@bop/shared-types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { api } from "@/lib/api";
import { DEV_AUTO_LOGIN, DEV_EMAIL, DEV_PASSWORD } from "@/lib/dev-auth";
import { secureTokenStorage } from "@/lib/token-storage";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isSigningIn: boolean;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const signIn = useCallback(async (email: string, password: string, rememberMe = false) => {
    setIsSigningIn(true);
    try {
      await api.login(email, password, rememberMe);
      const me = await api.me();
      setUser(me.user);
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function hydrate() {
      const accessToken = await secureTokenStorage.getAccessToken();
      if (!accessToken) {
        if (DEV_AUTO_LOGIN) {
          try {
            await signIn(DEV_EMAIL, DEV_PASSWORD);
          } catch {
            // Backend unreachable or dev creds stale — falls through to the
            // real login screen, same as with the flag off.
          }
        }
        if (active) setIsLoading(false);
        return;
      }
      try {
        const me = await api.me();
        if (active) setUser(me.user);
      } catch (err) {
        // An access token that fails `me()` after the SDK's own refresh
        // retry is a dead session, not a transient error — clear it so the
        // operator lands on the sign-in screen instead of a stuck spinner.
        if (isAuthError(err)) await secureTokenStorage.clearTokens();
      } finally {
        if (active) setIsLoading(false);
      }
    }
    hydrate();
    return () => {
      active = false;
    };
  }, [signIn]);

  const signOut = useCallback(async () => {
    await api.logout();
    setUser(null);
    // With auto-login on, "signing out" of a dev bypass would just land on
    // a login screen that isn't meant to be reachable right now — sign
    // straight back in instead of leaving a dead end.
    if (DEV_AUTO_LOGIN) {
      try {
        await signIn(DEV_EMAIL, DEV_PASSWORD);
      } catch {
        // Backend unreachable — leaves user === null, real login screen
        // is still there and fully functional as a fallback.
      }
    }
  }, [signIn]);

  const value = useMemo(
    () => ({ user, isLoading, isSigningIn, signIn, signOut }),
    [user, isLoading, isSigningIn, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
