import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { BadgeCheck, Pencil, Plus, Trash2, X } from 'lucide-react';
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

  const membershipsQuery = useQuery({
    queryKey: ['memberships', 'list', search, page],
    queryFn: () =>
      membershipsApi.list({
        search: search || undefined,
        page,
        perPage: PER_PAGE,
      }),
  });

  function applySearch(next: string) {
    setSearch(next);
    setPage(1);
  }

  async function invalidateMembershipQueries() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['memberships', 'list'] }),
      queryClient.invalidateQueries({ queryKey: ['memberships', 'library'] }),
    ]);
  }

  const createMutation = useMutation({
    mutationFn: (payload: MembershipPayload) => membershipsApi.create(payload),
    onSuccess: async () => {
      await invalidateMembershipQueries();
      toast.success('Membership created');
      closeModal();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to create membership')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: MembershipPayload }) =>
      membershipsApi.update(id, payload),
    onSuccess: async () => {
      await invalidateMembershipQueries();
      toast.success('Membership updated');
      closeModal();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to update membership')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => membershipsApi.remove(id),
    onSuccess: async () => {
      await invalidateMembershipQueries();
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
    await createMutation.mutateAsync(payload);
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

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="page-kicker">Access</span>
          <h1>Memberships</h1>
          <p className="muted">
            Shared membership library. Create tiers here, then link them to events from Edit edition.
            The same tier can appear on multiple events.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} />
          Create membership
        </Button>
      </header>

      <div className="toolbar">
        <SearchSuggest
          label="Search"
          placeholder="Membership name or description"
          value={search}
          onChange={applySearch}
          loadSuggestions={async (draft) => {
            const result = await membershipsApi.list({
              search: draft,
              perPage: 6,
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

      {membershipsQuery.isLoading ? <Spinner /> : null}
      {membershipsQuery.isError ? (
        <p className="form-error">{getApiErrorMessage(membershipsQuery.error)}</p>
      ) : null}

      {membershipsQuery.data ? (
        membershipsQuery.data.items.length === 0 ? (
          <div className="empty-state">
            <BadgeCheck size={28} />
            <h2>No memberships yet</h2>
            <p className="muted">
              Add tiers to the shared library, then link them to an event from Edit edition.
            </p>
            <Button onClick={openCreate}>
              <Plus size={16} />
              Create membership
            </Button>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Price</th>
                  <th>Description</th>
                  <th />
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

      <MembershipFormModal
        open={modalOpen}
        mode={editing ? 'edit' : 'create'}
        initialMembership={editing}
        siblings={membershipsQuery.data?.items ?? []}
        loading={saving}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
