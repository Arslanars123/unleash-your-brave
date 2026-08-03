import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/app/layout/AppShell';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { getHomePathForUser, useAuth } from '@/features/auth/context/AuthProvider';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { OverviewPage } from '@/features/dashboard/pages/OverviewPage';
import { AnnouncementsPage } from '@/features/announcements/pages/AnnouncementsPage';
import { EventsPage } from '@/features/events/pages/EventsPage';
import { SpeakerProfilePage } from '@/features/portal/pages/SpeakerProfilePage';
import { SpeakerSessionsPage } from '@/features/portal/pages/SpeakerSessionsPage';
import { SponsorProfilePage } from '@/features/portal/pages/SponsorProfilePage';
import { PostsPage } from '@/features/posts/pages/PostsPage';
import { SessionsPage } from '@/features/sessions/pages/SessionsPage';
import { SpeakersPage } from '@/features/speakers/pages/SpeakersPage';
import { SponsorsPage } from '@/features/sponsors/pages/SponsorsPage';
import { UsersPage } from '@/features/users/pages/UsersPage';
import { Spinner } from '@/shared/ui/Spinner';

function RoleHomeRedirect() {
  const { user, isBootstrapping } = useAuth();
  if (isBootstrapping) return <Spinner />;
  return <Navigate to={getHomePathForUser(user)} replace />;
}

function PortalProfilePage() {
  const { isSpeaker, isSponsor } = useAuth();
  if (isSpeaker) return <SpeakerProfilePage />;
  if (isSponsor) return <SponsorProfilePage />;
  return <Navigate to="/" replace />;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route element={<ProtectedRoute roles={['admin']} />}>
              <Route index element={<OverviewPage />} />
              <Route path="events" element={<EventsPage />} />
              <Route path="sessions" element={<SessionsPage />} />
              <Route path="speakers" element={<SpeakersPage />} />
              <Route path="sponsors" element={<SponsorsPage />} />
              <Route path="announcements" element={<AnnouncementsPage />} />
              <Route path="posts" element={<PostsPage />} />
              <Route path="users" element={<UsersPage />} />
            </Route>

            <Route element={<ProtectedRoute roles={['speaker', 'sponsor']} />}>
              <Route path="my-profile" element={<PortalProfilePage />} />
            </Route>

            <Route element={<ProtectedRoute roles={['speaker']} />}>
              <Route path="my-sessions" element={<SpeakerSessionsPage />} />
            </Route>

            <Route path="*" element={<RoleHomeRedirect />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
