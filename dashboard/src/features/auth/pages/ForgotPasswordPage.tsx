import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { authApi } from '@/features/auth/api/auth-api';
import { useAuth } from '@/features/auth/context/AuthProvider';
import { getApiErrorMessage } from '@/shared/api/client';
import { BrandLogo } from '@/shared/ui/BrandLogo';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

type Step = 'email' | 'otp' | 'password';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPasswordPage() {
  const { isAuthenticated, isBootstrapping, user } = useAuth();
  const toast = useToast();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (isBootstrapping) return <Spinner label="Checking session…" />;
  if (isAuthenticated) {
    return <Navigate to={user?.mustChangePassword ? '/set-password' : '/'} replace />;
  }
  if (done) return <Navigate to="/login" replace state={{ passwordReset: true }} />;

  async function submitEmail(event: FormEvent) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !EMAIL_REGEX.test(trimmed)) {
      toast.error('Enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const result = await authApi.forgotPassword(trimmed);
      toast.success(result.message);
      setStep('otp');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Unable to send reset code'));
    } finally {
      setLoading(false);
    }
  }

  async function submitOtp(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp.trim())) {
      toast.error('Enter the 6-digit code from your email');
      return;
    }

    setLoading(true);
    try {
      const result = await authApi.verifyResetOtp({ email: email.trim(), otp: otp.trim() });
      setResetToken(result.resetToken);
      setStep('password');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Invalid or expired code'));
    } finally {
      setLoading(false);
    }
  }

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword({ resetToken, newPassword: password });
      toast.success('Password updated — sign in with your new password');
      setDone(true);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Unable to reset password'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <BrandLogo height={200} />
        <h1>Reset password</h1>
        <p className="muted">
          {step === 'email' && 'Enter your email and we will send a verification code.'}
          {step === 'otp' && 'Enter the 6-digit code from your email.'}
          {step === 'password' && 'Choose a new password for your account.'}
        </p>

        {step === 'email' ? (
          <form onSubmit={submitEmail} noValidate>
            <Input
              label="Email"
              type="email"
              name="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" loading={loading}>
              Send code
            </Button>
          </form>
        ) : null}

        {step === 'otp' ? (
          <form onSubmit={submitOtp} noValidate>
            <Input
              label="Verification code"
              name="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
            />
            <Button type="submit" loading={loading}>
              Verify code
            </Button>
            <button type="button" className="text-link" onClick={() => setStep('email')}>
              Use a different email
            </button>
          </form>
        ) : null}

        {step === 'password' ? (
          <form onSubmit={submitPassword} noValidate>
            <Input
              label="New password"
              type="password"
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Input
              label="Confirm password"
              type="password"
              name="confirm"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            <Button type="submit" loading={loading}>
              Reset password
            </Button>
          </form>
        ) : null}

        <p className="hint">
          <Link to="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
