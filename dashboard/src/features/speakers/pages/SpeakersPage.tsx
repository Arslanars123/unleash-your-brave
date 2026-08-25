import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Mic2, Pencil, Plus, Trash2, X } from 'lucide-react';
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

  const speakersQuery = useQuery({
    queryKey: ['speakers', 'list', search, page],
    queryFn: () =>
      speakersApi.list({
        search: search || undefined,
        page,
        perPage: PER_PAGE,
      }),
  });

  function applySearch(next: string) {
    setSearch(next);
    setPage(1);
  }

  async function invalidateSpeakerQueries() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['speakers', 'list'] }),
      queryClient.invalidateQueries({ queryKey: ['speakers', 'library'] }),
    ]);
  }

  const createMutation = useMutation({
    mutationFn: (payload: SpeakerPayload) => speakersApi.create(payload),
    onSuccess: async () => {
      await invalidateSpeakerQueries();
      toast.success('Speaker created');
      closeModal();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to create speaker')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: SpeakerPayload }) =>
      speakersApi.update(id, payload),
    onSuccess: async () => {
      await invalidateSpeakerQueries();
      toast.success('Speaker updated');
      closeModal();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to update speaker')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => speakersApi.remove(id),
    onSuccess: async () => {
      await invalidateSpeakerQueries();
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
    // Global library — link to events from Edit edition associations.
    await createMutation.mutateAsync(payload);
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

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="page-kicker">Stage</span>
          <h1>Speakers</h1>
          <p className="muted">
            Shared speaker library. Create speakers here, then link them to events from Edit edition.
            The same speaker can appear on multiple events; sessions stay separate per event.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} />
          Create speaker
        </Button>
      </header>

      <div className="toolbar">
        <SearchSuggest
          label="Search"
          placeholder="Name, title, or bio"
          value={search}
          onChange={applySearch}
          loadSuggestions={async (draft) => {
            const result = await speakersApi.list({
              search: draft,
              perPage: 6,
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

      {speakersQuery.isLoading ? <Spinner /> : null}
      {speakersQuery.isError ? (
        <p className="form-error">{getApiErrorMessage(speakersQuery.error)}</p>
      ) : null}

      {speakersQuery.data ? (
        speakersQuery.data.items.length === 0 ? (
          <div className="empty-state">
            <Mic2 size={28} />
            <h2>No speakers yet</h2>
            <p className="muted">
              Add speakers to the shared library, then link them to an event from Edit edition.
            </p>
            <Button onClick={openCreate}>
              <Plus size={16} />
              Create speaker
            </Button>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Speaker</th>
                  <th>Title</th>
                  <th>Description</th>
                  <th />
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

      <SpeakerFormModal
        open={modalOpen}
        mode={editing ? 'edit' : 'create'}
        initialSpeaker={editing}
        loading={saving}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
