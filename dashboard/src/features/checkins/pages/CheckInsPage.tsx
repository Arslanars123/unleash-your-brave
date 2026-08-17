import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { UserCheck, X } from 'lucide-react';
import { checkInsApi } from '@/features/checkins/api/checkins-api';
import { EditionSwitcher } from '@/features/events/components/EditionSwitcher';
import {
  formatEditionRange,
  useEditionScope,
} from '@/features/events/hooks/useEditionScope';
import { MembershipRecordPanel } from '@/features/users/components/MembershipRecordPanel';
import { getApiErrorMessage } from '@/shared/api/client';
import { resolveMediaUrl } from '@/shared/lib/media';
import type { CheckInScanResult } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { ListPagination } from '@/shared/ui/ListPagination';
import { SearchSuggest } from '@/shared/ui/SearchSuggest';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

const PER_PAGE = 25;

export function CheckInsPage() {
  const { eventId, selectedEdition, isPastEdition } = useEditionScope();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'all' | 'checked_in' | 'not_checked_in'>('all');
  const [scanDetail, setScanDetail] = useState<CheckInScanResult | null>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: ['checkins', 'list', eventId, search, status, page],
    enabled: Boolean(eventId),
    queryFn: () =>
      checkInsApi.list({
        eventId: eventId!,
        search: search || undefined,
        status,
        page,
        perPage: PER_PAGE,
      }),
  });

  function applySearch(next: string) {
    setSearch(next);
    setPage(1);
  }

  useEffect(() => {
    setPage(1);
    setSearch('');
  }, [eventId]);

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
      setScanDetail(result);
      const name = result.user.name;
      if (result.alreadyCheckedIn) {
        toast.success(`${name} was already checked in`);
      } else {
        toast.success(`Checked in ${name}`);
      }
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Check-in failed'));
    },
  });

  const stats = listQuery.data?.stats;
  const checkedIn = stats?.checkedInCount ?? 0;
  const attendees = stats?.attendeeCount ?? 0;
  const membership = scanDetail?.membership;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="page-kicker">Door</span>
          <h1>Check-in</h1>
          <p className="muted">
            See who checked in for the current event. Switch to a past event to review that
            edition’s check-in list — each event keeps its own attendance record.
          </p>
        </div>
      </header>

      <EditionSwitcher
        label="Event"
        pastBannerTitle="Viewing past event check-ins"
        pastBannerBody={
          selectedEdition
            ? `${formatEditionRange(selectedEdition)} — attendance below is only for this past event. Use Back to current to return to today’s check-in.`
            : undefined
        }
        tipText="Use the Event dropdown to open a previous event and see its check-ins."
      />

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
            <div className="panel-header" style={{ marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>
                Attendees for{' '}
                {selectedEdition ? formatEditionRange(selectedEdition) : 'this event'}
              </h2>
              <span className={`status-pill ${isPastEdition ? 'status-scheduled' : 'status-published'}`}>
                {isPastEdition ? 'Past event' : 'Current event'}
              </span>
            </div>
            <p className="muted" style={{ marginTop: 0 }}>
              Filter by checked in / not checked in, or search by name and email.
            </p>
          </section>

          {!isPastEdition && scanDetail && membership ? (
            <section className="panel" style={{ marginBottom: 20 }}>
              <div className="attendee-detail-section">
                <h3 style={{ marginTop: 0 }}>Last check-in details</h3>
                <dl className="attendee-detail-grid" style={{ marginBottom: 12 }}>
                  <div className="attendee-detail-row">
                    <dt>Name</dt>
                    <dd>{scanDetail.user.name}</dd>
                  </div>
                  <div className="attendee-detail-row">
                    <dt>Email</dt>
                    <dd>{scanDetail.user.email}</dd>
                  </div>
                  <div className="attendee-detail-row">
                    <dt>Checked in</dt>
                    <dd>
                      {scanDetail.checkIn.checkedInAt
                        ? new Date(scanDetail.checkIn.checkedInAt).toLocaleString()
                        : '—'}
                      {scanDetail.alreadyCheckedIn ? ' (already checked in)' : ''}
                    </dd>
                  </div>
                  <div className="attendee-detail-row">
                    <dt>Membership at check-in</dt>
                    <dd>{membership.membershipNameAtCheckIn ?? '—'}</dd>
                  </div>
                  {membership.qrStatusLabel ? (
                    <div className="attendee-detail-row">
                      <dt>QR eligibility</dt>
                      <dd>
                        {membership.qrStatusLabel}
                        {membership.qrDeniedReason === 'renewal_payment_required' ? (
                          <span className="hint" style={{ display: 'block', marginTop: 4 }}>
                            Recurring payment still pending — QR not valid for this / next event
                            under the current access rule.
                          </span>
                        ) : null}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                <MembershipRecordPanel
                  summary={membership}
                  sourceLabel={
                    scanDetail.user.ghlContactId
                      ? 'GoHighLevel webhook'
                      : 'Manual / admin / Stripe'
                  }
                  ghlContactId={scanDetail.user.ghlContactId}
                  productTitle={scanDetail.user.title}
                />
              </div>
            </section>
          ) : null}

          <div className="toolbar">
            <SearchSuggest
              label="Search attendees"
              placeholder="Name or email"
              value={search}
              onChange={applySearch}
              loadSuggestions={async (draft) => {
                if (!eventId) return [];
                const result = await checkInsApi.list({
                  eventId,
                  search: draft,
                  status,
                  perPage: 6,
                });
                return result.items.map((row) => ({
                  id: row.userId,
                  title: row.user?.name ?? 'Attendee',
                  subtitle: row.user?.email,
                  leading: row.user?.photoUrl ? (
                    <img src={resolveMediaUrl(row.user.photoUrl)} alt="" />
                  ) : (
                    <span>{(row.user?.name ?? '?').charAt(0).toUpperCase()}</span>
                  ),
                }));
              }}
            />
            <label className="field">
              <span className="field-label">Status</span>
              <select
                className="field-input"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as 'all' | 'checked_in' | 'not_checked_in');
                  setPage(1);
                }}
              >
                <option value="all">All</option>
                <option value="checked_in">Checked in</option>
                <option value="not_checked_in">Not checked in</option>
              </select>
            </label>
          </div>
          {search ? (
            <div className="active-filter-chip">
              Showing results for “{search}”
              <button type="button" aria-label="Clear filter" onClick={() => applySearch('')}>
                <X size={14} />
              </button>
            </div>
          ) : null}

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
                            <div
                              className="user-chip"
                              style={{ padding: 0, background: 'transparent' }}
                            >
                              <span className="avatar">
                                {photo ? <img src={photo} alt="" /> : row.user?.name?.charAt(0) ?? '?'}
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
                              {row.checkedIn ? 'View details' : 'Check in'}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <ListPagination
                  page={listQuery.data.meta.page}
                  totalPages={listQuery.data.meta.totalPages}
                  total={listQuery.data.meta.total}
                  perPage={listQuery.data.meta.perPage}
                  onPageChange={setPage}
                  label="attendees"
                />
              </div>
            )
          ) : null}
        </>
      )}
    </div>
  );
}
