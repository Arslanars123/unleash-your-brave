import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/context/AuthProvider';
import { getApiErrorMessage } from '@/shared/api/client';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Spinner } from '@/shared/ui/Spinner';

export function LoginPage() {
  const { login, isAuthenticated, isBootstrapping } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [email, setEmail] = useState('admin@unleashyourbrave.com');
  const [password, setPassword] = useState('Admin123!');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isBootstrapping) return <Spinner label="Checking session…" />;
  if (isAuthenticated) return <Navigate to={from} replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to sign in'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="brand-mark">UYB</div>
        <h1>Unleash Your Brave</h1>
        <p className="muted">Admin dashboard — sign in to manage the platform.</p>

        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error ? <p className="form-error">{error}</p> : null}

        <Button type="submit" loading={loading}>
          Sign in
        </Button>

        <p className="hint">Demo: admin@unleashyourbrave.com / Admin123!</p>
      </form>
    </div>
  );
}
