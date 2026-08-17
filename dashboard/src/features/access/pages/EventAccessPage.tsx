import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { eventsApi } from '@/features/events/api/events-api';
import { membershipsApi } from '@/features/memberships/api/memberships-api';
import { getApiErrorMessage } from '@/shared/api/client';
import type { PublicMembership } from '@/shared/types/api';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

async function enableContentOnMemberships(items: PublicMembership[]): Promise<number> {
  const targets = items.filter((item) => !item.validForFutureEvents);
  if (targets.length === 0) return 0;
  await Promise.all(
    targets.map((item) => membershipsApi.update(item.id, { validForFutureEvents: true })),
  );
  return targets.length;
}

export function EventAccessPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const syncedEventRef = useRef<string | null>(null);

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

  const eventAccessMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      await eventsApi.update(current!.id, { allowPreviousAttendeesAccess: enabled });

      // When content is enabled for all previous attendees, mark every membership’s
      // Content flag on as well. QR stays independent — never auto-enabled.
      if (enabled) {
        await enableContentOnMemberships([
          ...(currentMembershipsQuery.data?.items ?? []),
          ...(pastMembershipsQuery.data?.items ?? []),
        ]);
      }
    },
    onSuccess: async (_, enabled) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['events'] }),
        queryClient.invalidateQueries({ queryKey: ['memberships'] }),
      ]);
      toast.success(
        enabled
          ? 'Content enabled for all attendees — membership Content flags updated (QR unchanged)'
          : 'Event content access setting saved',
      );
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, 'Unable to update event access')),
  });

  // If content-for-all is already on, sync any membership Content boxes that are still off.
  useEffect(() => {
    if (!current?.id || !current.allowPreviousAttendeesAccess) return;
    if (currentMembershipsQuery.isLoading || pastMembershipsQuery.isLoading) return;
    if (syncedEventRef.current === current.id) return;

    const all = [
      ...(currentMembershipsQuery.data?.items ?? []),
      ...(pastMembershipsQuery.data?.items ?? []),
    ];
    if (all.length === 0) return;

    const needsSync = all.some((item) => !item.validForFutureEvents);
    syncedEventRef.current = current.id;
    if (!needsSync) return;

    void enableContentOnMemberships(all)
      .then(async (updated) => {
        if (updated > 0) {
          await queryClient.invalidateQueries({ queryKey: ['memberships'] });
        }
      })
      .catch(() => {
        syncedEventRef.current = null;
      });
  }, [
    current?.id,
    current?.allowPreviousAttendeesAccess,
    currentMembershipsQuery.isLoading,
    currentMembershipsQuery.data?.items,
    pastMembershipsQuery.isLoading,
    pastMembershipsQuery.data?.items,
    queryClient,
  ]);

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
  const contentForAll = Boolean(current.allowPreviousAttendeesAccess);
  const savingId = membershipMutation.isPending
    ? (membershipMutation.variables?.id ?? null)
    : null;
  const eventBusy = eventAccessMutation.isPending;

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
            checked={contentForAll}
            disabled={eventBusy}
            onChange={(e) => eventAccessMutation.mutate(e.target.checked)}
            style={{ marginTop: 4 }}
          />
          <span>
            <strong>Allow previous attendees to access this event’s content</strong>
            <br />
            <span className="hint">
              When enabled, Content is turned on for <strong>all</strong> memberships below
              automatically. Check-in QR is <strong>not</strong> enabled — select QR only on the
              membership types you want.
            </span>
          </span>
        </label>
        {eventBusy ? <p className="hint">Saving content access for all memberships…</p> : null}
      </section>

      <MembershipAccessTable
        title="Current edition memberships"
        subtitle="Content follows the “all attendees” toggle above when it is on. QR is always selected per membership."
        items={currentMemberships}
        siblings={currentMemberships}
        loading={currentMembershipsQuery.isLoading}
        savingId={savingId}
        contentLockedOn={contentForAll}
        busy={eventBusy}
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
          subtitle="Turn on “QR for future events” only for the membership types that should get a check-in QR. Content is selected for all when the event-wide toggle is on."
          items={pastMemberships}
          siblings={pastMemberships}
          loading={pastMembershipsQuery.isLoading}
          savingId={savingId}
          contentLockedOn={contentForAll}
          busy={eventBusy}
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
  contentLockedOn,
  busy,
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
  /** When event-wide content is on, every Content box shows checked and is locked. */
  contentLockedOn: boolean;
  busy?: boolean;
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
                const rowBusy = busy || savingId === membership.id;
                const contentChecked =
                  contentLockedOn || Boolean(membership.validForFutureEvents);
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
                          checked={contentChecked}
                          disabled={rowBusy || contentLockedOn}
                          onChange={(e) => onToggleFuture(membership, e.target.checked)}
                        />
                        Content
                        {contentLockedOn ? (
                          <span className="hint"> (all attendees)</span>
                        ) : null}
                      </label>
                    </td>
                    <td>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={Boolean(membership.validForFutureQr)}
                          disabled={rowBusy}
                          onChange={(e) => onToggleQr(membership, e.target.checked)}
                        />
                        Check-in QR
                      </label>
                    </td>
                    <td>
                      <select
                        value={membership.upgradeToMembershipId ?? ''}
                        disabled={rowBusy}
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
      {savingId && !busy ? <p className="hint">Saving…</p> : null}
    </section>
  );
}
