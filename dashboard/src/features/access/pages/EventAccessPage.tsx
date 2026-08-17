import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { eventsApi } from '@/features/events/api/events-api';
import { membershipsApi } from '@/features/memberships/api/memberships-api';
import { getApiErrorMessage } from '@/shared/api/client';
import type { PublicMembership } from '@/shared/types/api';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

export function EventAccessPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const workspaceQuery = useQuery({
    queryKey: ['events', 'workspace'],
    queryFn: () => eventsApi.getWorkspace(),
  });

  const current = workspaceQuery.data?.current ?? null;
  const pastEditions = workspaceQuery.data?.pastEditions ?? [];

  const currentMembershipsQuery = useQuery({
    queryKey: ['memberships', 'access', current?.id],
    queryFn: () =>
      membershipsApi.list({ eventId: current!.id, page: 1, perPage: 100 }),
    enabled: Boolean(current?.id),
  });

  const pastEventId = pastEditions[0]?.id;
  const pastMembershipsQuery = useQuery({
    queryKey: ['memberships', 'access-past', pastEventId],
    queryFn: () =>
      membershipsApi.list({ eventId: pastEventId!, page: 1, perPage: 100 }),
    enabled: Boolean(pastEventId),
  });

  const eventAccessMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      eventsApi.update(current!.id, { allowPreviousAttendeesAccess: enabled }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event access setting saved');
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, 'Unable to update event access')),
  });

  const membershipMutation = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<{
        validForFutureEvents: boolean;
        validForFutureQr: boolean;
        upgradeToMembershipId: string | null;
      }>;
    }) => membershipsApi.update(id, patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['memberships'] });
      toast.success('Membership access saved');
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, 'Unable to update membership')),
  });

  if (workspaceQuery.isLoading) return <Spinner label="Loading access settings…" />;

  if (!current) {
    return (
      <div className="page">
        <header className="page-header">
          <div>
            <h1>Event access</h1>
            <p className="muted">Schedule an event first, then manage attendee access here.</p>
          </div>
        </header>
        <p className="muted">
          No current event. Go to <Link to="/events">Event</Link> to create one.
        </p>
      </div>
    );
  }

  const currentMemberships = currentMembershipsQuery.data?.items ?? [];
  const pastMemberships = pastMembershipsQuery.data?.items ?? [];
  const savingId = membershipMutation.isPending
    ? (membershipMutation.variables?.id ?? null)
    : null;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Event access</h1>
          <p className="muted">
            Control previous-attendee content access separately from check-in QR. Enable QR only
            for the membership types you choose.
          </p>
        </div>
      </header>

      <section className="panel" style={{ marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>New event — previous attendees</h2>
        <p className="muted">
          Current edition: <strong>{current.name}</strong> ({current.status})
        </p>
        <label className="field" style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <input
            type="checkbox"
            checked={Boolean(current.allowPreviousAttendeesAccess)}
            disabled={eventAccessMutation.isPending}
            onChange={(e) => eventAccessMutation.mutate(e.target.checked)}
            style={{ marginTop: 4 }}
          />
          <span>
            <strong>Allow previous attendees to access this event’s content</strong>
            <br />
            <span className="hint">
              When enabled, attendees who bought a pass for an older edition can see sessions and
              content on this edition (matched by membership name/tier when possible). This does{' '}
              <strong>not</strong> issue a check-in QR — use “QR for future events” on specific
              memberships below.
            </span>
          </span>
        </label>
      </section>

      <MembershipAccessTable
        title="Current edition memberships"
        subtitle="Mark which tiers carry content and/or QR to future events, and set the next upgrade level shown in the app."
        items={currentMemberships}
        siblings={currentMemberships}
        loading={currentMembershipsQuery.isLoading}
        savingId={savingId}
        onToggleFuture={(membership, enabled) =>
          membershipMutation.mutate({
            id: membership.id,
            patch: { validForFutureEvents: enabled },
          })
        }
        onToggleQr={(membership, enabled) =>
          membershipMutation.mutate({
            id: membership.id,
            patch: { validForFutureQr: enabled },
          })
        }
        onChangeUpgrade={(membership, upgradeToMembershipId) =>
          membershipMutation.mutate({
            id: membership.id,
            patch: { upgradeToMembershipId },
          })
        }
      />

      {pastEventId ? (
        <MembershipAccessTable
          title={`Previous edition memberships (${pastEditions[0]?.startDate?.slice(0, 10) ?? 'past'})`}
          subtitle="Turn on “QR for future events” only for the membership types that should get a check-in QR on the new edition. Content can still use the event-wide toggle above."
          items={pastMemberships}
          siblings={pastMemberships}
          loading={pastMembershipsQuery.isLoading}
          savingId={savingId}
          onToggleFuture={(membership, enabled) =>
            membershipMutation.mutate({
              id: membership.id,
              patch: { validForFutureEvents: enabled },
            })
          }
          onToggleQr={(membership, enabled) =>
            membershipMutation.mutate({
              id: membership.id,
              patch: { validForFutureQr: enabled },
            })
          }
          onChangeUpgrade={(membership, upgradeToMembershipId) =>
            membershipMutation.mutate({
              id: membership.id,
              patch: { upgradeToMembershipId },
            })
          }
        />
      ) : (
        <p className="muted">
          No previous edition yet — future-event flags will apply after you schedule the next one.
        </p>
      )}

      <p className="hint" style={{ marginTop: 16 }}>
        Tip: create matching membership names on the new edition (e.g. both “VIP”) so carry-over
        can map correctly. You can also edit these fields on the{' '}
        <Link to="/memberships">Memberships</Link> page.
      </p>
    </div>
  );
}

function MembershipAccessTable({
  title,
  subtitle,
  items,
  siblings,
  loading,
  savingId,
  onToggleFuture,
  onToggleQr,
  onChangeUpgrade,
}: {
  title: string;
  subtitle: string;
  items: PublicMembership[];
  siblings: PublicMembership[];
  loading: boolean;
  savingId: string | null;
  onToggleFuture: (membership: PublicMembership, enabled: boolean) => void;
  onToggleQr: (membership: PublicMembership, enabled: boolean) => void;
  onChangeUpgrade: (
    membership: PublicMembership,
    upgradeToMembershipId: string | null,
  ) => void;
}) {
  return (
    <section className="panel" style={{ marginBottom: 24 }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <p className="muted">{subtitle}</p>
      {loading ? (
        <Spinner label="Loading memberships…" />
      ) : items.length === 0 ? (
        <p className="muted">
          No memberships for this edition. Add them on{' '}
          <Link to="/memberships">Memberships</Link>.
        </p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Membership</th>
                <th>Price</th>
                <th>Content for future events</th>
                <th>QR for future events</th>
                <th>Upgrade next level</th>
              </tr>
            </thead>
            <tbody>
              {items.map((membership) => {
                const busy = savingId === membership.id;
                return (
                  <tr key={membership.id}>
                    <td>
                      <strong>{membership.name}</strong>
                      {membership.featured ? (
                        <span className="hint"> · featured</span>
                      ) : null}
                    </td>
                    <td>${membership.price}</td>
                    <td>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={Boolean(membership.validForFutureEvents)}
                          disabled={busy}
                          onChange={(e) => onToggleFuture(membership, e.target.checked)}
                        />
                        Content
                      </label>
                    </td>
                    <td>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={Boolean(membership.validForFutureQr)}
                          disabled={busy}
                          onChange={(e) => onToggleQr(membership, e.target.checked)}
                        />
                        Check-in QR
                      </label>
                    </td>
                    <td>
                      <select
                        value={membership.upgradeToMembershipId ?? ''}
                        disabled={busy}
                        onChange={(e) =>
                          onChangeUpgrade(
                            membership,
                            e.target.value ? e.target.value : null,
                          )
                        }
                      >
                        <option value="">Auto (next higher only)</option>
                        {siblings
                          .filter((item) => item.id !== membership.id)
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {savingId ? <p className="hint">Saving…</p> : null}
    </section>
  );
}
