import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  authApi,
  type ChangePasswordPayload,
  type LoginPayload,
} from '@/features/auth/api/auth-api';
import { tokenStorage } from '@/shared/lib/token-storage';
import type { PublicUser, UserRole } from '@/shared/types/api';

const DASHBOARD_ROLES: UserRole[] = ['admin', 'speaker', 'sponsor'];

interface AuthContextValue {
  user: PublicUser | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  mustChangePassword: boolean;
  isAdmin: boolean;
  isSpeaker: boolean;
  isSponsor: boolean;
  login: (payload: LoginPayload) => Promise<PublicUser>;
  changePassword: (payload: ChangePasswordPayload) => Promise<PublicUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function assertDashboardUser(user: PublicUser): PublicUser {
  if (!DASHBOARD_ROLES.includes(user.role)) {
    throw new Error('This portal is for admins, speakers, and sponsors');
  }
  return user;
}

function homePathForRole(role: UserRole): string {
  if (role === 'speaker') return '/my-profile';
  if (role === 'sponsor') return '/my-profile';
  return '/';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(() => {
    const cached = tokenStorage.getUser<PublicUser>();
    return cached && DASHBOARD_ROLES.includes(cached.role) ? cached : null;
  });
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const access = tokenStorage.getAccess();
      if (!access) {
        tokenStorage.clear();
        if (!cancelled) {
          setUser(null);
          setIsBootstrapping(false);
        }
        return;
      }

      try {
        const me = assertDashboardUser(await authApi.me());
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
    const result = await authApi.login({
      email: payload.email.trim(),
      password: payload.password,
    });
    assertDashboardUser(result.user);
    tokenStorage.setTokens(result.tokens.accessToken, result.tokens.refreshToken);
    tokenStorage.setUser(JSON.stringify(result.user));
    setUser(result.user);
    return result.user;
  }, []);

  const changePassword = useCallback(async (payload: ChangePasswordPayload) => {
    const updated = assertDashboardUser(await authApi.changePassword(payload));
    tokenStorage.setUser(JSON.stringify(updated));
    setUser(updated);
    return updated;
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
      mustChangePassword: Boolean(user?.mustChangePassword),
      isAdmin: user?.role === 'admin',
      isSpeaker: user?.role === 'speaker',
      isSponsor: user?.role === 'sponsor',
      login,
      changePassword,
      logout,
    }),
    [user, isBootstrapping, login, changePassword, logout],
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

export function getHomePathForUser(user: PublicUser | null): string {
  if (!user) return '/login';
  if (user.mustChangePassword) return '/set-password';
  return homePathForRole(user.role);
}
