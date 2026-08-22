import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/app/layout/AppShell';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { getHomePathForUser, useAuth } from '@/features/auth/context/AuthProvider';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage';
import { SetPasswordPage } from '@/features/auth/pages/SetPasswordPage';
import { OverviewPage } from '@/features/dashboard/pages/OverviewPage';
import { AnnouncementsPage } from '@/features/announcements/pages/AnnouncementsPage';
import { CountdownSettingsPage } from '@/features/announcements/pages/CountdownSettingsPage';
import { CheckInsPage } from '@/features/checkins/pages/CheckInsPage';
import { EventsPage } from '@/features/events/pages/EventsPage';
import { SpeakerProfilePage } from '@/features/portal/pages/SpeakerProfilePage';
import { SpeakerSessionsPage } from '@/features/portal/pages/SpeakerSessionsPage';
import { SponsorProfilePage } from '@/features/portal/pages/SponsorProfilePage';
import { ChatPage } from '@/features/chat/pages/ChatPage';
import { PostsPage } from '@/features/posts/pages/PostsPage';
import { SessionsPage } from '@/features/sessions/pages/SessionsPage';
import { SpeakersPage } from '@/features/speakers/pages/SpeakersPage';
import { SponsorsPage } from '@/features/sponsors/pages/SponsorsPage';
import { StorePage } from '@/features/store/pages/StorePage';
import { MembershipsPage } from '@/features/memberships/pages/MembershipsPage';
import { EventAccessPage } from '@/features/access/pages/EventAccessPage';
import { CouponsPage } from '@/features/coupons/pages/CouponsPage';
import { UsersPage } from '@/features/users/pages/UsersPage';
import { Spinner } from '@/shared/ui/Spinner';

function RoleHomeRedirect() {
  const { user, isBootstrapping } = useAuth();
  if (isBootstrapping) return <Spinner />;
  return <Navigate to={getHomePathForUser(user)} replace />;
}

function PortalProfileRedirect() {
  const { isSpeaker, isSponsor } = useAuth();
  if (isSpeaker) return <Navigate to="/my-speaker-profile" replace />;
  if (isSponsor) return <Navigate to="/my-sponsor-profile" replace />;
  return <Navigate to="/" replace />;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/set-password" element={<SetPasswordPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route element={<ProtectedRoute roles={['admin']} />}>
              <Route index element={<OverviewPage />} />
              <Route path="events" element={<EventsPage />} />
              <Route path="sessions" element={<SessionsPage />} />
              <Route path="speakers" element={<SpeakersPage />} />
              <Route path="memberships" element={<MembershipsPage />} />
              <Route path="access" element={<EventAccessPage />} />
              <Route path="coupons" element={<CouponsPage />} />
              <Route path="sponsors" element={<SponsorsPage />} />
              <Route path="store" element={<StorePage />} />
              <Route path="announcements" element={<AnnouncementsPage />} />
              <Route path="announcements/countdown" element={<CountdownSettingsPage />} />
              <Route path="posts" element={<PostsPage />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="checkins" element={<CheckInsPage />} />
            </Route>

            <Route element={<ProtectedRoute roles={['speaker', 'sponsor']} />}>
              <Route path="my-profile" element={<PortalProfileRedirect />} />
            </Route>

            <Route element={<ProtectedRoute roles={['speaker']} />}>
              <Route path="my-speaker-profile" element={<SpeakerProfilePage />} />
              <Route path="my-sessions" element={<SpeakerSessionsPage />} />
            </Route>

            <Route element={<ProtectedRoute roles={['sponsor']} />}>
              <Route path="my-sponsor-profile" element={<SponsorProfilePage />} />
            </Route>

            <Route path="*" element={<RoleHomeRedirect />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
