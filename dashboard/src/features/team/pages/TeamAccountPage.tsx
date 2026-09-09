import { useState, type FormEvent } from 'react';
import { useAuth } from '@/features/auth/context/AuthProvider';
import { getApiErrorMessage } from '@/shared/api/client';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { useToast } from '@/shared/ui/toast';

export function TeamAccountPage() {
  const { changePassword } = useAuth();
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password updated');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Unable to change password'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="team-page">
      <header className="team-page-header">
        <h1>Change password</h1>
        <p className="muted">Optional — you can keep using the emailed password if you prefer.</p>
      </header>
      <form className="team-card stack" onSubmit={(event) => void onSubmit(event)}>
        <Input
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          required
        />
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
        />
        <Input
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
        />
        <Button type="submit" loading={loading}>
          Update password
        </Button>
      </form>
    </div>
  );
}
