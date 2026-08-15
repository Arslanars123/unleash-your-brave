import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getHomePathForUser, useAuth } from '@/features/auth/context/AuthProvider';
import type { UserRole } from '@/shared/types/api';
import { Spinner } from '@/shared/ui/Spinner';

export function ProtectedRoute({ roles }: { roles?: UserRole[] }) {
  const { user, isAuthenticated, isBootstrapping, mustChangePassword } = useAuth();
  const location = useLocation();

  if (isBootstrapping) return <Spinner label="Checking session…" />;
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;

  if (mustChangePassword && location.pathname !== '/set-password') {
    return <Navigate to="/set-password" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={getHomePathForUser(user)} replace />;
  }

  return <Outlet />;
}
