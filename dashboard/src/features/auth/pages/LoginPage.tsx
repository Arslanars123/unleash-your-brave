import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { getHomePathForUser, useAuth } from '@/features/auth/context/AuthProvider';
import { getApiErrorMessage } from '@/shared/api/client';
import { BrandLogo } from '@/shared/ui/BrandLogo';
import { Button } from '@/shared/ui/Button';
import { useConfirm } from '@/shared/ui/ConfirmDialog';
import { Input } from '@/shared/ui/Input';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const INVITE_ALREADY_USED =
  'already used your invite';

interface FieldErrors {
  email?: string;
  password?: string;
}

function validate(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  const trimmed = email.trim();
  if (!trimmed) errors.email = 'Email is required';
  else if (!EMAIL_REGEX.test(trimmed)) errors.email = 'Enter a valid email address';
  if (!password) errors.password = 'Password or invite code is required';
  return errors;
}

function isInviteAlreadyUsedMessage(message: string): boolean {
  return message.toLowerCase().includes(INVITE_ALREADY_USED);
}

export function LoginPage() {
  const { login, isAuthenticated, isBootstrapping, user } = useAuth();
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const from = (location.state as { from?: string } | null)?.from;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  if (isBootstrapping) return <Spinner label="Checking session…" />;
  if (isAuthenticated) {
    return <Navigate to={from && from !== '/login' ? from : getHomePathForUser(user)} replace />;
  }

  function revalidate(nextEmail: string, nextPassword: string) {
    if (submitted) setErrors(validate(nextEmail, nextPassword));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);

    const nextErrors = validate(email, password);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    try {
      const signedIn = await login({ email: email.trim(), password });
      if (signedIn.mustChangePassword) {
        toast.success('Create your password to finish setup');
        navigate('/set-password', { replace: true });
        return;
      }
      toast.success('Signed in successfully');
      navigate(
        from && from !== '/login' ? from : getHomePathForUser(signedIn),
        { replace: true },
      );
    } catch (err) {
      const message = getApiErrorMessage(err, 'Unable to sign in');
      if (isInviteAlreadyUsedMessage(message)) {
        const goReset = await confirm({
          title: 'Invite code already used',
          message,
          cancelLabel: 'Enter password',
          confirmLabel: 'Reset password',
          tone: 'primary',
        });
        setPassword('');
        if (goReset) {
          navigate('/forgot-password');
        }
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={onSubmit} noValidate>
        <BrandLogo height={200} />
        <h1>Portal sign in</h1>
        <p className="muted">
          Use your email with your password, or your invite code the first time you sign in.
        </p>

        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="username"
          value={email}
          error={errors.email}
          onChange={(e) => {
            setEmail(e.target.value);
            revalidate(e.target.value, password);
          }}
        />
        <Input
          label="Password or invite code"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          error={errors.password}
          onChange={(e) => {
            setPassword(e.target.value);
            revalidate(email, e.target.value);
          }}
        />

        <p className="hint">
          <Link to="/forgot-password">Forgot password?</Link>
        </p>

        <Button type="submit" loading={loading}>
          Sign in
        </Button>

        <p className="hint">
          Demo — Admin: admin@unleashyourbrave.com / Admin123!
        </p>
      </form>
    </div>
  );
}
