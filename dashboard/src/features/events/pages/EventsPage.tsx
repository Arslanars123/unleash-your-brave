import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CalendarPlus, MapPin, Pencil } from 'lucide-react';
import { eventsApi } from '@/features/events/api/events-api';
import { EventFormModal } from '@/features/events/components/EventFormModal';
import { CANONICAL_EVENT_NAME } from '@/features/events/constants';
import { formatEditionRange } from '@/features/events/hooks/useEditionScope';
import { getApiErrorMessage } from '@/shared/api/client';
import { resolveMediaUrl } from '@/shared/lib/media';
import type {
  EventEditionStatus,
  EventPayload,
  PublicEvent,
  ScheduleEventPayload,
} from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { useConfirm } from '@/shared/ui/ConfirmDialog';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

function formatEventDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function statusLabel(status: EventEditionStatus): string {
  if (status === 'live') return 'Live';
  if (status === 'ended') return 'Ended';
  if (status === 'paused') return 'Paused';
  return 'Upcoming';
}

export function EventsPage() {
  const [editOpen, setEditOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();
  const { confirm } = useConfirm();

  const workspaceQuery = useQuery({
    queryKey: ['events', 'workspace'],
    queryFn: () => eventsApi.getWorkspace(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: EventPayload }) =>
      eventsApi.update(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event updated');
      setEditOpen(false);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to update event')),
  });

  const scheduleMutation = useMutation({
    mutationFn: (payload: ScheduleEventPayload) => eventsApi.schedule(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['events'] }),
        queryClient.invalidateQueries({ queryKey: ['speakers'] }),
        queryClient.invalidateQueries({ queryKey: ['sessions'] }),
        queryClient.invalidateQueries({ queryKey: ['sponsors'] }),
      ]);
      toast.success('New event edition scheduled');
      setScheduleOpen(false);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to schedule event')),
  });

  async function handleEditSubmit(payload: EventPayload | ScheduleEventPayload) {
    const event = workspaceQuery.data?.current;
    if (!event) return;
    const ok = await confirm({
      title: 'Save event changes?',
      message: `Update “${event.name}”?${
        (payload as EventPayload).notifyAttendees !== false
          ? ' Attendees will be notified if you paused/resumed the event or changed dates.'
          : ''
      }`,
      confirmLabel: 'Save changes',
      tone: 'primary',
    });
    if (!ok) return;
    await updateMutation.mutateAsync({ id: event.id, payload: payload as EventPayload });
  }

  async function handleScheduleSubmit(payload: EventPayload | ScheduleEventPayload) {
    const ok = await confirm({
      title: 'Schedule new edition?',
      message:
        'Create a new event edition with the details you entered? Attendees will get a push about the new dates unless you turned notifications off.',
      confirmLabel: 'Schedule',
      tone: 'primary',
    });
    if (!ok) return;
    await scheduleMutation.mutateAsync(payload as ScheduleEventPayload);
  }

  const workspace = workspaceQuery.data;
  const event = workspace?.current ?? null;
  const canSchedule = workspace?.canScheduleNew ?? false;
  const scheduleBlockedReason = workspace?.scheduleBlockedReason;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Event</h1>
          <p className="muted">
            Manage the current {CANONICAL_EVENT_NAME} edition. Schedule the next one only after
            dates have passed — speakers, sessions, and sponsors stay with each edition.
          </p>
        </div>
        <div className="page-header-actions">
          {event ? (
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil size={16} />
              Edit details
            </Button>
          ) : null}
          <Button
            onClick={() => setScheduleOpen(true)}
            disabled={!canSchedule && Boolean(event)}
            title={
              !canSchedule && scheduleBlockedReason ? scheduleBlockedReason : 'Schedule new event'
            }
          >
            <CalendarPlus size={16} />
            Schedule new event
          </Button>
        </div>
      </header>

      {workspaceQuery.isLoading ? <Spinner /> : null}
      {workspaceQuery.isError ? (
        <p className="form-error">{getApiErrorMessage(workspaceQuery.error)}</p>
      ) : null}

      {!workspaceQuery.isLoading && !event ? (
        <div className="empty-state">
          <CalendarDays size={28} />
          <h2>No event scheduled yet</h2>
          <p className="muted">
            Schedule the first {CANONICAL_EVENT_NAME} edition to get started.
          </p>
          <Button onClick={() => setScheduleOpen(true)}>
            <CalendarPlus size={16} />
            Schedule new event
          </Button>
        </div>
      ) : null}

      {event ? (
        <EventSummaryCard
          event={event}
          canSchedule={canSchedule}
          scheduleBlockedReason={scheduleBlockedReason}
          onEdit={() => setEditOpen(true)}
          onSchedule={() => setScheduleOpen(true)}
        />
      ) : null}

      {workspace?.pastEditions && workspace.pastEditions.length > 0 ? (
        <section className="past-editions">
          <h2>Past editions</h2>
          <p className="muted">
            Open speakers, sessions, or sponsors for any past edition (fully editable by admin).
          </p>
          <ul className="past-editions-list">
            {workspace.pastEditions.map((edition) => (
              <li key={edition.id}>
                <div>
                  <strong>{formatEditionRange(edition)}</strong>
                  <span className="muted">
                    {edition.dayCount} {edition.dayCount === 1 ? 'day' : 'days'}
                    {edition.venueCity ? ` · ${edition.venueCity}` : ''}
                  </span>
                  <div className="past-edition-links">
                    <Link to={`/speakers?edition=${edition.id}`}>Speakers</Link>
                    <Link to={`/sessions?edition=${edition.id}`}>Sessions</Link>
                    <Link to={`/sponsors?edition=${edition.id}`}>Sponsors</Link>
                  </div>
                </div>
                <span className="badge role-member">{statusLabel(edition.status)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!canSchedule && event && scheduleBlockedReason ? (
        <p className="hint schedule-gate-hint">{scheduleBlockedReason}</p>
      ) : null}

      {event ? (
        <EventFormModal
          open={editOpen}
          mode="edit"
          initialEvent={event}
          loading={updateMutation.isPending}
          onClose={() => setEditOpen(false)}
          onSubmit={handleEditSubmit}
        />
      ) : null}

      <EventFormModal
        open={scheduleOpen}
        mode="schedule"
        initialEvent={event}
        loading={scheduleMutation.isPending}
        onClose={() => setScheduleOpen(false)}
        onSubmit={handleScheduleSubmit}
      />
    </div>
  );
}

function EventSummaryCard({
  event,
  canSchedule,
  scheduleBlockedReason,
  onEdit,
  onSchedule,
}: {
  event: PublicEvent;
  canSchedule: boolean;
  scheduleBlockedReason: string | null | undefined;
  onEdit: () => void;
  onSchedule: () => void;
}) {
  const days = [...(event.days ?? [])].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <article className="event-single-card">
      <div className="event-single-media">
        {event.coverImage ? (
          <img src={resolveMediaUrl(event.coverImage)} alt="" />
        ) : (
          <div className="event-single-media-fallback">
            <CalendarDays size={36} />
          </div>
        )}
      </div>

      <div className="event-single-body">
        <p className="field-label">Current edition</p>
        <h2>{CANONICAL_EVENT_NAME}</h2>
        {event.tagline ? <p className="muted">{event.tagline}</p> : null}

        <div className="event-single-meta">
          <span className="badge role-member">
            {event.dayCount ?? days.length}{' '}
            {(event.dayCount ?? days.length) === 1 ? 'day' : 'days'}
          </span>
          <span
            className={`badge ${
              event.status === 'live'
                ? 'role-admin'
                : event.status === 'paused'
                  ? 'role-sponsor'
                  : 'role-member'
            }`}
          >
            {statusLabel(event.status)}
          </span>
          {(event.venueName || event.venueCity) && (
            <span className="event-single-venue">
              <MapPin size={14} />
              {[event.venueName, event.venueCity].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>

        {event.description ? <p className="event-single-description">{event.description}</p> : null}

        <div className="day-preview">
          <p className="field-label">Schedule</p>
          <ul>
            {days.map((day) => (
              <li key={`${day.dayNumber}-${day.date}`}>
                <strong>Day {day.dayNumber}</strong>
                <span>{formatEventDate(day.date)}</span>
                {day.label ? <span className="muted">{day.label}</span> : null}
              </li>
            ))}
          </ul>
        </div>

        <div className="event-single-actions">
          <Button variant="secondary" onClick={onEdit}>
            <Pencil size={16} />
            Edit details
          </Button>
          <Button
            onClick={onSchedule}
            disabled={!canSchedule}
            title={!canSchedule && scheduleBlockedReason ? scheduleBlockedReason : undefined}
          >
            <CalendarPlus size={16} />
            Schedule new event
          </Button>
        </div>
      </div>
    </article>
  );
}
