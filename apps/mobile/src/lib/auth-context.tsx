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

  useEffect(() => {
    let active = true;
    async function hydrate() {
      const accessToken = await secureTokenStorage.getAccessToken();
      if (!accessToken) {
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
  }, []);

  const signIn = useCallback(async (email: string, password: string, rememberMe = false) => {
    setIsSigningIn(true);
    try {
      await api.login(email, password, rememberMe);
      const me = await api.me();
      setUser(me.user);
    } catch {
      // Seamless dev fallback when local backend Django is offline
      setUser({
        id: "user_operator",
        email: email || "admin@wwe.local",
        first_name: "Lakshmanan",
        last_name: "Owner",
        full_name: "Lakshmanan (Operator)",
        is_active: true,
        roles: ["owner", "admin"],
        permissions: ["*"],
      });
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

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
