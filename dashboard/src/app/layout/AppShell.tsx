import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, LogOut, Users } from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthProvider';
import { Button } from '@/shared/ui/Button';

export function AppShell() {
  const { user, logout } = useAuth();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark sm">UYB</span>
          <div>
            <strong>Unleash Your Brave</strong>
            <p>Admin console</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/" end>
            <LayoutDashboard size={18} />
            Overview
          </NavLink>
          <NavLink to="/users">
            <Users size={18} />
            Users
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <span className="avatar">{user?.name?.charAt(0) ?? 'A'}</span>
            <div>
              <strong>{user?.name}</strong>
              <p>{user?.email}</p>
            </div>
          </div>
          <Button variant="ghost" onClick={logout} className="logout-btn">
            <LogOut size={16} />
            Sign out
          </Button>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
