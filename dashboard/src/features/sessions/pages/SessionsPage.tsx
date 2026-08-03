import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Clapperboard, MessageSquareText, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { EditionSwitcher } from '@/features/events/components/EditionSwitcher';
import { useEditionScope } from '@/features/events/hooks/useEditionScope';
import { sessionsApi } from '@/features/sessions/api/sessions-api';
import { SessionFeedbackModal } from '@/features/sessions/components/SessionFeedbackModal';
import { SessionFormModal } from '@/features/sessions/components/SessionFormModal';
import { speakersApi } from '@/features/speakers/api/speakers-api';
import { getApiErrorMessage } from '@/shared/api/client';
import { formatSessionTimeRange } from '@/shared/lib/datetime';
import type { PublicSession, SessionPayload } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

export function SessionsPage() {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PublicSession | null>(null);
  const [feedbackSession, setFeedbackSession] = useState<PublicSession | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();
  const { eventId, selectedEdition, isPastEdition, workspaceQuery } = useEditionScope();

  const eventDays = selectedEdition?.days ?? [];

  const sessionsQuery = useQuery({
    queryKey: ['sessions', 'list', eventId, search],
    queryFn: () =>
      sessionsApi.list({ search: search || undefined, perPage: 100, eventId }),
    enabled: Boolean(eventId),
  });

  const speakersQuery = useQuery({
    queryKey: ['speakers', 'list', eventId, 'all'],
    queryFn: () => speakersApi.list({ perPage: 100, eventId }),
    enabled: Boolean(eventId),
  });

  const createMutation = useMutation({
    mutationFn: (payload: SessionPayload) => sessionsApi.create(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sessions', 'list'] });
      toast.success('Session created');
      closeModal();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to create session')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: SessionPayload }) =>
      sessionsApi.update(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sessions', 'list'] });
      toast.success('Session updated');
      closeModal();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to update session')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sessionsApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sessions', 'list'] });
      toast.success('Session deleted');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to delete session')),
  });

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(session: PublicSession) {
    setEditing(session);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  async function handleSubmit(payload: SessionPayload) {
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, payload });
      return;
    }
    if (!eventId) {
      toast.error('Schedule an event before adding sessions');
      return;
    }
    await createMutation.mutateAsync({ ...payload, eventId });
  }

  async function handleDelete(session: PublicSession) {
    const confirmed = window.confirm(`Delete “${session.name}”? This cannot be undone.`);
    if (!confirmed) return;
    await deleteMutation.mutateAsync(session.id);
  }

  const saving = createMutation.isPending || updateMutation.isPending;
  const speakers = speakersQuery.data?.items ?? [];
  const canEdit = Boolean(eventId);
  const bootstrapLoading =
    workspaceQuery.isLoading ||
    (Boolean(eventId) && (sessionsQuery.isLoading || speakersQuery.isLoading));

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Sessions</h1>
          <p className="muted">
            {isPastEdition
              ? 'Agenda from a past edition — admins can still edit sessions, materials, and reviews.'
              : 'Agenda for the selected edition — speakers and materials stay with this event.'}
          </p>
        </div>
        {canEdit ? (
          <Button onClick={openCreate} disabled={!speakers.length || !eventDays.length}>
            <Plus size={16} />
            Create session
          </Button>
        ) : null}
      </header>

      <EditionSwitcher />

      <div className="toolbar">
        <Input
          label="Search"
          placeholder="Session name or description"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {bootstrapLoading ? <Spinner /> : null}
      {sessionsQuery.isError ? (
        <p className="form-error">{getApiErrorMessage(sessionsQuery.error)}</p>
      ) : null}
      {!bootstrapLoading && !eventId ? (
        <p className="form-error">Schedule an event on the Event page before managing sessions.</p>
      ) : null}
      {!bootstrapLoading && canEdit && speakers.length === 0 ? (
        <p className="form-error">Add at least one speaker before creating sessions.</p>
      ) : null}
      {!bootstrapLoading && canEdit && eventDays.length === 0 ? (
        <p className="form-error">Set event days on the Event page before creating sessions.</p>
      ) : null}

      {eventId && sessionsQuery.data ? (
        sessionsQuery.data.items.length === 0 ? (
          <div className="empty-state">
            <Clapperboard size={28} />
            <h2>No sessions for this edition</h2>
            <p className="muted">
              {isPastEdition
                ? 'This past edition has no sessions saved.'
                : 'Create sessions for this edition. Past editions keep their agenda.'}
            </p>
            {canEdit ? (
              <Button onClick={openCreate} disabled={!speakers.length || !eventDays.length}>
                <Plus size={16} />
                Create session
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Day</th>
                  <th>Time</th>
                  <th>Location</th>
                  <th>Speaker</th>
                  <th>Rating</th>
                  <th>Materials</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sessionsQuery.data.items.map((session) => {
                  const summary = session.feedbackSummary;
                  const hasRatings = (summary?.ratingsCount ?? 0) > 0;
                  const timeRange = formatSessionTimeRange(session.startTime, session.endTime);

                  return (
                    <tr key={session.id}>
                      <td>
                        <div className="cell-stack">
                          <strong>{session.name}</strong>
                          {session.description ? (
                            <span className="muted cell-clamp">{session.description}</span>
                          ) : null}
                          {!session.feedbackEnabled ? (
                            <span className="hint">Feedback off</span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <span className="badge role-member">Day {session.eventDayNumber}</span>
                      </td>
                      <td>
                        {timeRange ? (
                          <span>{timeRange}</span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        {session.location?.trim() ? (
                          <span>{session.location}</span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>{session.speaker?.name ?? '—'}</td>
                      <td>
                        {hasRatings ? (
                          <span className="session-rating-cell">
                            <Star size={14} fill="currentColor" strokeWidth={0} />
                            <strong>{summary.averageRating.toFixed(1)}</strong>
                            <span className="muted">({summary.ratingsCount})</span>
                          </span>
                        ) : (
                          <span className="muted">No ratings</span>
                        )}
                      </td>
                      <td>
                        <div className="material-badges">
                          {session.materials.length === 0 ? (
                            <span className="muted">None</span>
                          ) : (
                            session.materials.map((material) => (
                              <span key={material.id} className="badge role-admin">
                                {material.type}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="actions">
                        <Button variant="secondary" onClick={() => setFeedbackSession(session)}>
                          <MessageSquareText size={14} />
                          Reviews
                        </Button>
                        {canEdit ? (
                          <>
                            <Button variant="secondary" onClick={() => openEdit(session)}>
                              <Pencil size={14} />
                              Edit
                            </Button>
                            <Button
                              variant="danger"
                              disabled={deleteMutation.isPending}
                              onClick={() => void handleDelete(session)}
                            >
                              <Trash2 size={14} />
                              Delete
                            </Button>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="muted table-meta">
              Showing {sessionsQuery.data.items.length} of {sessionsQuery.data.meta.total} sessions
            </p>
          </div>
        )
      ) : null}

      {canEdit ? (
        <SessionFormModal
          open={modalOpen}
          mode={editing ? 'edit' : 'create'}
          initialSession={editing}
          speakers={speakers}
          eventDays={eventDays}
          loading={saving}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      ) : null}

      <SessionFeedbackModal
        open={Boolean(feedbackSession)}
        session={feedbackSession}
        onClose={() => setFeedbackSession(null)}
      />
    </div>
  );
}
