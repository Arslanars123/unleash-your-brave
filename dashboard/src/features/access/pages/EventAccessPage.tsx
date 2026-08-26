import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { eventsApi } from '@/features/events/api/events-api';
import { EditionSwitcher } from '@/features/events/components/EditionSwitcher';
import {
  formatEditionRange,
  useEditionScope,
} from '@/features/events/hooks/useEditionScope';
import { membershipsApi } from '@/features/memberships/api/memberships-api';
import { getApiErrorMessage } from '@/shared/api/client';
import type { EventFeatureAccess, PublicEvent, PublicMembership } from '@/shared/types/api';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

const DEFAULT_MEMBER_ACCESS: EventFeatureAccess = {
  viewAgenda: true,
  viewMaterials: true,
  submitReviews: true,
};

const DEFAULT_GUEST_ACCESS: EventFeatureAccess = {
  viewAgenda: false,
  viewMaterials: false,
  submitReviews: false,
};

function normalizeAccess(
  raw: EventFeatureAccess | undefined,
  defaults: EventFeatureAccess,
): EventFeatureAccess {
  return {
    viewAgenda: raw?.viewAgenda ?? defaults.viewAgenda,
    viewMaterials: raw?.viewMaterials ?? defaults.viewMaterials,
    submitReviews: raw?.submitReviews ?? defaults.submitReviews,
  };
}

async function enableContentOnMemberships(items: PublicMembership[]): Promise<number> {
  const targets = items.filter((item) => !item.validForFutureEvents);
  if (targets.length === 0) return 0;
  await Promise.all(
    targets.map((item) => membershipsApi.update(item.id, { validForFutureEvents: true })),
  );
  return targets.length;
}

async function disableContentOnMemberships(items: PublicMembership[]): Promise<number> {
  const targets = items.filter((item) => Boolean(item.validForFutureEvents));
  if (targets.length === 0) return 0;
  await Promise.all(
    targets.map((item) => membershipsApi.update(item.id, { validForFutureEvents: false })),
  );
  return targets.length;
}

function FeatureAccessPanel({
  title,
  subtitle,
  value,
  busy,
  onChange,
}: {
  title: string;
  subtitle: string;
  value: EventFeatureAccess;
  busy: boolean;
  onChange: (next: EventFeatureAccess) => void;
}) {
  return (
    <section className="panel" style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <p className="muted">{subtitle}</p>
      <label className="field" style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <input
          type="checkbox"
          checked={value.viewAgenda}
          disabled={busy}
          onChange={(e) => {
            const viewAgenda = e.target.checked;
            onChange({
              viewAgenda,
              viewMaterials: viewAgenda ? value.viewMaterials : false,
              submitReviews: viewAgenda ? value.submitReviews : false,
            });
          }}
          style={{ marginTop: 4 }}
        />
        <span>
          <strong>View agenda & session details</strong>
          <br />
          <span className="hint">Session list, times, speakers, and about text.</span>
        </span>
      </label>
      <label className="field" style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <input
          type="checkbox"
          checked={value.viewMaterials}
          disabled={busy || !value.viewAgenda}
          onChange={(e) => onChange({ ...value, viewMaterials: e.target.checked })}
          style={{ marginTop: 4 }}
        />
        <span>
          <strong>View session materials</strong>
          <br />
          <span className="hint">
            Resources / downloads on session details. Locked in the app when off.
          </span>
        </span>
      </label>
      <label className="field" style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <input
          type="checkbox"
          checked={value.submitReviews}
          disabled={busy || !value.viewAgenda}
          onChange={(e) => onChange({ ...value, submitReviews: e.target.checked })}
          style={{ marginTop: 4 }}
        />
        <span>
          <strong>Submit reviews</strong>
          <br />
          <span className="hint">
            Even when enabled, reviews only work after the event start date (upcoming stays locked).
          </span>
        </span>
      </label>
    </section>
  );
}

export function EventAccessPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const syncedEventRef = useRef<string | null>(null);
  const { eventId, selectedEdition } = useEditionScope();

  const workspaceQuery = useQuery({
    queryKey: ['events', 'workspace'],
    queryFn: () => eventsApi.getWorkspace(),
  });

  const editions = workspaceQuery.data?.editions ?? [];
  const current = workspaceQuery.data?.current ?? null;
  const pastEditions = workspaceQuery.data?.pastEditions ?? [];

  const scopedEvent: PublicEvent | null = useMemo(() => {
    if (!editions.length) return current;
    if (eventId) return editions.find((item) => item.id === eventId) ?? selectedEdition ?? current;
    return selectedEdition ?? current;
  }, [editions, eventId, selectedEdition, current]);

  const [memberAccess, setMemberAccess] = useState<EventFeatureAccess>(DEFAULT_MEMBER_ACCESS);
  const [guestAccess, setGuestAccess] = useState<EventFeatureAccess>(DEFAULT_GUEST_ACCESS);

  useEffect(() => {
    if (!scopedEvent) return;
    setMemberAccess(normalizeAccess(scopedEvent.memberFeatureAccess, DEFAULT_MEMBER_ACCESS));
    setGuestAccess(normalizeAccess(scopedEvent.guestFeatureAccess, DEFAULT_GUEST_ACCESS));
  }, [scopedEvent]);

  const currentMembershipsQuery = useQuery({
    queryKey: ['memberships', 'access', current?.id],
    queryFn: () => membershipsApi.list({ eventId: current!.id, page: 1, perPage: 100 }),
    enabled: Boolean(current?.id),
  });

  const pastEventId = pastEditions[0]?.id;
  const pastMembershipsQuery = useQuery({
    queryKey: ['memberships', 'access-past', pastEventId],
    queryFn: () => membershipsApi.list({ eventId: pastEventId!, page: 1, perPage: 100 }),
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
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to update membership')),
  });

  const eventAccessMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      await eventsApi.update(current!.id, { allowPreviousAttendeesAccess: enabled });

      const allMemberships = [
        ...(currentMembershipsQuery.data?.items ?? []),
        ...(pastMembershipsQuery.data?.items ?? []),
      ];

      if (enabled) {
        await enableContentOnMemberships(allMemberships);
      } else {
        await disableContentOnMemberships(allMemberships);
        syncedEventRef.current = null;
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
          : 'Content disabled — all membership Content flags cleared (QR unchanged)',
      );
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to update event access')),
  });

  const qrRenewalRuleMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      eventsApi.update(current!.id, { blockQrWhenRenewalUnpaid: enabled }),
    onSuccess: async (_, enabled) => {
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success(
        enabled
          ? 'Unpaid renewals will block check-in QR updates'
          : 'Check-in QR can update even when renewal payment is pending',
      );
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to update QR renewal rule')),
  });

  const featureAccessMutation = useMutation({
    mutationFn: (payload: {
      memberFeatureAccess: EventFeatureAccess;
      guestFeatureAccess: EventFeatureAccess;
    }) => eventsApi.update(scopedEvent!.id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Feature access saved for this edition');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to save feature access')),
  });

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

  if (!current && editions.length === 0) {
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
  const contentForAll = Boolean(current?.allowPreviousAttendeesAccess);
  const blockQrWhenRenewalUnpaid = current?.blockQrWhenRenewalUnpaid !== false;
  const savingId = membershipMutation.isPending
    ? (membershipMutation.variables?.id ?? null)
    : null;
  const eventBusy = eventAccessMutation.isPending;
  const qrRuleBusy = qrRenewalRuleMutation.isPending;
  const featureBusy = featureAccessMutation.isPending;
  const featureDirty =
    Boolean(scopedEvent) &&
    (JSON.stringify(memberAccess) !==
      JSON.stringify(normalizeAccess(scopedEvent?.memberFeatureAccess, DEFAULT_MEMBER_ACCESS)) ||
      JSON.stringify(guestAccess) !==
        JSON.stringify(normalizeAccess(scopedEvent?.guestFeatureAccess, DEFAULT_GUEST_ACCESS)));

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Event access</h1>
          <p className="muted">
            Configure agenda, materials, and reviews for each edition — for members and for people
            without a purchase. Locked items show a lock icon in the app.
          </p>
        </div>
      </header>

      <EditionSwitcher tipText="Pick past, live, or upcoming editions to set feature permissions." />

      {scopedEvent ? (
        <section className="panel" style={{ marginBottom: 24 }}>
          <h2 style={{ marginTop: 0 }}>Feature permissions</h2>
          <p className="muted">
            Edition: <strong>{formatEditionRange(scopedEvent)}</strong>
            {' · '}
            <span className="hint">{scopedEvent.status}</span>
          </p>

          <FeatureAccessPanel
            title="Attendees with membership / purchase for this edition"
            subtitle="People who bought a pass for this event, hold a linked membership, or carry previous-attendee content access."
            value={memberAccess}
            busy={featureBusy}
            onChange={setMemberAccess}
          />
          <FeatureAccessPanel
            title="Attendees without membership for this edition"
            subtitle="Everyone else. Turn options on only if you want to grant limited access without a purchase."
            value={guestAccess}
            busy={featureBusy}
            onChange={setGuestAccess}
          />

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={featureBusy || !featureDirty}
              onClick={() =>
                featureAccessMutation.mutate({
                  memberFeatureAccess: memberAccess,
                  guestFeatureAccess: guestAccess,
                })
              }
            >
              {featureBusy ? 'Saving…' : 'Save feature permissions'}
            </button>
            {!featureDirty ? <span className="hint">No unsaved changes</span> : null}
          </div>
        </section>
      ) : null}

      {current ? (
        <>
          <section className="panel" style={{ marginBottom: 24 }}>
            <h2 style={{ marginTop: 0 }}>New event — previous attendees</h2>
            <p className="muted">
              Preferred / current edition: <strong>{current.name}</strong> ({current.status})
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
                  When enabled, Content is turned on for <strong>all</strong> memberships below.
                  Feature permissions above still apply to what they can open.
                </span>
              </span>
            </label>
            {eventBusy ? <p className="hint">Saving content access for all memberships…</p> : null}
          </section>

          <section className="panel" style={{ marginBottom: 24 }}>
            <h2 style={{ marginTop: 0 }}>Recurring membership — QR after expiry</h2>
            <p className="muted">
              Controls whether unpaid or expired renewable plans can receive an updated check-in QR.
            </p>
            <label className="field" style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <input
                type="checkbox"
                checked={blockQrWhenRenewalUnpaid}
                disabled={qrRuleBusy}
                onChange={(e) => qrRenewalRuleMutation.mutate(e.target.checked)}
                style={{ marginTop: 4 }}
              />
              <span>
                <strong>
                  Block QR updates when renewal payment is unpaid or membership is expired
                </strong>
              </span>
            </label>
            {qrRuleBusy ? <p className="hint">Saving QR renewal rule…</p> : null}
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
              subtitle="Turn on “QR for future events” only for the membership types that should get a check-in QR."
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
        </>
      ) : null}

      <p className="hint" style={{ marginTop: 16 }}>
        Tip: create matching membership names on the new edition (e.g. both “VIP”) so carry-over can
        map correctly. You can also edit these fields on the{' '}
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
          No memberships for this edition. Add them on <Link to="/memberships">Memberships</Link>.
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
                      {membership.featured ? <span className="hint"> · featured</span> : null}
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
                        {contentLockedOn ? <span className="hint"> (all attendees)</span> : null}
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
                          onChangeUpgrade(membership, e.target.value ? e.target.value : null)
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
