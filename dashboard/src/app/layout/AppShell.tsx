import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  CalendarDays,
  Clapperboard,
  FlaskConical,
  Handshake,
  BadgeCheck,
  Images,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MessageCircle,
  Mic2,
  QrCode,
  Smartphone,
  TicketPercent,
  UserRound,
  Users,
  ShoppingBag,
  X,
} from 'lucide-react';
import { announcementsApi } from '@/features/announcements/api/announcements-api';
import { usePortalAnnouncementRealtime } from '@/features/announcements/hooks/usePortalAnnouncementRealtime';
import { useAuth } from '@/features/auth/context/AuthProvider';
import { BrandLogo } from '@/shared/ui/BrandLogo';
import { Button } from '@/shared/ui/Button';

export function AppShell() {
  const { user, logout, isAdmin, isSpeaker, isSponsor } = useAuth();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const portalNotifications = (isSpeaker || isSponsor) && !isAdmin;

  usePortalAnnouncementRealtime(portalNotifications);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = navOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [navOpen]);

  const unreadQuery = useQuery({
    queryKey: ['announcements', 'unread-count'],
    queryFn: () => announcementsApi.unreadCount(),
    enabled: portalNotifications,
    refetchInterval: 30_000,
  });
  const unreadCount = unreadQuery.data ?? 0;

  const portalLabel = isAdmin
    ? 'Admin'
    : isSpeaker && isSponsor
      ? 'Speaker & Sponsor'
      : isSpeaker
        ? 'Speaker'
        : isSponsor
          ? 'Sponsor'
          : 'Portal';

  return (
    <div className={`shell${navOpen ? ' shell-nav-open' : ''}`}>
      <button
        type="button"
        className="sidebar-backdrop"
        aria-label="Close menu"
        tabIndex={navOpen ? 0 : -1}
        onClick={() => setNavOpen(false)}
      />

      <aside className="sidebar" aria-label="Main navigation">
        <div className="sidebar-mobile-head">
          <BrandLogo height={120} className="sidebar-brand-logo" />
          <button
            type="button"
            className="sidebar-close"
            aria-label="Close menu"
            onClick={() => setNavOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <div className="sidebar-brand">
          <BrandLogo height={148} className="sidebar-brand-logo sidebar-brand-logo-desktop" />
          <p className="sidebar-portal-label">{portalLabel}</p>
        </div>

        <nav className="sidebar-nav" onClick={() => setNavOpen(false)}>
          {isAdmin ? (
            <>
              <NavLink to="/" end>
                <LayoutDashboard size={18} />
                Overview
              </NavLink>
              <NavLink to="/app-home">
                <Smartphone size={18} />
                App home
              </NavLink>
              <NavLink to="/events">
                <CalendarDays size={18} />
                Event
              </NavLink>
              <NavLink to="/sessions">
                <Clapperboard size={18} />
                Sessions
              </NavLink>
              <NavLink to="/speakers">
                <Mic2 size={18} />
                Speakers
              </NavLink>
              <NavLink to="/memberships">
                <BadgeCheck size={18} />
                Memberships
              </NavLink>
              <NavLink to="/access">
                <KeyRound size={18} />
                Event access
              </NavLink>
              <NavLink to="/coupons">
                <TicketPercent size={18} />
                Coupons
              </NavLink>
              <NavLink to="/sponsors">
                <Handshake size={18} />
                Sponsors
              </NavLink>
              <NavLink to="/store">
                <ShoppingBag size={18} />
                Store
              </NavLink>
              <NavLink to="/announcements">
                <Megaphone size={18} />
                Announcements
              </NavLink>
              <NavLink to="/posts">
                <Images size={18} />
                Posts
              </NavLink>
              <NavLink to="/chat">
                <MessageCircle size={18} />
                Group chat
              </NavLink>
              <NavLink to="/users">
                <Users size={18} />
                Attendees
              </NavLink>
              <NavLink to="/checkins">
                <QrCode size={18} />
                Check-in
              </NavLink>
              {/* CLIENT_TESTING_MODE — remove nav item when deleting feature. */}
              <NavLink to="/client-testing">
                <FlaskConical size={18} />
                Testing mode
              </NavLink>
            </>
          ) : null}

          {isSpeaker ? (
            <>
              <NavLink to="/my-speaker-profile">
                <UserRound size={18} />
                Speaker profile
              </NavLink>
              <NavLink to="/my-sessions">
                <Clapperboard size={18} />
                My sessions
              </NavLink>
            </>
          ) : null}

          {isSponsor ? (
            <NavLink to="/my-sponsor-profile">
              <Handshake size={18} />
              Sponsor profile
            </NavLink>
          ) : null}

          {portalNotifications ? (
            <NavLink to="/notifications" className="sidebar-nav-notifications">
              <Bell size={18} />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                Notifications
                {unreadCount > 0 ? (
                  <span
                    className="status-pill status-published"
                    style={{ fontSize: 11, padding: '2px 7px', minWidth: 22, textAlign: 'center' }}
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                ) : null}
              </span>
            </NavLink>
          ) : null}
        </nav>
      </aside>

      <div className="shell-main">
        <header className="topbar">
          <div className="topbar-start">
            <button
              type="button"
              className="mobile-nav-toggle"
              aria-label={navOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={navOpen}
              onClick={() => setNavOpen((open) => !open)}
            >
              <Menu size={22} />
            </button>
            <BrandLogo height={44} className="topbar-brand-logo" />
          </div>

          <div className="topbar-user">
            <div className="user-chip">
              <span className="avatar">{user?.name?.charAt(0) ?? 'A'}</span>
              <div className="user-chip-copy">
                <strong>{user?.name}</strong>
                <p>{user?.email}</p>
              </div>
            </div>
            <Button variant="ghost" onClick={logout} className="logout-btn">
              <LogOut size={16} />
              <span className="logout-label">Sign out</span>
            </Button>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
