import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Handshake, Pencil, Plus, Trash2, X } from 'lucide-react';
import { eventsApi } from '@/features/events/api/events-api';
import { sponsorsApi } from '@/features/sponsors/api/sponsors-api';
import { SponsorFormModal } from '@/features/sponsors/components/SponsorFormModal';
import { formatEditionRange } from '@/shared/lib/datetime';
import { getApiErrorMessage } from '@/shared/api/client';
import { resolveMediaUrl } from '@/shared/lib/media';
import type { PublicEvent, PublicSponsor, SponsorPayload } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { useConfirm } from '@/shared/ui/ConfirmDialog';
import { ListPagination } from '@/shared/ui/ListPagination';
import { SearchSuggest } from '@/shared/ui/SearchSuggest';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

const PER_PAGE = 20;

function editionLabel(edition: PublicEvent): string {
  return `${formatEditionRange(edition)} (${edition.status})`;
}

export function SponsorsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PublicSponsor | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();
  const { confirm } = useConfirm();

  const sponsorsQuery = useQuery({
    queryKey: ['sponsors', 'list', search, page],
    queryFn: () =>
      sponsorsApi.list({
        search: search || undefined,
        page,
        perPage: PER_PAGE,
      }),
  });

  const workspaceQuery = useQuery({
    queryKey: ['events', 'workspace'],
    queryFn: () => eventsApi.getWorkspace(),
  });

  const eventOptions = useMemo(() => {
    const workspace = workspaceQuery.data;
    if (!workspace) return [];
    const editions: PublicEvent[] = [
      workspace.current,
      ...(workspace.upcomingEditions ?? []),
      ...(workspace.pastEditions ?? []),
      ...(workspace.editions ?? []),
    ].filter((edition): edition is PublicEvent => Boolean(edition));
    const seen = new Set<string>();
    return editions
      .filter((edition) => {
        if (seen.has(edition.id)) return false;
        seen.add(edition.id);
        return true;
      })
      .map((edition) => ({
        id: edition.id,
        label: editionLabel(edition),
      }));
  }, [workspaceQuery.data]);

  function applySearch(next: string) {
    setSearch(next);
    setPage(1);
  }

  async function invalidateSponsorQueries() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['sponsors', 'list'] }),
      queryClient.invalidateQueries({ queryKey: ['sponsors', 'library'] }),
    ]);
  }

  const createMutation = useMutation({
    mutationFn: (payload: SponsorPayload) => sponsorsApi.create(payload),
    onSuccess: async () => {
      await invalidateSponsorQueries();
      toast.success('Sponsor created');
      closeModal();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to create sponsor')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: SponsorPayload }) =>
      sponsorsApi.update(id, payload),
    onSuccess: async () => {
      await invalidateSponsorQueries();
      toast.success('Sponsor updated');
      closeModal();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to update sponsor')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sponsorsApi.remove(id),
    onSuccess: async () => {
      await invalidateSponsorQueries();
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
      const ok = await confirm({
        title: 'Save sponsor changes?',
        message: `Update “${editing.name}”?`,
        confirmLabel: 'Save changes',
        tone: 'primary',
      });
      if (!ok) return;
      await updateMutation.mutateAsync({ id: editing.id, payload });
      return;
    }
    await createMutation.mutateAsync(payload);
  }

  async function handleDelete(sponsor: PublicSponsor) {
    const ok = await confirm({
      title: 'Delete sponsor?',
      message: `Delete “${sponsor.name}”? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    await deleteMutation.mutateAsync(sponsor.id);
  }

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="page-kicker">Partners</span>
          <h1>Sponsors</h1>
          <p className="muted">
            Shared sponsor library. Create sponsors here, then link them to events from Edit edition.
            Offers are event-specific — choose an event when adding offers.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} />
          Create sponsor
        </Button>
      </header>

      <div className="toolbar">
        <SearchSuggest
          label="Search"
          placeholder="Sponsor name or description"
          value={search}
          onChange={applySearch}
          loadSuggestions={async (draft) => {
            const result = await sponsorsApi.list({
              search: draft,
              perPage: 6,
            });
            return result.items.map((sponsor) => ({
              id: sponsor.id,
              title: sponsor.name,
              subtitle: sponsor.description?.slice(0, 60) || undefined,
              leading: sponsor.image ? (
                <img src={resolveMediaUrl(sponsor.image)} alt="" />
              ) : (
                <span>{sponsor.name.charAt(0).toUpperCase()}</span>
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

      {sponsorsQuery.isLoading ? <Spinner /> : null}
      {sponsorsQuery.isError ? (
        <p className="form-error">{getApiErrorMessage(sponsorsQuery.error)}</p>
      ) : null}

      {sponsorsQuery.data ? (
        sponsorsQuery.data.items.length === 0 ? (
          <div className="empty-state">
            <Handshake size={28} />
            <h2>No sponsors yet</h2>
            <p className="muted">
              Add sponsors to the shared library, link them to an event, then add offers for that
              event.
            </p>
            <Button onClick={openCreate}>
              <Plus size={16} />
              Create sponsor
            </Button>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Sponsor</th>
                  <th>Offers</th>
                  <th>Description</th>
                  <th />
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
                      <span className="badge role-member">Per event</span>
                    </td>
                    <td>
                      <span className="cell-clamp">{sponsor.description || '—'}</span>
                    </td>
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
                  </tr>
                ))}
              </tbody>
            </table>
            <ListPagination
              page={sponsorsQuery.data.meta.page}
              totalPages={sponsorsQuery.data.meta.totalPages}
              total={sponsorsQuery.data.meta.total}
              perPage={sponsorsQuery.data.meta.perPage}
              onPageChange={setPage}
              label="sponsors"
            />
          </div>
        )
      ) : null}

      <SponsorFormModal
        open={modalOpen}
        mode={editing ? 'edit' : 'create'}
        initialSponsor={editing}
        eventOptions={eventOptions}
        loadOffersForEvent={
          editing
            ? async (eventId) => {
                const sponsor = await sponsorsApi.getById(editing.id, { eventId });
                return sponsor.offers;
              }
            : undefined
        }
        loading={saving}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
