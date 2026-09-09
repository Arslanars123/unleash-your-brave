import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { KeyRound, LogOut, QrCode } from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthProvider';
import { BrandLogo } from '@/shared/ui/BrandLogo';
import { Button } from '@/shared/ui/Button';

/** Slim mobile-first shell for desk team check-in. */
export function TeamShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/team/login', { replace: true });
  }

  return (
    <div className="team-shell">
      <header className="team-topbar">
        <div className="team-topbar-brand">
          <BrandLogo height={56} />
          <div>
            <p className="team-topbar-kicker">Desk team</p>
            <p className="team-topbar-user">{user?.name || user?.email}</p>
          </div>
        </div>
        <Button variant="ghost" onClick={handleLogout} aria-label="Sign out">
          <LogOut size={18} />
          <span className="team-topbar-logout-label">Sign out</span>
        </Button>
      </header>

      <main className="team-main">
        <Outlet />
      </main>

      <nav className="team-tabbar" aria-label="Team navigation">
        <NavLink to="/team/checkins" className={({ isActive }) => (isActive ? 'active' : undefined)}>
          <QrCode size={22} />
          Check-in
        </NavLink>
        <NavLink to="/team/account" className={({ isActive }) => (isActive ? 'active' : undefined)}>
          <KeyRound size={22} />
          Password
        </NavLink>
      </nav>
    </div>
  );
}
