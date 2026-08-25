import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CalendarPlus, MapPin, Pencil, Trash2 } from 'lucide-react';
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

function editionManageLinks(edition: PublicEvent) {
  return (
    <div className="past-edition-links">
      <Link to={`/speakers?edition=${edition.id}`}>Speakers</Link>
      <Link to={`/sessions?edition=${edition.id}`}>Sessions</Link>
      <Link to={`/sponsors?edition=${edition.id}`}>Sponsors</Link>
      <Link to={`/store?edition=${edition.id}`}>Store</Link>
      <Link to={`/checkins?edition=${edition.id}`}>Check-ins</Link>
    </div>
  );
}

export function EventsPage() {
  const [editOpen, setEditOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PublicEvent | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();
  const { confirm } = useConfirm();

  const workspaceQuery = useQuery({
    queryKey: ['events', 'workspace'],
    queryFn: () => eventsApi.getWorkspace(),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: EventPayload }) => {
      const updated = await eventsApi.update(id, payload);
      await eventsApi.setAssociations(id, {
        speakerIds: payload.speakerIds ?? [],
        sponsorIds: payload.sponsorIds ?? [],
        membershipIds: payload.membershipIds ?? [],
      });
      return updated;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['events'] }),
        queryClient.invalidateQueries({ queryKey: ['speakers'] }),
        queryClient.invalidateQueries({ queryKey: ['sponsors'] }),
        queryClient.invalidateQueries({ queryKey: ['memberships'] }),
      ]);
      toast.success('Event updated');
      setEditOpen(false);
      setEditingEvent(null);
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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => eventsApi.remove(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['events'] }),
        queryClient.invalidateQueries({ queryKey: ['speakers'] }),
        queryClient.invalidateQueries({ queryKey: ['sessions'] }),
        queryClient.invalidateQueries({ queryKey: ['sponsors'] }),
        queryClient.invalidateQueries({ queryKey: ['memberships'] }),
        queryClient.invalidateQueries({ queryKey: ['store'] }),
        queryClient.invalidateQueries({ queryKey: ['checkins'] }),
        queryClient.invalidateQueries({ queryKey: ['checkin-forms'] }),
      ]);
      toast.success('Event deleted — attendees kept');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to delete event')),
  });

  function openEdit(event: PublicEvent) {
    setEditingEvent(event);
    setEditOpen(true);
  }

  async function handleDelete(edition: PublicEvent) {
    const ok = await confirm({
      title: 'Delete this event edition?',
      message: `Permanently delete “${CANONICAL_EVENT_NAME}” (${formatEditionRange(edition)})? This removes speakers, sessions, sponsors, memberships, store items, and check-in data for this edition. Attendee accounts and purchase history are kept.`,
      confirmLabel: 'Delete event',
      tone: 'danger',
    });
    if (!ok) return;
    await deleteMutation.mutateAsync(edition.id);
  }

  async function handleEditSubmit(payload: EventPayload | ScheduleEventPayload) {
    const event = editingEvent;
    if (!event) return;
    const ok = await confirm({
      title: 'Save event changes?',
      message: `Update “${event.name}” (${formatEditionRange(event)})?${
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
        'Create a separate event edition with these dates? It must start after the previous edition ends. Attendees will get a push about the new dates unless you turned notifications off.',
      confirmLabel: 'Schedule',
      tone: 'primary',
    });
    if (!ok) return;
    await scheduleMutation.mutateAsync(payload as ScheduleEventPayload);
  }

  const workspace = workspaceQuery.data;
  const event = workspace?.current ?? null;
  const upcomingEditions = workspace?.upcomingEditions ?? [];
  const pastEditions = workspace?.pastEditions ?? [];
  const previousEditionForSchedule =
    [...(workspace?.editions ?? [])].sort((a, b) => b.endDate.localeCompare(a.endDate))[0] ??
    event;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Event</h1>
          <p className="muted">
            Manage {CANONICAL_EVENT_NAME} editions. Each event is separate. Link shared memberships,
            speakers, and sponsors per edition (reusable across events). Sessions and content stay
            event-specific. A new edition must start after the previous one ends.
          </p>
        </div>
        <div className="page-header-actions">
          {event ? (
            <>
              <Button variant="secondary" onClick={() => openEdit(event)}>
                <Pencil size={16} />
                Edit details
              </Button>
              <Button
                variant="danger"
                disabled={deleteMutation.isPending}
                onClick={() => void handleDelete(event)}
              >
                <Trash2 size={16} />
                Delete event
              </Button>
            </>
          ) : null}
          <Button onClick={() => setScheduleOpen(true)} title="Schedule new event">
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
          deleting={deleteMutation.isPending}
          onEdit={() => openEdit(event)}
          onDelete={() => void handleDelete(event)}
          onSchedule={() => setScheduleOpen(true)}
        />
      ) : null}

      {upcomingEditions.length > 0 ? (
        <section className="past-editions">
          <h2>Upcoming / other active editions</h2>
          <p className="muted">
            Other live or upcoming editions. Each has its own speakers, sessions, sponsors, store,
            and check-ins. A newly scheduled edition must start after the previous one ends.
          </p>
          <ul className="past-editions-list">
            {upcomingEditions.map((edition) => (
              <li key={edition.id}>
                <div>
                  <strong>{formatEditionRange(edition)}</strong>
                  <span className="muted">
                    {edition.dayCount} {edition.dayCount === 1 ? 'day' : 'days'}
                    {edition.venueCity ? ` · ${edition.venueCity}` : ''}
                    {edition.published === false ? ' · Draft' : ''}
                  </span>
                  {editionManageLinks(edition)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                  <span className="badge role-member">{statusLabel(edition.status)}</span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {edition.status !== 'ended' ? (
                      <Button variant="secondary" onClick={() => openEdit(edition)}>
                        <Pencil size={14} />
                        Edit
                      </Button>
                    ) : null}
                    <Button
                      variant="danger"
                      disabled={deleteMutation.isPending}
                      onClick={() => void handleDelete(edition)}
                    >
                      <Trash2 size={14} />
                      Delete
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {pastEditions.length > 0 ? (
        <section className="past-editions">
          <h2>Past editions</h2>
          <p className="muted">
            Open speakers, sessions, sponsors, store, or check-ins for any past edition (fully
            editable by admin).
          </p>
          <ul className="past-editions-list">
            {pastEditions.map((edition) => (
              <li key={edition.id}>
                <div>
                  <strong>{formatEditionRange(edition)}</strong>
                  <span className="muted">
                    {edition.dayCount} {edition.dayCount === 1 ? 'day' : 'days'}
                    {edition.venueCity ? ` · ${edition.venueCity}` : ''}
                  </span>
                  {editionManageLinks(edition)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                  <span className="badge role-member">{statusLabel(edition.status)}</span>
                  <Button
                    variant="danger"
                    disabled={deleteMutation.isPending}
                    onClick={() => void handleDelete(edition)}
                  >
                    <Trash2 size={14} />
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {editingEvent ? (
        <EventFormModal
          open={editOpen}
          mode="edit"
          initialEvent={editingEvent}
          loading={updateMutation.isPending}
          onClose={() => {
            setEditOpen(false);
            setEditingEvent(null);
          }}
          onSubmit={handleEditSubmit}
        />
      ) : null}

      <EventFormModal
        open={scheduleOpen}
        mode="schedule"
        initialEvent={previousEditionForSchedule}
        loading={scheduleMutation.isPending}
        onClose={() => setScheduleOpen(false)}
        onSubmit={handleScheduleSubmit}
      />
    </div>
  );
}

function EventSummaryCard({
  event,
  deleting,
  onEdit,
  onDelete,
  onSchedule,
}: {
  event: PublicEvent;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
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
          {event.published === false ? (
            <span className="badge role-sponsor">Draft</span>
          ) : (
            <span className="badge role-member">Published</span>
          )}
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
          <Button variant="danger" disabled={deleting} onClick={onDelete}>
            <Trash2 size={16} />
            Delete event
          </Button>
          <Button onClick={onSchedule}>
            <CalendarPlus size={16} />
            Schedule new event
          </Button>
        </div>
      </div>
    </article>
  );
}
