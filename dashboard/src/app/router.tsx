import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/app/layout/AppShell';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { OverviewPage } from '@/features/dashboard/pages/OverviewPage';
import { UsersPage } from '@/features/users/pages/UsersPage';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route index element={<OverviewPage />} />
            <Route path="users" element={<UsersPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
