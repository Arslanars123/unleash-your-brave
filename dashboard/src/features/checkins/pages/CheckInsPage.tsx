import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ClipboardList, QrCode, UserCheck, X } from 'lucide-react';
import { CheckInFormEditorModal } from '@/features/checkin-forms/components/CheckInFormEditorModal';
import {
  CheckInFormGateModal,
  type CheckInFormGateValues,
} from '@/features/checkin-forms/components/CheckInFormGateModal';
import { checkInsApi } from '@/features/checkins/api/checkins-api';
import { CheckInScanner } from '@/features/checkins/components/CheckInScanner';
import { EditionSwitcher } from '@/features/events/components/EditionSwitcher';
import {
  formatEditionRange,
  useEditionScope,
} from '@/features/events/hooks/useEditionScope';
import { MembershipRecordPanel } from '@/features/users/components/MembershipRecordPanel';
import { getApiErrorMessage } from '@/shared/api/client';
import { resolveMediaUrl } from '@/shared/lib/media';
import type { CheckInScanResult, PublicCheckInForm } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { ListPagination } from '@/shared/ui/ListPagination';
import { SearchSuggest } from '@/shared/ui/SearchSuggest';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

const PER_PAGE = 25;

interface PendingFormScan {
  form: PublicCheckInForm;
  userName: string;
  scanPayload: {
    token?: string;
    userId?: string;
    eventId?: string;
  };
}

export function CheckInsPage() {
  const { eventId, selectedEdition, isPastEdition, isNonCurrentEdition } = useEditionScope();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'all' | 'checked_in' | 'not_checked_in'>('all');
  const [token, setToken] = useState('');
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [scanDetail, setScanDetail] = useState<CheckInScanResult | null>(null);
  const [formEditorOpen, setFormEditorOpen] = useState(false);
  const [pendingFormScan, setPendingFormScan] = useState<PendingFormScan | null>(null);
  const pendingPayloadRef = useRef<PendingFormScan['scanPayload'] | null>(null);
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

  function applyScanSuccess(result: CheckInScanResult) {
    setScanDetail(result);
    setPendingFormScan(null);
    pendingPayloadRef.current = null;
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
  }

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
    onSuccess: async (result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['checkins'] });
      if (result.requiresForm && result.form) {
        const pending = {
          form: result.form,
          userName: result.user.name,
          scanPayload: variables,
        };
        pendingPayloadRef.current = variables;
        setPendingFormScan(pending);
        setLastResult(`Form required for ${result.user.name}`);
        return;
      }
      applyScanSuccess(result);
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, 'Check-in failed');
      setLastResult(message);
      toast.error(message);
    },
  });

  const completeFormMutation = useMutation({
    mutationFn: (values: CheckInFormGateValues) => {
      const scanPayload = pendingPayloadRef.current ?? pendingFormScan?.scanPayload ?? {};
      return checkInsApi.completeWithForm({
        ...scanPayload,
        expectedEventId: eventId ?? undefined,
        answers: values.answers,
        signatureDataUrl: values.signatureDataUrl,
        signedName: values.signedName,
      });
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['checkins'] });
      applyScanSuccess(result);
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, 'Unable to complete check-in form');
      setLastResult(message);
      toast.error(message);
    },
  });

  const handleTokenScan = useCallback(
    (raw: string) => {
      const token = raw.trim();
      if (!token || scanMutation.isPending || completeFormMutation.isPending) return;
      scanMutation.mutate({ token });
    },
    [scanMutation.isPending, scanMutation.mutate, completeFormMutation.isPending],
  );

  const stats = listQuery.data?.stats;
  const checkedIn = stats?.checkedInCount ?? 0;
  const attendees = stats?.attendeeCount ?? 0;
  const membership = scanDetail?.membership;
  const editionStatus = selectedEdition?.status;
  const checkInOpen = editionStatus === 'live';
  const isUpcomingEdition = editionStatus === 'upcoming';
  const isPausedEdition = editionStatus === 'paused';
  const editionLabel = isPastEdition
    ? 'Past edition'
    : isUpcomingEdition
      ? 'Upcoming edition'
      : isPausedEdition
        ? 'Paused edition'
        : isNonCurrentEdition
          ? 'Other edition'
          : 'Current edition';

  const handleTokenScanGated = useCallback(
    (raw: string) => {
      if (!checkInOpen) {
        const message = isUpcomingEdition
          ? 'Check-in will be available when the event starts.'
          : isPastEdition
            ? 'Check-in is closed for this past event.'
            : 'Check-in is not available for this event.';
        setLastResult(message);
        toast.error(message);
        return;
      }
      handleTokenScan(raw);
    },
    [checkInOpen, handleTokenScan, isUpcomingEdition, isPastEdition, toast],
  );
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="page-kicker">Door</span>
          <h1>Check-in</h1>
          <p className="muted">
            See who checked in for the selected event. Switch editions to review another
            gathering’s attendance — each event keeps its own record.
          </p>
        </div>
        {eventId ? (
          <div className="page-header-actions">
            <Button variant="secondary" onClick={() => setFormEditorOpen(true)}>
              <ClipboardList size={16} />
              Check-in form
            </Button>
          </div>
        ) : null}
      </header>

      <EditionSwitcher
        label="Event"
        pastBannerTitle="Viewing past event check-ins"
        pastBannerBody={
          selectedEdition
            ? `${formatEditionRange(selectedEdition)} — attendance below is only for this edition. Use Back to current to return to today’s check-in.`
            : undefined
        }
        tipText="Use the Event dropdown to open another edition and see its check-ins."
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
              <span className="muted">{editionLabel}</span>
            </div>
          </div>

          <section className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-header" style={{ marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>
                Attendees for{' '}
                {selectedEdition ? formatEditionRange(selectedEdition) : 'this event'}
              </h2>
              <span
                className={`status-pill ${
                  checkInOpen
                    ? 'status-published'
                    : isUpcomingEdition
                      ? 'status-scheduled'
                      : 'status-draft'
                }`}
              >
                {isPastEdition
                  ? 'Past event'
                  : isUpcomingEdition
                    ? 'Upcoming'
                    : isPausedEdition
                      ? 'Paused'
                      : checkInOpen
                        ? 'Check-in open'
                        : isNonCurrentEdition
                          ? 'Other edition'
                          : 'Current event'}
              </span>
            </div>
            <p className="muted" style={{ marginTop: 0 }}>
              Filter by checked in / not checked in, or search by name and email.
            </p>
          </section>

          {checkInOpen ? (
            <section className="panel" style={{ marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>
                <QrCode size={16} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} />
                Scan QR
              </h2>
              <p className="muted" style={{ marginTop: 6 }}>
                Attendees open their event QR in the app. Scan it here, or paste the token if the
                camera is unavailable. If a check-in form is active, you’ll complete it before the
                check-in is recorded.
              </p>
              <CheckInScanner
                onScan={handleTokenScanGated}
                disabled={scanMutation.isPending || completeFormMutation.isPending}
              />
              <form
                className="toolbar"
                style={{ marginTop: 12 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!token.trim()) return;
                  handleTokenScanGated(token);
                }}
              >
                <Input
                  label="Or paste QR token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="uyb1...."
                />
                <Button
                  type="submit"
                  loading={scanMutation.isPending}
                  disabled={!token.trim() || completeFormMutation.isPending}
                >
                  <UserCheck size={16} />
                  Check in
                </Button>
              </form>
              {lastResult ? <p className="hint">{lastResult}</p> : null}

              {scanDetail && membership && scanDetail.checkIn ? (
                <div className="attendee-detail-section" style={{ marginTop: 16 }}>
                  <h3 style={{ marginTop: 0 }}>Last scan details</h3>
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
                    productTitle={scanDetail.user.title}
                  />
                </div>
              ) : null}
            </section>
          ) : (
            <section className="panel" style={{ marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>
                <QrCode size={16} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} />
                Scan QR
              </h2>
              <p className="form-error" style={{ marginBottom: 0 }}>
                {isUpcomingEdition
                  ? 'Check-in will be available when the event starts.'
                  : isPastEdition
                    ? 'Check-in is closed for this past event.'
                    : isPausedEdition
                      ? 'Check-in is paused for this event.'
                      : 'Check-in is not available for this event.'}
              </p>
            </section>
          )}

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
                            <Button
                              variant="secondary"
                              disabled={
                                scanMutation.isPending ||
                                completeFormMutation.isPending ||
                                (!row.checkedIn && !checkInOpen)
                              }
                              title={
                                !row.checkedIn && !checkInOpen
                                  ? isUpcomingEdition
                                    ? 'Check-in will be available when the event starts.'
                                    : 'Check-in is not available for this event.'
                                  : undefined
                              }
                              onClick={() => {
                                if (!row.checkedIn && !checkInOpen) {
                                  const message = isUpcomingEdition
                                    ? 'Check-in will be available when the event starts.'
                                    : isPastEdition
                                      ? 'Check-in is closed for this past event.'
                                      : 'Check-in is not available for this event.';
                                  toast.error(message);
                                  return;
                                }
                                void scanMutation.mutateAsync({
                                  eventId: eventId,
                                  userId: row.userId,
                                });
                              }}
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

      {eventId ? (
        <CheckInFormEditorModal
          open={formEditorOpen}
          eventId={eventId}
          onClose={() => setFormEditorOpen(false)}
        />
      ) : null}

      {pendingFormScan ? (
        <CheckInFormGateModal
          open
          form={pendingFormScan.form}
          attendeeName={pendingFormScan.userName}
          loading={completeFormMutation.isPending}
          onClose={() => {
            setPendingFormScan(null);
            pendingPayloadRef.current = null;
          }}
          onSubmit={async (values) => {
            await completeFormMutation.mutateAsync(values);
          }}
        />
      ) : null}
    </div>
  );
}
