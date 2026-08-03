import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Mic2, Pencil, Plus, Trash2 } from 'lucide-react';
import { EditionSwitcher } from '@/features/events/components/EditionSwitcher';
import { useEditionScope } from '@/features/events/hooks/useEditionScope';
import { speakersApi } from '@/features/speakers/api/speakers-api';
import { SpeakerFormModal } from '@/features/speakers/components/SpeakerFormModal';
import { getApiErrorMessage } from '@/shared/api/client';
import type { PublicSpeaker, SpeakerPayload } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

export function SpeakersPage() {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PublicSpeaker | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();
  const { eventId, isPastEdition, workspaceQuery } = useEditionScope();

  const speakersQuery = useQuery({
    queryKey: ['speakers', 'list', eventId, search],
    queryFn: () =>
      speakersApi.list({ search: search || undefined, perPage: 50, eventId }),
    enabled: Boolean(eventId),
  });

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
    const confirmed = window.confirm(`Delete “${speaker.name}”? This cannot be undone.`);
    if (!confirmed) return;
    await deleteMutation.mutateAsync(speaker.id);
  }

  const saving = createMutation.isPending || updateMutation.isPending;
  const bootstrapLoading = workspaceQuery.isLoading || (Boolean(eventId) && speakersQuery.isLoading);
  const canEdit = Boolean(eventId);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Speakers</h1>
          <p className="muted">
            {isPastEdition
              ? 'Speakers from a past edition — admins can still create, edit, and delete.'
              : 'Speakers for the selected event edition.'}
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
        <Input
          label="Search"
          placeholder="Name, title, or bio"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

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
            <p className="muted table-meta">
              Showing {speakersQuery.data.items.length} of {speakersQuery.data.meta.total} speakers
            </p>
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
