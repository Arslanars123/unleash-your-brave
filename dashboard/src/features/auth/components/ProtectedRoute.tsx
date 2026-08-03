import { Navigate, Outlet } from 'react-router-dom';
import { getHomePathForUser, useAuth } from '@/features/auth/context/AuthProvider';
import type { UserRole } from '@/shared/types/api';
import { Spinner } from '@/shared/ui/Spinner';

export function ProtectedRoute({ roles }: { roles?: UserRole[] }) {
  const { user, isAuthenticated, isBootstrapping } = useAuth();

  if (isBootstrapping) return <Spinner label="Checking session…" />;
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={getHomePathForUser(user)} replace />;
  }

  return <Outlet />;
}
