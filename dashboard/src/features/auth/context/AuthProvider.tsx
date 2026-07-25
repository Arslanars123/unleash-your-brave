import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi, type LoginPayload } from '@/features/auth/api/auth-api';
import { tokenStorage } from '@/shared/lib/token-storage';
import type { PublicUser } from '@/shared/types/api';

interface AuthContextValue {
  user: PublicUser | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(() => tokenStorage.getUser<PublicUser>());
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const access = tokenStorage.getAccess();
      if (!access) {
        if (!cancelled) setIsBootstrapping(false);
        return;
      }

      try {
        const me = await authApi.me();
        if (!cancelled) {
          setUser(me);
          tokenStorage.setUser(JSON.stringify(me));
        }
      } catch {
        tokenStorage.clear();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsBootstrapping(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const result = await authApi.login(payload);
    if (result.user.role !== 'admin') {
      throw new Error('Admin access required');
    }
    tokenStorage.setTokens(result.tokens.accessToken, result.tokens.refreshToken);
    tokenStorage.setUser(JSON.stringify(result.user));
    setUser(result.user);
  }, []);

  const logout = useCallback(() => {
    tokenStorage.clear();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isBootstrapping,
      login,
      logout,
    }),
    [user, isBootstrapping, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
