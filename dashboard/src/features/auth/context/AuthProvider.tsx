import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import {
  authApi,
  type ChangePasswordPayload,
  type LoginPayload,
} from '@/features/auth/api/auth-api';
import {
  isPublicAuthPath,
  portalFromPath,
  tokenStorage,
  type AuthPortal,
} from '@/shared/lib/token-storage';
import type { PublicUser, UserRole } from '@/shared/types/api';

interface AuthContextValue {
  user: PublicUser | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  mustChangePassword: boolean;
  isAdmin: boolean;
  isSpeaker: boolean;
  isSponsor: boolean;
  isDesk: boolean;
  activePortal: AuthPortal;
  login: (payload: LoginPayload & { portal?: AuthPortal }) => Promise<PublicUser>;
  changePassword: (payload: ChangePasswordPayload) => Promise<PublicUser>;
  /** Logs out only the current portal (team vs admin stay independent). */
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function hasDashboardAccess(user: PublicUser): boolean {
  return (
    user.role === 'admin' ||
    user.role === 'speaker' ||
    user.role === 'sponsor' ||
    user.role === 'desk' ||
    Boolean(user.speakerId) ||
    Boolean(user.sponsorId)
  );
}

function assertPortalUser(user: PublicUser, portal: AuthPortal = 'admin'): PublicUser {
  if (portal === 'team') {
    if (user.role !== 'desk') {
      throw new Error('Use the admin / portal login for this account');
    }
    return user;
  }
  if (user.role === 'desk') {
    throw new Error('Desk team accounts sign in at /team/login');
  }
  if (!hasDashboardAccess(user) || user.role === 'member') {
    throw new Error('This portal is for admins, speakers, and sponsors');
  }
  return user;
}

function homePathForUserCapabilities(user: PublicUser): string {
  if (user.role === 'desk') return '/team/checkins';
  if (user.speakerId || user.role === 'speaker') return '/my-speaker-profile';
  if (user.sponsorId || user.role === 'sponsor') return '/my-sponsor-profile';
  return '/';
}

async function loadPortalSession(portal: AuthPortal): Promise<PublicUser | null> {
  const access = tokenStorage.getAccess(portal);
  if (!access) return null;

  try {
    const me = await authApi.me();
    if (portal === 'team') {
      if (me.role !== 'desk') {
        tokenStorage.clear(portal);
        return null;
      }
    } else if (!hasDashboardAccess(me) || me.role === 'desk') {
      tokenStorage.clear(portal);
      return null;
    }
    tokenStorage.setUser(JSON.stringify(me), portal);
    return me;
  } catch {
    tokenStorage.clear(portal);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const activePortal = portalFromPath(location.pathname);

  const [user, setUser] = useState<PublicUser | null>(() => {
    const cached = tokenStorage.getUser<PublicUser>(activePortal);
    if (!cached) return null;
    if (activePortal === 'team') return cached.role === 'desk' ? cached : null;
    return hasDashboardAccess(cached) && cached.role !== 'desk' ? cached : null;
  });
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [bootstrappedPortal, setBootstrappedPortal] = useState<AuthPortal | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      // Public pages (feedback form, login, etc.) must never run session refresh —
      // a stale token 401 was redirecting people away from /feedback to /login.
      if (isPublicAuthPath(location.pathname)) {
        if (!cancelled) {
          setBootstrappedPortal(activePortal);
          setIsBootstrapping(false);
        }
        return;
      }

      setIsBootstrapping(true);
      const cached = tokenStorage.getUser<PublicUser>(activePortal);
      if (cached) {
        const valid =
          activePortal === 'team'
            ? cached.role === 'desk'
            : hasDashboardAccess(cached) && cached.role !== 'desk';
        if (!cancelled) setUser(valid ? cached : null);
      } else if (!cancelled) {
        setUser(null);
      }

      const next = await loadPortalSession(activePortal);
      if (!cancelled) {
        setUser(next);
        setBootstrappedPortal(activePortal);
        setIsBootstrapping(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [activePortal, location.pathname]);

  const login = useCallback(
    async (payload: LoginPayload & { portal?: AuthPortal }) => {
      const portal = payload.portal ?? 'admin';
      const result = await authApi.login({
        email: payload.email.trim(),
        password: payload.password,
      });
      assertPortalUser(result.user, portal);
      tokenStorage.setTokens(result.tokens.accessToken, result.tokens.refreshToken, portal);
      tokenStorage.setUser(JSON.stringify(result.user), portal);
      if (portalFromPath() === portal) {
        setUser(result.user);
      }
      return result.user;
    },
    [],
  );

  const changePassword = useCallback(async (payload: ChangePasswordPayload) => {
    const portal = portalFromPath();
    const updated = await authApi.changePassword(payload);
    if (portal === 'team') {
      if (updated.role !== 'desk') throw new Error('No desk access');
    } else if (!hasDashboardAccess(updated) || updated.role === 'desk') {
      throw new Error('No dashboard access');
    }
    tokenStorage.setUser(JSON.stringify(updated), portal);
    setUser(updated);
    return updated;
  }, []);

  const logout = useCallback(() => {
    const portal = portalFromPath();
    tokenStorage.clear(portal);
    if (portalFromPath() === portal) {
      setUser(null);
    }
  }, []);

  const isSpeaker = Boolean(user?.speakerId) || user?.role === 'speaker';
  const isSponsor = Boolean(user?.sponsorId) || user?.role === 'sponsor';
  const isDesk = user?.role === 'desk';

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      // Keep spinner until this portal finished its own bootstrap.
      isBootstrapping: isBootstrapping || bootstrappedPortal !== activePortal,
      mustChangePassword: Boolean(user?.mustChangePassword),
      isAdmin: user?.role === 'admin',
      isSpeaker,
      isSponsor,
      isDesk,
      activePortal,
      login,
      changePassword,
      logout,
    }),
    [
      user,
      isBootstrapping,
      bootstrappedPortal,
      activePortal,
      isSpeaker,
      isSponsor,
      isDesk,
      login,
      changePassword,
      logout,
    ],
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
  if (user.role === 'desk') return '/team/checkins';
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
