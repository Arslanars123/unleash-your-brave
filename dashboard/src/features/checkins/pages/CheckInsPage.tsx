import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { QrCode, UserCheck } from 'lucide-react';
import { checkInsApi } from '@/features/checkins/api/checkins-api';
import { CheckInScanner } from '@/features/checkins/components/CheckInScanner';
import { EditionSwitcher } from '@/features/events/components/EditionSwitcher';
import {
  formatEditionRange,
  useEditionScope,
} from '@/features/events/hooks/useEditionScope';
import { getApiErrorMessage } from '@/shared/api/client';
import { resolveMediaUrl } from '@/shared/lib/media';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

export function CheckInsPage() {
  const { eventId, selectedEdition, isPastEdition } = useEditionScope();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'checked_in' | 'not_checked_in'>('all');
  const [token, setToken] = useState('');
  const [lastResult, setLastResult] = useState<string | null>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: ['checkins', 'list', eventId, search, status],
    enabled: Boolean(eventId),
    queryFn: () =>
      checkInsApi.list({
        eventId: eventId!,
        search: search || undefined,
        status,
        perPage: 100,
      }),
  });

  const scanMutation = useMutation({
    mutationFn: (payload: {
      token?: string;
      userId?: string;
      eventId?: string;
    }) =>
      checkInsApi.scan({
        ...payload,
        expectedEventId: eventId ?? undefined,
      }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['checkins'] });
      const name = result.user.name;
      if (result.alreadyCheckedIn) {
        const message = `${name} was already checked in`;
        setLastResult(message);
        toast.success(message);
      } else {
        const message = `Checked in ${name}`;
        setLastResult(message);
        toast.success(message);
      }
      setToken('');
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, 'Check-in failed');
      setLastResult(message);
      toast.error(message);
    },
  });

  const handleTokenScan = useCallback(
    (raw: string) => {
      if (scanMutation.isPending) return;
      void scanMutation.mutateAsync({ token: raw.trim() });
    },
    [scanMutation],
  );

  const stats = listQuery.data?.stats;
  const checkedIn = stats?.checkedInCount ?? 0;
  const attendees = stats?.attendeeCount ?? 0;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Check-in</h1>
          <p className="muted">
            Scan attendee QR codes for this event edition. Each edition has its own QR — past
            editions keep their own check-in history.
          </p>
        </div>
      </header>

      <EditionSwitcher />

      {!eventId ? (
        <p className="muted">Select or create an event edition to manage check-ins.</p>
      ) : (
        <>
          <div className="checkin-stats">
            <div className="panel">
              <strong>{checkedIn}</strong>
              <span className="muted">Checked in</span>
            </div>
            <div className="panel">
              <strong>{Math.max(attendees - checkedIn, 0)}</strong>
              <span className="muted">Not yet</span>
            </div>
            <div className="panel">
              <strong>{attendees}</strong>
              <span className="muted">Attendees</span>
            </div>
            <div className="panel">
              <strong>{selectedEdition ? formatEditionRange(selectedEdition) : '—'}</strong>
              <span className="muted">{isPastEdition ? 'Past edition' : 'Current edition'}</span>
            </div>
          </div>

          <section className="panel" style={{ marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem' }}>
              <QrCode size={16} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} />
              Scan QR
            </h2>
            <p className="muted" style={{ marginTop: 6 }}>
              Attendees open their event QR in the app. Scan it here, or paste the token if the
              camera is unavailable.
            </p>
            <CheckInScanner onScan={handleTokenScan} disabled={scanMutation.isPending} />
            <form
              className="toolbar"
              style={{ marginTop: 12 }}
              onSubmit={(e) => {
                e.preventDefault();
                if (!token.trim()) return;
                handleTokenScan(token);
              }}
            >
              <Input
                label="Or paste QR token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="uyb1...."
              />
              <Button type="submit" loading={scanMutation.isPending} disabled={!token.trim()}>
                <UserCheck size={16} />
                Check in
              </Button>
            </form>
            {lastResult ? <p className="hint">{lastResult}</p> : null}
          </section>

          <div className="toolbar">
            <Input
              label="Search attendees"
              placeholder="Name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <label className="field">
              <span className="field-label">Status</span>
              <select
                className="field-input"
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as 'all' | 'checked_in' | 'not_checked_in')
                }
              >
                <option value="all">All</option>
                <option value="checked_in">Checked in</option>
                <option value="not_checked_in">Not checked in</option>
              </select>
            </label>
          </div>

          {listQuery.isLoading ? <Spinner /> : null}
          {listQuery.isError ? (
            <p className="form-error">{getApiErrorMessage(listQuery.error)}</p>
          ) : null}

          {listQuery.data ? (
            listQuery.data.items.length === 0 ? (
              <div className="empty-state">
                <UserCheck size={28} />
                <h2>No attendees match</h2>
                <p className="muted">Try a different search or status filter.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Attendee</th>
                      <th>Status</th>
                      <th>Checked in at</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {listQuery.data.items.map((row) => {
                      const photo = resolveMediaUrl(row.user?.photoUrl ?? '');
                      return (
                        <tr key={row.id}>
                          <td>
                            <div className="user-chip" style={{ padding: 0, background: 'transparent' }}>
                              <span className="avatar">
                                {photo ? (
                                  <img src={photo} alt="" />
                                ) : (
                                  row.user?.name?.charAt(0) ?? '?'
                                )}
                              </span>
                              <div>
                                <strong>{row.user?.name ?? 'Unknown'}</strong>
                                <p>{row.user?.email}</p>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span
                              className={`status-pill ${
                                row.checkedIn ? 'status-published' : 'status-draft'
                              }`}
                            >
                              {row.checkedIn ? 'Checked in' : 'Not checked in'}
                            </span>
                          </td>
                          <td>
                            {row.checkedIn && row.checkedInAt
                              ? new Date(row.checkedInAt).toLocaleString()
                              : '—'}
                          </td>
                          <td className="actions">
                            {!row.checkedIn ? (
                              <Button
                                variant="secondary"
                                disabled={scanMutation.isPending}
                                onClick={() =>
                                  void scanMutation.mutateAsync({
                                    eventId: eventId,
                                    userId: row.userId,
                                  })
                                }
                              >
                                <UserCheck size={14} />
                                Check in
                              </Button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : null}
        </>
      )}
    </div>
  );
}
