import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/features/auth/components/AuthLayout';
import { getHomePathForUser, useAuth } from '@/features/auth/context/AuthProvider';
import { getApiErrorMessage } from '@/shared/api/client';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function TeamLoginPage() {
  const { login, isAuthenticated, isBootstrapping, user, isDesk } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (isBootstrapping) return <Spinner label="Checking session…" />;
  if (isAuthenticated && isDesk) {
    return <Navigate to="/team/checkins" replace />;
  }
  if (isAuthenticated && user && !isDesk) {
    return <Navigate to={getHomePathForUser(user)} replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!EMAIL_REGEX.test(trimmed) || !password) {
      toast.error('Enter a valid email and password');
      return;
    }
    setLoading(true);
    try {
      const signedIn = await login({ email: trimmed, password, portal: 'team' });
      toast.success('Signed in');
      navigate('/team/checkins', { replace: true });
      return signedIn;
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Unable to sign in'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout brandLine="Door check-in for the current event — simple, fast, mobile-ready.">
      <p className="auth-form-kicker">Desk team</p>
      <h1>Team check-in login</h1>
      <p className="muted">Use the email and temporary password from your invite.</p>
      <form className="auth-form stack" onSubmit={(event) => void onSubmit(event)}>
        <Input
          label="Email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <Button type="submit" loading={loading}>
          Sign in
        </Button>
      </form>
      <p className="muted" style={{ marginTop: 16 }}>
        <Link to="/forgot-password">Forgot password?</Link>
        {' · '}
        <Link to="/login">Admin / portal login</Link>
      </p>
    </AuthLayout>
  );
}
