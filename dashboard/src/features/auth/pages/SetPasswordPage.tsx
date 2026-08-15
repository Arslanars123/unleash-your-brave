import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { getHomePathForUser, useAuth } from '@/features/auth/context/AuthProvider';
import { getApiErrorMessage } from '@/shared/api/client';
import { BrandLogo } from '@/shared/ui/BrandLogo';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

export function SetPasswordPage() {
  const { changePassword, isAuthenticated, isBootstrapping, user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});

  if (isBootstrapping) return <Spinner label="Checking session…" />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user && !user.mustChangePassword) {
    return <Navigate to={getHomePathForUser(user)} replace />;
  }

  function validate(): boolean {
    const next: { password?: string; confirm?: string } = {};
    if (password.length < 8) next.password = 'Password must be at least 8 characters';
    if (confirm !== password) next.confirm = 'Passwords do not match';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const updated = await changePassword({ newPassword: password });
      toast.success('Password saved');
      navigate(getHomePathForUser(updated), { replace: true });
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Unable to save password'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={onSubmit} noValidate>
        <BrandLogo height={156} />
        <h1>Set your password</h1>
        <p className="muted">Create a password for your portal account.</p>

        <Input
          label="New password"
          type="password"
          name="password"
          autoComplete="new-password"
          value={password}
          error={errors.password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Input
          label="Confirm password"
          type="password"
          name="confirm"
          autoComplete="new-password"
          value={confirm}
          error={errors.confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />

        <Button type="submit" loading={loading}>
          Save password
        </Button>
      </form>
    </div>
  );
}
