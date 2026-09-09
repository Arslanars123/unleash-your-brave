import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { QrCode, UserCheck } from 'lucide-react';
import {
  CheckInFormGateModal,
  type CheckInFormGateValues,
} from '@/features/checkin-forms/components/CheckInFormGateModal';
import { checkInsApi } from '@/features/checkins/api/checkins-api';
import { CheckInScanDetailsModal } from '@/features/checkins/components/CheckInScanDetailsModal';
import { CheckInScanner } from '@/features/checkins/components/CheckInScanner';
import { eventsApi } from '@/features/events/api/events-api';
import { formatEditionRange } from '@/features/events/hooks/useEditionScope';
import { getApiErrorMessage } from '@/shared/api/client';
import { formatUsDateTime } from '@/shared/lib/datetime';
import { resolveMediaUrl } from '@/shared/lib/media';
import type { CheckInScanResult, PublicCheckInForm } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { ListPagination } from '@/shared/ui/ListPagination';
import { SearchSuggest } from '@/shared/ui/SearchSuggest';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

const PER_PAGE = 20;

interface PendingFormScan {
  form: PublicCheckInForm;
  userName: string;
  scanPayload: {
    token?: string;
    userId?: string;
    eventId?: string;
  };
}

interface AwaitingAttendeeForm {
  userId: string;
  userName: string;
  eventId: string;
  token?: string;
}

export function TeamCheckInsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'all' | 'checked_in' | 'not_checked_in'>('all');
  const [scanDetail, setScanDetail] = useState<CheckInScanResult | null>(null);
  const [scanDetailsOpen, setScanDetailsOpen] = useState(false);
  const [scannerResetKey, setScannerResetKey] = useState(0);
  const [scanHold, setScanHold] = useState(false);
  const [pendingFormScan, setPendingFormScan] = useState<PendingFormScan | null>(null);
  const [awaitingAttendee, setAwaitingAttendee] = useState<AwaitingAttendeeForm | null>(null);
  const pendingPayloadRef = useRef<PendingFormScan['scanPayload'] | null>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  const workspaceQuery = useQuery({
    queryKey: ['events', 'workspace', 'team'],
    queryFn: () => eventsApi.getWorkspace(),
  });

  const current = (() => {
    const workspace = workspaceQuery.data;
    if (!workspace) return null;
    const editions = [
      workspace.current,
      ...(workspace.upcomingEditions ?? []),
      ...(workspace.editions ?? []),
    ].filter(Boolean);
    const published = editions.filter((event) => event && event.published !== false);
    const live = published.find((event) => event?.status === 'live');
    if (live) return live;
    const upcoming = published
      .filter((event) => event?.status === 'upcoming')
      .sort(
        (a, b) =>
          new Date(a!.startDate).getTime() - new Date(b!.startDate).getTime(),
      );
    return upcoming[0] ?? (workspace.current?.published !== false ? workspace.current : null);
  })();
  const eventId = current?.id;
  const checkInOpen = current?.status === 'live';
  const isUpcoming = current?.status === 'upcoming';

  const listQuery = useQuery({
    queryKey: ['checkins', 'team-list', eventId, search, status, page],
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

  function openScanDetails(result: CheckInScanResult) {
    if (!result.checkIn || !result.membership) return;
    setScanDetail(result);
    setScanDetailsOpen(true);
  }

  function applyScanSuccess(result: CheckInScanResult, options?: { holdScanner?: boolean }) {
    setPendingFormScan(null);
    setAwaitingAttendee(null);
    pendingPayloadRef.current = null;
    openScanDetails(result);
    if (result.alreadyCheckedIn) {
      if (options?.holdScanner) setScanHold(true);
      return;
    }
    toast.success(`Checked in ${result.user.name}`);
    setScanHold(false);
    setScannerResetKey((value) => value + 1);
  }

  const scanMutation = useMutation({
    mutationFn: (payload: {
      token?: string;
      userId?: string;
      eventId?: string;
      source?: 'qr' | 'manual';
      poll?: boolean;
    }) =>
      checkInsApi.scan({
        ...payload,
        expectedEventId: eventId ?? undefined,
      }),
    onSuccess: (result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['checkins'] });

      if (variables.poll && !result.requiresForm && (result.checkIn || result.alreadyCheckedIn)) {
        applyScanSuccess(result);
        return;
      }
      if (
        variables.poll &&
        !result.requiresForm &&
        !result.checkIn &&
        !result.alreadyCheckedIn
      ) {
        setAwaitingAttendee(null);
        setPendingFormScan(null);
        pendingPayloadRef.current = null;
        setScanHold(false);
        setScannerResetKey((value) => value + 1);
        return;
      }

      if (result.requiresForm && result.form && result.awaitingAttendeeForm) {
        setAwaitingAttendee({
          userId: result.user.id,
          userName: result.user.name,
          eventId: result.eventId || eventId || '',
          token: variables.token,
        });
        setScanHold(true);
        if (!variables.poll) {
          toast.success(`Ask ${result.user.name} to complete the form in the app`);
        }
        return;
      }

      if (result.requiresForm && result.form && !result.awaitingAttendeeForm) {
        const scanPayload = {
          token: variables.token,
          userId: result.user.id || variables.userId,
          eventId: result.eventId || eventId || undefined,
        };
        pendingPayloadRef.current = scanPayload;
        setPendingFormScan({
          form: result.form,
          userName: result.user.name,
          scanPayload,
        });
        setScanHold(true);
        return;
      }

      applyScanSuccess(result, { holdScanner: variables.source === 'qr' });
    },
    onError: (error, variables) => {
      if (variables.poll) return;
      toast.error(getApiErrorMessage(error, 'Check-in failed'));
      setScannerResetKey((value) => value + 1);
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
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['checkins'] });
      applyScanSuccess(result);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Unable to complete check-in form'));
      setScannerResetKey((value) => value + 1);
    },
  });

  useEffect(() => {
    if (!awaitingAttendee) return;
    const handle = window.setInterval(() => {
      if (scanMutation.isPending || completeFormMutation.isPending) return;
      scanMutation.mutate({
        userId: awaitingAttendee.userId,
        eventId: awaitingAttendee.eventId || eventId || undefined,
        token: awaitingAttendee.token,
        source: 'qr',
        poll: true,
      });
    }, 2000);
    return () => window.clearInterval(handle);
  }, [
    awaitingAttendee,
    eventId,
    scanMutation.isPending,
    completeFormMutation.isPending,
    scanMutation.mutate,
  ]);

  const handleTokenScan = useCallback(
    (raw: string) => {
      const token = raw.trim();
      if (!token || scanHold || scanMutation.isPending || completeFormMutation.isPending) return;
      if (!checkInOpen) {
        toast.error(
          isUpcoming
            ? 'Check-in opens on the event start date — not before.'
            : 'Check-in is not available for this event.',
        );
        return;
      }
      scanMutation.mutate({ token, source: 'qr' });
    },
    [
      scanHold,
      scanMutation.isPending,
      completeFormMutation.isPending,
      checkInOpen,
      isUpcoming,
      scanMutation,
      toast,
    ],
  );

  function ensureOpen(): boolean {
    if (checkInOpen) return true;
    toast.error(
      isUpcoming
        ? 'Check-in opens on the event start date — not before.'
        : 'Check-in is not available for this event.',
    );
    return false;
  }

  const stats = listQuery.data?.stats;
  const items = listQuery.data?.items ?? [];
  const meta = listQuery.data?.meta;

  if (workspaceQuery.isLoading) {
    return <Spinner label="Loading current event…" />;
  }

  if (!current) {
    return (
      <div className="team-page">
        <div className="team-card">
          <h1>No current event</h1>
          <p className="muted">Ask an admin to publish the event before desk check-in can start.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="team-page">
      <header className="team-page-header">
        <p className="team-page-kicker">Current event</p>
        <h1>{current.name}</h1>
        <p className="muted">
          {formatEditionRange(current.startDate, current.endDate)}
          {current.venueCity ? ` · ${current.venueCity}` : ''}
        </p>
        <div className="team-status-row">
          <span className={`status-pill status-${current.status}`}>{current.status}</span>
          <span className="team-stat">
            <UserCheck size={16} />
            {stats?.checkedInCount ?? 0} / {stats?.attendeeCount ?? 0} checked in
          </span>
        </div>
        {!checkInOpen ? (
          <p className="team-banner">
            {isUpcoming
              ? 'Check-in opens on the event start date — not before.'
              : 'Check-in is closed for this event.'}
          </p>
        ) : null}
      </header>

      <section className="team-card">
        <h2>
          <QrCode size={18} /> Scan QR
        </h2>
        <CheckInScanner
          onScan={handleTokenScan}
          disabled={!checkInOpen}
          paused={scanHold || scanMutation.isPending || Boolean(pendingFormScan)}
          resetKey={scannerResetKey}
        />
        {awaitingAttendee ? (
          <p className="muted">Waiting for {awaitingAttendee.userName} to finish the waiver…</p>
        ) : null}
      </section>

      <section className="team-card">
        <div className="team-list-toolbar">
          <SearchSuggest
            label="Search attendees"
            placeholder="Name or email…"
            value={search}
            onChange={(next) => {
              setSearch(next);
              setPage(1);
            }}
          />
          <div className="team-filter-row">
            {(
              [
                ['all', 'All'],
                ['checked_in', 'Checked in'],
                ['not_checked_in', 'Not yet'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`team-chip${status === value ? ' active' : ''}`}
                onClick={() => {
                  setStatus(value);
                  setPage(1);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {listQuery.isLoading ? (
          <Spinner label="Loading attendees…" />
        ) : items.length === 0 ? (
          <p className="muted">No attendees match this filter.</p>
        ) : (
          <ul className="team-attendee-list">
            {items.map((row) => {
              const name = row.user?.fullName || row.user?.name || row.user?.email || 'Attendee';
              const photo = row.user?.photoUrl ? resolveMediaUrl(row.user.photoUrl) : '';
              return (
                <li key={row.id} className="team-attendee-row">
                  <div className="team-attendee-main">
                    {photo ? (
                      <img src={photo} alt="" className="team-attendee-avatar" />
                    ) : (
                      <span className="team-attendee-avatar placeholder">{name.slice(0, 1)}</span>
                    )}
                    <div>
                      <strong>{name}</strong>
                      <p className="muted">{row.user?.email}</p>
                      {row.checkedIn ? (
                        <p className="team-checked-meta">
                          Checked in {row.checkedInAt ? formatUsDateTime(row.checkedInAt) : ''}
                        </p>
                      ) : (
                        <p className="team-checked-meta">Not checked in</p>
                      )}
                    </div>
                  </div>
                  {row.checkedIn ? (
                    <Button
                      variant="secondary"
                      disabled={scanMutation.isPending}
                      onClick={() =>
                        scanMutation.mutate({
                          userId: row.userId,
                          eventId: eventId || undefined,
                          source: 'manual',
                        })
                      }
                    >
                      Details
                    </Button>
                  ) : (
                    <Button
                      disabled={!checkInOpen || scanMutation.isPending}
                      onClick={() => {
                        if (!ensureOpen()) return;
                        scanMutation.mutate({
                          userId: row.userId,
                          eventId: eventId || undefined,
                          source: 'manual',
                        });
                      }}
                    >
                      Check in
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {meta ? (
          <ListPagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            onPageChange={setPage}
          />
        ) : null}
      </section>

      <CheckInScanDetailsModal
        open={scanDetailsOpen}
        result={scanDetail}
        preferredEventId={eventId}
        onClose={() => {
          setScanDetailsOpen(false);
          setScanHold(false);
          setScannerResetKey((value) => value + 1);
        }}
        onScanNew={() => {
          setScanDetailsOpen(false);
          setScanHold(false);
          setScannerResetKey((value) => value + 1);
        }}
      />

      {pendingFormScan ? (
        <CheckInFormGateModal
          open
          form={pendingFormScan.form}
          attendeeName={pendingFormScan.userName}
          loading={completeFormMutation.isPending}
          onClose={() => {
            setPendingFormScan(null);
            pendingPayloadRef.current = null;
            setScanHold(false);
            setScannerResetKey((value) => value + 1);
          }}
          onSubmit={(values) => void completeFormMutation.mutateAsync(values)}
        />
      ) : null}
    </div>
  );
}
