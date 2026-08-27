/**
 * CLIENT_TESTING_MODE — temporary admin toggle.
 * Removal checklist: docs/CLIENT_TESTING_MODE_REMOVAL.md (search CLIENT_TESTING_MODE).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FlaskConical } from 'lucide-react';
import { clientTestingApi } from '@/features/client-testing/api/client-testing-api';
import { getApiErrorMessage } from '@/shared/api/client';
import { Button } from '@/shared/ui/Button';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

export function ClientTestingPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ['client-testing'],
    queryFn: () => clientTestingApi.get(),
  });

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) => clientTestingApi.update({ enabled }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['client-testing'] });
      toast.success(
        data.enabled
          ? 'Client testing mode ON — upcoming events allow check-in & reviews'
          : 'Client testing mode OFF — normal date gates restored',
      );
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, 'Unable to update testing mode')),
  });

  const enabled = Boolean(settingsQuery.data?.enabled);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="page-kicker">Temporary</span>
          <h1>Client testing mode</h1>
          <p className="muted">
            Turn this on so the client can test check-in, QR scan, waiver, and reviews on
            upcoming events before the start date. Turn it off when testing is finished.
          </p>
        </div>
      </header>

      {settingsQuery.isLoading ? <Spinner /> : null}
      {settingsQuery.isError ? (
        <p className="form-error">{getApiErrorMessage(settingsQuery.error)}</p>
      ) : null}

      <section className="panel" style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <FlaskConical size={22} style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: '0 0 8px', fontSize: '1.1rem' }}>
              Status:{' '}
              <span className={`status-pill ${enabled ? 'status-published' : 'status-draft'}`}>
                {enabled ? 'Enabled' : 'Disabled'}
              </span>
            </h2>
            <p className="muted" style={{ marginTop: 0 }}>
              When enabled:
            </p>
            <ul className="muted" style={{ marginTop: 0, paddingLeft: 18 }}>
              <li>Admin Check-in scanner works for upcoming editions</li>
              <li>QR scan → attendee waiver → Checked In works before start date</li>
              <li>Session reviews unlock as if the event had started</li>
              <li>Ended / paused editions stay blocked</li>
            </ul>
            {settingsQuery.data?.updatedAt ? (
              <p className="hint" style={{ marginBottom: 16 }}>
                Last updated {new Date(settingsQuery.data.updatedAt).toLocaleString()}
              </p>
            ) : null}
            <Button
              loading={toggleMutation.isPending}
              variant={enabled ? 'secondary' : 'primary'}
              onClick={() => toggleMutation.mutate(!enabled)}
            >
              {enabled ? 'Turn testing mode OFF' : 'Turn testing mode ON'}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
