import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Eye, FolderOpen } from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthProvider';
import { eventsApi } from '@/features/events/api/events-api';
import { formatEditionRange } from '@/features/events/hooks/useEditionScope';
import { ManageSessionContentModal } from '@/features/portal/components/ManageSessionContentModal';
import { ViewSessionModal } from '@/features/portal/components/ViewSessionModal';
import { sessionsApi } from '@/features/sessions/api/sessions-api';
import { speakersApi } from '@/features/speakers/api/speakers-api';
import { getApiErrorMessage } from '@/shared/api/client';
import { formatSessionTimeRange } from '@/shared/lib/datetime';
import type {
  PublicSession,
  SessionMaterialPayload,
  SpeakerLinkedEvent,
} from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

function editionStatusLabel(status: string): string {
  if (status === 'ended') return 'past';
  if (status === 'live') return 'live';
  if (status === 'paused') return 'paused';
  return 'upcoming';
}

export function SpeakerSessionsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [eventFilter, setEventFilter] = useState('');
  const [viewing, setViewing] = useState<PublicSession | null>(null);
  const [managing, setManaging] = useState<PublicSession | null>(null);

  const speakerId = user?.speakerId ?? undefined;

  // Always load every assigned session (filter client-side) so the Event dropdown
  // still works even if /speakers/me/events is not deployed yet.
  const sessionsQuery = useQuery({
    queryKey: ['sessions', 'mine', speakerId],
    queryFn: () => sessionsApi.list({ speakerId, perPage: 100 }),
    enabled: Boolean(speakerId),
  });

  const linkedEventsQuery = useQuery({
    queryKey: ['speakers', 'me', 'events', speakerId],
    queryFn: () => speakersApi.listMyEvents(),
    enabled: Boolean(speakerId),
    retry: false,
  });

  const workspaceQuery = useQuery({
    queryKey: ['events', 'workspace'],
    queryFn: () => eventsApi.getWorkspace(),
    enabled: Boolean(speakerId),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      description,
      materials,
    }: {
      id: string;
      description: string;
      materials: SessionMaterialPayload[];
    }) => sessionsApi.update(id, { description, materials }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sessions', 'mine'] });
      await queryClient.invalidateQueries({ queryKey: ['speakers', 'me', 'events'] });
      toast.success('Session content saved');
      setManaging(null);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to save content')),
  });

  const allSessions = sessionsQuery.data?.items ?? [];

  const linkedEvents = useMemo((): SpeakerLinkedEvent[] => {
    const counts = new Map<string, number>();
    for (const session of allSessions) {
      counts.set(session.eventId, (counts.get(session.eventId) ?? 0) + 1);
    }

    if (linkedEventsQuery.data && linkedEventsQuery.data.length > 0) {
      const byId = new Map(linkedEventsQuery.data.map((event) => [event.id, event]));
      for (const [eventId, sessionCount] of counts) {
        const existing = byId.get(eventId);
        if (existing) {
          byId.set(eventId, { ...existing, sessionCount });
        }
      }
      return [...byId.values()]
        .filter((event) => (counts.get(event.id) ?? event.sessionCount) > 0)
        .sort((a, b) => b.startDate.localeCompare(a.startDate));
    }

    const editions = workspaceQuery.data?.editions ?? [];
    const fromWorkspace: SpeakerLinkedEvent[] = [];
    for (const [eventId, sessionCount] of counts) {
      const edition = editions.find((item) => item.id === eventId);
      if (edition) {
        fromWorkspace.push({
          id: edition.id,
          name: edition.name,
          startDate: edition.startDate,
          endDate: edition.endDate,
          status: edition.status,
          sessionCount,
        });
      } else {
        fromWorkspace.push({
          id: eventId,
          name: 'Event',
          startDate: '',
          endDate: '',
          status: 'upcoming',
          sessionCount,
        });
      }
    }
    return fromWorkspace.sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [allSessions, linkedEventsQuery.data, workspaceQuery.data?.editions]);

  const eventById = useMemo(
    () => new Map(linkedEvents.map((event) => [event.id, event] as const)),
    [linkedEvents],
  );

  const visibleSessions = useMemo(
    () =>
      eventFilter
        ? allSessions.filter((session) => session.eventId === eventFilter)
        : allSessions,
    [allSessions, eventFilter],
  );

  const sessionsByEvent = useMemo(() => {
    const groups = new Map<string, PublicSession[]>();
    for (const session of visibleSessions) {
      const list = groups.get(session.eventId) ?? [];
      list.push(session);
      groups.set(session.eventId, list);
    }

    const orderedIds = [
      ...linkedEvents.map((event) => event.id),
      ...groups.keys(),
    ].filter((id, index, all) => groups.has(id) && all.indexOf(id) === index);

    return orderedIds.map((eventId) => ({
      eventId,
      event: eventById.get(eventId),
      sessions: groups.get(eventId) ?? [],
    }));
  }, [visibleSessions, linkedEvents, eventById]);

  if (sessionsQuery.isLoading || workspaceQuery.isLoading) return <Spinner />;
  if (sessionsQuery.isError) {
    return <p className="form-error">{getApiErrorMessage(sessionsQuery.error)}</p>;
  }

  // Keep viewing session fresh after edits
  const viewingSession =
    (viewing && allSessions.find((session) => session.id === viewing.id)) || viewing;
  const managingSession =
    (managing && allSessions.find((session) => session.id === managing.id)) || managing;

  const showEventFilter = linkedEvents.length > 0;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>My sessions</h1>
          <p className="muted">
            Sessions are grouped by event. Switch editions to view and manage content for each
            assignment separately.
          </p>
        </div>
      </header>

      {showEventFilter ? (
        <label className="field" style={{ maxWidth: 480, marginBottom: '1rem' }}>
          <span className="field-label">Event</span>
          <select
            className="field-input"
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
          >
            <option value="">
              All events ({allSessions.length}{' '}
              {allSessions.length === 1 ? 'session' : 'sessions'})
            </option>
            {linkedEvents.map((event) => (
              <option key={event.id} value={event.id}>
                {event.startDate ? formatEditionRange(event) : event.name} ·{' '}
                {editionStatusLabel(event.status)} ({event.sessionCount}{' '}
                {event.sessionCount === 1 ? 'session' : 'sessions'})
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {visibleSessions.length === 0 ? (
        <div className="empty-state">
          <h2>No sessions assigned yet</h2>
          <p className="muted">
            {eventFilter
              ? 'You have no sessions for this event. Choose another event or All events.'
              : 'When an admin assigns you to a session, it will show up here.'}
          </p>
        </div>
      ) : (
        <div className="stack" style={{ gap: '1.5rem' }}>
          {sessionsByEvent.map(({ eventId, event, sessions: groupSessions }) => (
            <section key={eventId} className="table-wrap">
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  padding: '0.85rem 1rem',
                  borderBottom: '1px solid var(--border, #e5e7eb)',
                }}
              >
                <div>
                  <strong>
                    {event?.startDate ? formatEditionRange(event) : event?.name || 'Event'}
                  </strong>
                  {event ? (
                    <span className="muted" style={{ marginLeft: '0.5rem' }}>
                      {event.name} · {editionStatusLabel(event.status)}
                    </span>
                  ) : null}
                </div>
                <span className="badge role-member">
                  {groupSessions.length}{' '}
                  {groupSessions.length === 1 ? 'session' : 'sessions'}
                </span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Session</th>
                    <th>Day</th>
                    <th>Time</th>
                    <th>Location</th>
                    <th>Content</th>
                    <th>Reviews</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {groupSessions.map((session) => {
                    const ratingsCount = session.feedbackSummary?.ratingsCount ?? 0;
                    const average = session.feedbackSummary?.averageRating ?? 0;
                    const timeRange = formatSessionTimeRange(
                      session.startTime,
                      session.endTime,
                    );

                    return (
                      <tr key={session.id}>
                        <td>
                          <div className="cell-stack">
                            <strong>{session.name}</strong>
                            {session.description ? (
                              <span className="muted cell-clamp">{session.description}</span>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          <span className="badge role-member">Day {session.eventDayNumber}</span>
                        </td>
                        <td>
                          {timeRange ? <span>{timeRange}</span> : <span className="muted">—</span>}
                        </td>
                        <td>
                          {session.location?.trim() ? (
                            <span>{session.location}</span>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td>
                          <span className="badge role-admin">
                            {session.materials.length}{' '}
                            {session.materials.length === 1 ? 'item' : 'items'}
                          </span>
                        </td>
                        <td>
                          {ratingsCount > 0 ? (
                            <span className="muted">
                              {average.toFixed(1)} · {ratingsCount}
                            </span>
                          ) : (
                            <span className="muted">None</span>
                          )}
                        </td>
                        <td className="actions">
                          <Button variant="secondary" onClick={() => setViewing(session)}>
                            <Eye size={14} />
                            View session
                          </Button>
                          <Button onClick={() => setManaging(session)}>
                            <FolderOpen size={14} />
                            Manage content
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}

      <ViewSessionModal
        open={Boolean(viewingSession)}
        session={viewingSession}
        onClose={() => setViewing(null)}
        onManageContent={() => {
          if (!viewingSession) return;
          setManaging(viewingSession);
          setViewing(null);
        }}
      />

      <ManageSessionContentModal
        open={Boolean(managingSession)}
        session={managingSession}
        loading={updateMutation.isPending}
        onClose={() => setManaging(null)}
        onSave={async ({ description, materials }) => {
          if (!managingSession) return;
          await updateMutation.mutateAsync({
            id: managingSession.id,
            description,
            materials,
          });
        }}
      />
    </div>
  );
}
