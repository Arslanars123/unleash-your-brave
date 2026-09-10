import { Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  getHomePathForUser,
  useAuth,
  userMatchesRoles,
} from '@/features/auth/context/AuthProvider';
import type { UserRole } from '@/shared/types/api';
import { Spinner } from '@/shared/ui/Spinner';

export function ProtectedRoute({
  roles,
  loginPath = '/login',
}: {
  roles?: UserRole[];
  loginPath?: string;
}) {
  const { user, isAuthenticated, isBootstrapping, mustChangePassword, isDesk } = useAuth();
  const location = useLocation();

  if (isBootstrapping) return <Spinner label="Checking session…" />;
  if (!isAuthenticated || !user) {
    return <Navigate to={loginPath} replace state={{ from: location.pathname }} />;
  }

  if (mustChangePassword && location.pathname !== '/set-password') {
    return <Navigate to="/set-password" replace />;
  }

  // Desk accounts stay in the team app — never the admin shell.
  if (isDesk && !(location.pathname === '/team' || location.pathname.startsWith('/team/'))) {
    return <Navigate to="/team/checkins" replace />;
  }

  if (roles && !userMatchesRoles(user, roles)) {
    return <Navigate to={getHomePathForUser(user)} replace />;
  }

  return <Outlet />;
}
