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

function hasDashboardAccess(user: PublicUser): boolean {
  return (
    user.role === 'admin' ||
    user.role === 'speaker' ||
    user.role === 'sponsor' ||
    Boolean(user.speakerId) ||
    Boolean(user.sponsorId)
  );
}

function assertDashboardUser(user: PublicUser): PublicUser {
  if (!hasDashboardAccess(user)) {
    throw new Error('This portal is for admins, speakers, and sponsors');
  }
  return user;
}

function homePathForUserCapabilities(user: PublicUser): string {
  if (user.speakerId || user.role === 'speaker') return '/my-speaker-profile';
  if (user.sponsorId || user.role === 'sponsor') return '/my-sponsor-profile';
  return '/';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(() => {
    const cached = tokenStorage.getUser<PublicUser>();
    return cached && hasDashboardAccess(cached) ? cached : null;
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

  const isSpeaker = Boolean(user?.speakerId) || user?.role === 'speaker';
  const isSponsor = Boolean(user?.sponsorId) || user?.role === 'sponsor';

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isBootstrapping,
      mustChangePassword: Boolean(user?.mustChangePassword),
      isAdmin: user?.role === 'admin',
      isSpeaker,
      isSponsor,
      login,
      changePassword,
      logout,
    }),
    [user, isBootstrapping, isSpeaker, isSponsor, login, changePassword, logout],
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
  return homePathForUserCapabilities(user);
}

/** True when the user may access a route gated by one of the given roles. */
export function userMatchesRoles(user: PublicUser, roles: UserRole[]): boolean {
  if (roles.includes(user.role)) return true;
  if (roles.includes('speaker') && (user.speakerId || user.role === 'speaker')) return true;
  if (roles.includes('sponsor') && (user.sponsorId || user.role === 'sponsor')) return true;
  if (roles.includes('member') && (user.role === 'member' || Boolean(user.membershipId))) {
    return true;
  }
  return false;
}
