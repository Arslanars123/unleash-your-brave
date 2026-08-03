import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Handshake, Pencil, Plus, Trash2 } from 'lucide-react';
import { EditionSwitcher } from '@/features/events/components/EditionSwitcher';
import { useEditionScope } from '@/features/events/hooks/useEditionScope';
import { sponsorsApi } from '@/features/sponsors/api/sponsors-api';
import { SponsorFormModal } from '@/features/sponsors/components/SponsorFormModal';
import { getApiErrorMessage } from '@/shared/api/client';
import { resolveMediaUrl } from '@/shared/lib/media';
import type { PublicSponsor, SponsorPayload } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

export function SponsorsPage() {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PublicSponsor | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();
  const { eventId, isPastEdition, workspaceQuery } = useEditionScope();

  const sponsorsQuery = useQuery({
    queryKey: ['sponsors', 'list', eventId, search],
    queryFn: () =>
      sponsorsApi.list({ search: search || undefined, perPage: 50, eventId }),
    enabled: Boolean(eventId),
  });

  const createMutation = useMutation({
    mutationFn: (payload: SponsorPayload) => sponsorsApi.create(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sponsors', 'list'] });
      toast.success('Sponsor created');
      closeModal();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to create sponsor')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: SponsorPayload }) =>
      sponsorsApi.update(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sponsors', 'list'] });
      toast.success('Sponsor updated');
      closeModal();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to update sponsor')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sponsorsApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sponsors', 'list'] });
      toast.success('Sponsor deleted');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to delete sponsor')),
  });

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(sponsor: PublicSponsor) {
    setEditing(sponsor);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  async function handleSubmit(payload: SponsorPayload) {
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, payload });
      return;
    }
    if (!eventId) {
      toast.error('Schedule an event before adding sponsors');
      return;
    }
    await createMutation.mutateAsync({ ...payload, eventId });
  }

  async function handleDelete(sponsor: PublicSponsor) {
    const confirmed = window.confirm(`Delete “${sponsor.name}”? This cannot be undone.`);
    if (!confirmed) return;
    await deleteMutation.mutateAsync(sponsor.id);
  }

  const saving = createMutation.isPending || updateMutation.isPending;
  const bootstrapLoading = workspaceQuery.isLoading || (Boolean(eventId) && sponsorsQuery.isLoading);
  const canEdit = Boolean(eventId);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Sponsors</h1>
          <p className="muted">
            {isPastEdition
              ? 'Sponsors from a past edition — admins can still manage profiles and offers.'
              : 'Sponsors and offers for the selected event edition.'}
          </p>
        </div>
        {canEdit ? (
          <Button onClick={openCreate}>
            <Plus size={16} />
            Create sponsor
          </Button>
        ) : null}
      </header>

      <EditionSwitcher />

      <div className="toolbar">
        <Input
          label="Search"
          placeholder="Sponsor name or description"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {bootstrapLoading ? <Spinner /> : null}
      {workspaceQuery.isError ? (
        <p className="form-error">{getApiErrorMessage(workspaceQuery.error)}</p>
      ) : null}
      {sponsorsQuery.isError ? (
        <p className="form-error">{getApiErrorMessage(sponsorsQuery.error)}</p>
      ) : null}
      {!bootstrapLoading && !eventId ? (
        <p className="form-error">Schedule an event on the Event page before managing sponsors.</p>
      ) : null}

      {eventId && sponsorsQuery.data ? (
        sponsorsQuery.data.items.length === 0 ? (
          <div className="empty-state">
            <Handshake size={28} />
            <h2>No sponsors for this edition</h2>
            <p className="muted">
              {isPastEdition
                ? 'This past edition has no sponsors saved.'
                : 'Add sponsors for this edition. Past editions keep their own lists.'}
            </p>
            {canEdit ? (
              <Button onClick={openCreate}>
                <Plus size={16} />
                Create sponsor
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Sponsor</th>
                  <th>Offers</th>
                  <th>Description</th>
                  {canEdit ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {sponsorsQuery.data.items.map((sponsor) => (
                  <tr key={sponsor.id}>
                    <td>
                      <div className="speaker-cell">
                        {sponsor.image ? (
                          <img
                            className="speaker-avatar"
                            src={resolveMediaUrl(sponsor.image)}
                            alt=""
                          />
                        ) : (
                          <span className="speaker-avatar placeholder">
                            {sponsor.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <strong>{sponsor.name}</strong>
                      </div>
                    </td>
                    <td>
                      <span className="badge role-member">
                        {sponsor.offers.length}{' '}
                        {sponsor.offers.length === 1 ? 'offer' : 'offers'}
                      </span>
                    </td>
                    <td>
                      <span className="cell-clamp">{sponsor.description || '—'}</span>
                    </td>
                    {canEdit ? (
                      <td className="actions">
                        <Button variant="secondary" onClick={() => openEdit(sponsor)}>
                          <Pencil size={14} />
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          disabled={deleteMutation.isPending}
                          onClick={() => void handleDelete(sponsor)}
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
              Showing {sponsorsQuery.data.items.length} of {sponsorsQuery.data.meta.total} sponsors
            </p>
          </div>
        )
      ) : null}

      {canEdit ? (
        <SponsorFormModal
          open={modalOpen}
          mode={editing ? 'edit' : 'create'}
          initialSponsor={editing}
          loading={saving}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      ) : null}
    </div>
  );
}
