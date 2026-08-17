import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { BadgeCheck, Pencil, Plus, Trash2, X } from 'lucide-react';
import { EditionSwitcher } from '@/features/events/components/EditionSwitcher';
import { useEditionScope } from '@/features/events/hooks/useEditionScope';
import { membershipsApi } from '@/features/memberships/api/memberships-api';
import { MembershipFormModal } from '@/features/memberships/components/MembershipFormModal';
import { getApiErrorMessage } from '@/shared/api/client';
import type { MembershipPayload, PublicMembership } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { useConfirm } from '@/shared/ui/ConfirmDialog';
import { ListPagination } from '@/shared/ui/ListPagination';
import { SearchSuggest } from '@/shared/ui/SearchSuggest';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

const PER_PAGE = 20;

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
}

export function MembershipsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PublicMembership | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();
  const { confirm } = useConfirm();
  const { eventId, isPastEdition, workspaceQuery } = useEditionScope();

  const membershipsQuery = useQuery({
    queryKey: ['memberships', 'list', eventId, search, page],
    queryFn: () =>
      membershipsApi.list({
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
    mutationFn: (payload: MembershipPayload) => membershipsApi.create(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['memberships', 'list'] });
      toast.success('Membership created');
      closeModal();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to create membership')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: MembershipPayload }) =>
      membershipsApi.update(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['memberships', 'list'] });
      toast.success('Membership updated');
      closeModal();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to update membership')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => membershipsApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['memberships', 'list'] });
      toast.success('Membership deleted');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to delete membership')),
  });

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(membership: PublicMembership) {
    setEditing(membership);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  async function handleSubmit(payload: MembershipPayload) {
    if (editing) {
      const ok = await confirm({
        title: 'Save membership changes?',
        message: `Update “${editing.name}”?`,
        confirmLabel: 'Save changes',
        tone: 'primary',
      });
      if (!ok) return;
      await updateMutation.mutateAsync({ id: editing.id, payload });
      return;
    }
    if (!eventId) {
      toast.error('Schedule an event before adding memberships');
      return;
    }
    await createMutation.mutateAsync({ ...payload, eventId });
  }

  async function handleDelete(membership: PublicMembership) {
    const ok = await confirm({
      title: 'Delete membership?',
      message: `Delete “${membership.name}”? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    await deleteMutation.mutateAsync(membership.id);
  }

  const saving = createMutation.isPending || updateMutation.isPending;
  const bootstrapLoading =
    workspaceQuery.isLoading || (Boolean(eventId) && membershipsQuery.isLoading);
  const canEdit = Boolean(eventId);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="page-kicker">Access</span>
          <h1>Memberships</h1>
          <p className="muted">
            {isPastEdition
              ? 'Membership tiers from a past edition.'
              : 'Define membership tiers and restrict sessions by tier.'}
          </p>
        </div>
        {canEdit ? (
          <Button onClick={openCreate}>
            <Plus size={16} />
            Create membership
          </Button>
        ) : null}
      </header>

      <EditionSwitcher />

      <div className="toolbar">
        <SearchSuggest
          label="Search"
          placeholder="Membership name or description"
          value={search}
          onChange={applySearch}
          disabled={!eventId}
          loadSuggestions={async (draft) => {
            if (!eventId) return [];
            const result = await membershipsApi.list({
              search: draft,
              perPage: 6,
              eventId,
            });
            return result.items.map((membership) => ({
              id: membership.id,
              title: membership.name,
              subtitle: membership.description?.slice(0, 60) || undefined,
              leading: <BadgeCheck size={16} />,
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
      {membershipsQuery.isError ? (
        <p className="form-error">{getApiErrorMessage(membershipsQuery.error)}</p>
      ) : null}
      {!bootstrapLoading && !eventId ? (
        <p className="form-error">Schedule an event on the Event page before managing memberships.</p>
      ) : null}

      {eventId && membershipsQuery.data ? (
        membershipsQuery.data.items.length === 0 ? (
          <div className="empty-state">
            <BadgeCheck size={28} />
            <h2>No memberships for this edition</h2>
            <p className="muted">
              {isPastEdition
                ? 'This past edition has no membership tiers saved.'
                : 'Add Standard, VIP, or other tiers for this edition.'}
            </p>
            {canEdit ? (
              <Button onClick={openCreate}>
                <Plus size={16} />
                Create membership
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Price</th>
                  <th>Description</th>
                  {canEdit ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {membershipsQuery.data.items.map((membership) => (
                  <tr key={membership.id}>
                    <td>
                      <strong>{membership.name}</strong>
                    </td>
                    <td>{formatPrice(membership.price)}</td>
                    <td>
                      <span className="cell-clamp">{membership.description || '—'}</span>
                    </td>
                    {canEdit ? (
                      <td className="actions">
                        <Button variant="secondary" onClick={() => openEdit(membership)}>
                          <Pencil size={14} />
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          disabled={deleteMutation.isPending}
                          onClick={() => void handleDelete(membership)}
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
              page={membershipsQuery.data.meta.page}
              totalPages={membershipsQuery.data.meta.totalPages}
              total={membershipsQuery.data.meta.total}
              perPage={membershipsQuery.data.meta.perPage}
              onPageChange={setPage}
              label="memberships"
            />
          </div>
        )
      ) : null}

      {canEdit ? (
        <MembershipFormModal
          open={modalOpen}
          mode={editing ? 'edit' : 'create'}
          initialMembership={editing}
          siblings={membershipsQuery.data?.items ?? []}
          loading={saving}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      ) : null}
    </div>
  );
}
