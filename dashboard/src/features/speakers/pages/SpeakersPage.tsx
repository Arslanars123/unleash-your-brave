import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Mic2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { EditionSwitcher } from '@/features/events/components/EditionSwitcher';
import { useEditionScope } from '@/features/events/hooks/useEditionScope';
import { speakersApi } from '@/features/speakers/api/speakers-api';
import { SpeakerFormModal } from '@/features/speakers/components/SpeakerFormModal';
import { getApiErrorMessage } from '@/shared/api/client';
import type { PublicSpeaker, SpeakerPayload } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { useConfirm } from '@/shared/ui/ConfirmDialog';
import { ListPagination } from '@/shared/ui/ListPagination';
import { SearchSuggest } from '@/shared/ui/SearchSuggest';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

const PER_PAGE = 20;

export function SpeakersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PublicSpeaker | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();
  const { confirm } = useConfirm();
  const { eventId, isPastEdition, workspaceQuery } = useEditionScope();

  const speakersQuery = useQuery({
    queryKey: ['speakers', 'list', eventId, search, page],
    queryFn: () =>
      speakersApi.list({
        search: search || undefined,
        page,
        perPage: PER_PAGE,
        eventId,
      }),
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
    mutationFn: (payload: SpeakerPayload) => speakersApi.create(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['speakers', 'list'] });
      toast.success('Speaker created');
      closeModal();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to create speaker')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: SpeakerPayload }) =>
      speakersApi.update(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['speakers', 'list'] });
      toast.success('Speaker updated');
      closeModal();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to update speaker')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => speakersApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['speakers', 'list'] });
      toast.success('Speaker deleted');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to delete speaker')),
  });

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(speaker: PublicSpeaker) {
    setEditing(speaker);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  async function handleSubmit(payload: SpeakerPayload) {
    if (editing) {
      const ok = await confirm({
        title: 'Save speaker changes?',
        message: `Update “${editing.name}”?`,
        confirmLabel: 'Save changes',
        tone: 'primary',
      });
      if (!ok) return;
      await updateMutation.mutateAsync({ id: editing.id, payload });
      return;
    }
    if (!eventId) {
      toast.error('Schedule an event before adding speakers');
      return;
    }
    await createMutation.mutateAsync({ ...payload, eventId });
  }

  async function handleDelete(speaker: PublicSpeaker) {
    const ok = await confirm({
      title: 'Delete speaker?',
      message: `Delete “${speaker.name}”? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    await deleteMutation.mutateAsync(speaker.id);
  }

  const saving = createMutation.isPending || updateMutation.isPending;
  const bootstrapLoading = workspaceQuery.isLoading || (Boolean(eventId) && speakersQuery.isLoading);
  const canEdit = Boolean(eventId);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="page-kicker">Stage</span>
          <h1>Speakers</h1>
          <p className="muted">
            {isPastEdition
              ? 'Speakers linked to the selected event edition. The same speaker can be linked to multiple events; their sessions stay separate per event.'
              : 'Speakers linked to the selected event edition.'}
          </p>
        </div>
        {canEdit ? (
          <Button onClick={openCreate}>
            <Plus size={16} />
            Create speaker
          </Button>
        ) : null}
      </header>

      <EditionSwitcher />

      <div className="toolbar">
        <SearchSuggest
          label="Search"
          placeholder="Name, title, or bio"
          value={search}
          onChange={applySearch}
          disabled={!eventId}
          loadSuggestions={async (draft) => {
            if (!eventId) return [];
            const result = await speakersApi.list({
              search: draft,
              perPage: 6,
              eventId,
            });
            return result.items.map((speaker) => ({
              id: speaker.id,
              title: speaker.name,
              subtitle: speaker.title || undefined,
              leading: speaker.photo ? (
                <img src={speaker.photo} alt="" />
              ) : (
                <span>{speaker.name.charAt(0).toUpperCase()}</span>
              ),
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
      {workspaceQuery.isError ? (
        <p className="form-error">{getApiErrorMessage(workspaceQuery.error)}</p>
      ) : null}
      {speakersQuery.isError ? (
        <p className="form-error">{getApiErrorMessage(speakersQuery.error)}</p>
      ) : null}
      {!bootstrapLoading && !eventId ? (
        <p className="form-error">Schedule an event on the Event page before managing speakers.</p>
      ) : null}

      {eventId && speakersQuery.data ? (
        speakersQuery.data.items.length === 0 ? (
          <div className="empty-state">
            <Mic2 size={28} />
            <h2>No speakers for this edition</h2>
            <p className="muted">
              {isPastEdition
                ? 'This past edition has no speakers saved.'
                : 'Add speakers for this edition. Past editions keep their own lists.'}
            </p>
            {canEdit ? (
              <Button onClick={openCreate}>
                <Plus size={16} />
                Create speaker
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Speaker</th>
                  <th>Title</th>
                  <th>Description</th>
                  {canEdit ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {speakersQuery.data.items.map((speaker) => (
                  <tr key={speaker.id}>
                    <td>
                      <div className="speaker-cell">
                        {speaker.photo ? (
                          <img
                            className="speaker-avatar"
                            src={speaker.photo}
                            alt={speaker.name}
                          />
                        ) : (
                          <span className="speaker-avatar placeholder">
                            {speaker.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <strong>{speaker.name}</strong>
                      </div>
                    </td>
                    <td>{speaker.title || '—'}</td>
                    <td>
                      <span className="cell-clamp">{speaker.description || '—'}</span>
                    </td>
                    {canEdit ? (
                      <td className="actions">
                        <Button variant="secondary" onClick={() => openEdit(speaker)}>
                          <Pencil size={14} />
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          disabled={deleteMutation.isPending}
                          onClick={() => void handleDelete(speaker)}
                        >
                          <Trash2 size={14} />
                          Delete
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
            <ListPagination
              page={speakersQuery.data.meta.page}
              totalPages={speakersQuery.data.meta.totalPages}
              total={speakersQuery.data.meta.total}
              perPage={speakersQuery.data.meta.perPage}
              onPageChange={setPage}
              label="speakers"
            />
          </div>
        )
      ) : null}

      {canEdit ? (
        <SpeakerFormModal
          open={modalOpen}
          mode={editing ? 'edit' : 'create'}
          initialSpeaker={editing}
          loading={saving}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      ) : null}
    </div>
  );
}
