import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Clapperboard, MessageSquareText, Pencil, Plus, Star, Trash2, X } from 'lucide-react';
import { EditionSwitcher } from '@/features/events/components/EditionSwitcher';
import { useEditionScope } from '@/features/events/hooks/useEditionScope';
import { sessionsApi } from '@/features/sessions/api/sessions-api';
import { SessionFeedbackModal } from '@/features/sessions/components/SessionFeedbackModal';
import { SessionFormModal } from '@/features/sessions/components/SessionFormModal';
import { speakersApi } from '@/features/speakers/api/speakers-api';
import { membershipsApi } from '@/features/memberships/api/memberships-api';
import { getApiErrorMessage } from '@/shared/api/client';
import { formatSessionTimeRange } from '@/shared/lib/datetime';
import type { PublicSession, SessionPayload } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { useConfirm } from '@/shared/ui/ConfirmDialog';
import { ListPagination } from '@/shared/ui/ListPagination';
import { SearchSuggest } from '@/shared/ui/SearchSuggest';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

const PER_PAGE = 20;

export function SessionsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PublicSession | null>(null);
  const [feedbackSession, setFeedbackSession] = useState<PublicSession | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();
  const { confirm } = useConfirm();
  const { eventId, selectedEdition, isPastEdition, workspaceQuery } = useEditionScope();

  const eventDays = selectedEdition?.days ?? [];

  const sessionsQuery = useQuery({
    queryKey: ['sessions', 'list', eventId, search, page],
    queryFn: () =>
      sessionsApi.list({
        search: search || undefined,
        page,
        perPage: PER_PAGE,
        eventId,
      }),
    enabled: Boolean(eventId),
  });

  const speakersQuery = useQuery({
    queryKey: ['speakers', 'list', eventId, 'all'],
    queryFn: () => speakersApi.list({ perPage: 100, eventId }),
    enabled: Boolean(eventId),
  });

  const membershipsQuery = useQuery({
    queryKey: ['memberships', 'list', eventId, 'all'],
    queryFn: () => membershipsApi.list({ perPage: 100, eventId }),
    enabled: Boolean(eventId),
  });

  function applySearch(next: string) {
    setSearch(next);
    setPage(1);
  }

  useEffect(() => {
    setPage(1);
  }, [eventId]);

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
      const ok = await confirm({
        title: 'Save session changes?',
        message: `Update “${editing.name}”?`,
        confirmLabel: 'Save changes',
        tone: 'primary',
      });
      if (!ok) return;
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
    const ok = await confirm({
      title: 'Delete session?',
      message: `Delete “${session.name}”? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    await deleteMutation.mutateAsync(session.id);
  }

  const saving = createMutation.isPending || updateMutation.isPending;
  const speakers = speakersQuery.data?.items ?? [];
  const memberships = membershipsQuery.data?.items ?? [];
  const canEdit = Boolean(eventId);
  const bootstrapLoading =
    workspaceQuery.isLoading ||
    (Boolean(eventId) && (sessionsQuery.isLoading || speakersQuery.isLoading));

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="page-kicker">Agenda</span>
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
        <SearchSuggest
          label="Search"
          placeholder="Session name or description"
          value={search}
          onChange={applySearch}
          disabled={!eventId}
          loadSuggestions={async (draft) => {
            if (!eventId) return [];
            const result = await sessionsApi.list({
              search: draft,
              perPage: 6,
              eventId,
            });
            return result.items.map((session) => ({
              id: session.id,
              title: session.name,
              subtitle: [
                session.speaker?.name,
                session.eventDayNumber ? `Day ${session.eventDayNumber}` : null,
              ]
                .filter(Boolean)
                .join(' · '),
            }));
          }}
        />
      </div>
      {search ? (
        <div className="active-filter-chip">
          Showing results for “{search}”
          <button type="button" aria-label="Clear filter" onClick={() => applySearch('')}>
            <X size={14} />
          </button>
        </div>
      ) : null}

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
            <ListPagination
              page={sessionsQuery.data.meta.page}
              totalPages={sessionsQuery.data.meta.totalPages}
              total={sessionsQuery.data.meta.total}
              perPage={sessionsQuery.data.meta.perPage}
              onPageChange={setPage}
              label="sessions"
            />
          </div>
        )
      ) : null}

      {canEdit ? (
        <SessionFormModal
          open={modalOpen}
          mode={editing ? 'edit' : 'create'}
          initialSession={editing}
          speakers={speakers}
          memberships={memberships}
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
