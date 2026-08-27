import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Eye, Pencil, Plus, Trash2, Users, X } from 'lucide-react';
import { usersApi } from '@/features/users/api/users-api';
import { membershipsApi } from '@/features/memberships/api/memberships-api';
import { useEditionScope } from '@/features/events/hooks/useEditionScope';
import { EditionSwitcher } from '@/features/events/components/EditionSwitcher';
import { AttendeeDetailModal } from '@/features/users/components/AttendeeDetailModal';
import { AttendeeFormModal } from '@/features/users/components/AttendeeFormModal';
import { useAttendeeRealtime } from '@/features/users/hooks/useAttendeeRealtime';
import { getApiErrorMessage } from '@/shared/api/client';
import type { CreateUserPayload, PublicUser, UpdateUserPayload, UserStatus } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { useConfirm } from '@/shared/ui/ConfirmDialog';
import { ListPagination } from '@/shared/ui/ListPagination';
import { SearchSuggest } from '@/shared/ui/SearchSuggest';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

const PER_PAGE = 20;

export function UsersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PublicUser | null>(null);
  const [viewing, setViewing] = useState<PublicUser | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();
  const { confirm } = useConfirm();
  const { eventId, selectedEdition, clearEditionFilter } = useEditionScope({ optional: true });

  useAttendeeRealtime(true);

  useEffect(() => {
    setPage(1);
  }, [eventId]);

  const membershipsQuery = useQuery({
    queryKey: ['memberships', 'list', eventId ?? 'library', 'attendee-form'],
    queryFn: () =>
      membershipsApi.list({
        perPage: 100,
        ...(eventId ? { eventId } : {}),
      }),
  });

  const usersQuery = useQuery({
    queryKey: ['users', 'list', 'attendees', eventId ?? 'all', search, page],
    queryFn: () =>
      usersApi.list({
        search: search || undefined,
        page,
        perPage: PER_PAGE,
        attendeesOnly: true,
        ...(eventId ? { eventId } : {}),
      }),
    refetchInterval: 15_000,
  });
  function applySearch(next: string) {
    setSearch(next);
    setPage(1);
  }

  const createMutation = useMutation({
    mutationFn: (payload: CreateUserPayload) => usersApi.create(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['users', 'list'] }),
        queryClient.invalidateQueries({ queryKey: ['users', 'stats'] }),
      ]);
      toast.success('Attendee created — invite code emailed');
      closeModal();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to create attendee')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateUserPayload }) =>
      usersApi.update(id, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['users', 'list'] }),
        queryClient.invalidateQueries({ queryKey: ['users', 'stats'] }),
      ]);
      toast.success('Attendee updated');
      closeModal();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to update attendee')),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) =>
      usersApi.updateStatus(id, status),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['users', 'list'] }),
        queryClient.invalidateQueries({ queryKey: ['users', 'stats'] }),
      ]);
      toast.success(
        variables.status === 'suspended' ? 'Attendee suspended' : 'Attendee activated',
      );
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to update status')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['users', 'list'] }),
        queryClient.invalidateQueries({ queryKey: ['users', 'stats'] }),
      ]);
      toast.success('Attendee deleted');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to delete attendee')),
  });

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(user: PublicUser) {
    setViewing(null);
    setEditing(user);
    setModalOpen(true);
  }

  function openView(user: PublicUser) {
    setViewing(user);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  async function handleSubmit(payload: CreateUserPayload | UpdateUserPayload) {
    if (editing) {
      const label = editing.fullName || editing.name || editing.email;
      const ok = await confirm({
        title: 'Save attendee changes?',
        message: `Update “${label}”?`,
        confirmLabel: 'Save changes',
        tone: 'primary',
      });
      if (!ok) return;
      await updateMutation.mutateAsync({ id: editing.id, payload });
      return;
    }
    await createMutation.mutateAsync(payload as CreateUserPayload);
  }

  async function handleDelete(user: PublicUser) {
    const label = user.fullName || user.name || user.email;
    const ok = await confirm({
      title: 'Delete attendee?',
      message: `Delete “${label}”? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    await deleteMutation.mutateAsync(user.id);
  }

  async function handleStatusToggle(user: PublicUser) {
    const nextStatus: UserStatus = user.status === 'suspended' ? 'active' : 'suspended';
    const label = user.fullName || user.name || user.email;
    const ok = await confirm({
      title: nextStatus === 'suspended' ? 'Suspend attendee?' : 'Activate attendee?',
      message:
        nextStatus === 'suspended'
          ? `Suspend “${label}”? They will not be able to sign in until activated again.`
          : `Activate “${label}”? They will be able to sign in again.`,
      confirmLabel: nextStatus === 'suspended' ? 'Suspend' : 'Activate',
      tone: nextStatus === 'suspended' ? 'danger' : 'primary',
    });
    if (!ok) return;
    await statusMutation.mutateAsync({ id: user.id, status: nextStatus });
  }

  const saving = createMutation.isPending || updateMutation.isPending;
  const memberships = membershipsQuery.data?.items ?? [];

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="page-kicker">People</span>
          <h1>Attendees</h1>
          <p className="muted">
            All attendees by default. Optionally filter by edition to see only people who purchased
            for that event.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} />
          Create attendee
        </Button>
      </header>

      <EditionSwitcher
        allowAll
        allLabel="All events"
        tipText="Select an edition to filter attendees for that event only."
      />

      <div className="toolbar">
        <SearchSuggest
          label="Search"
          placeholder="Name, email, title, business…"
          value={search}
          onChange={applySearch}
          loadSuggestions={async (draft) => {
            const result = await usersApi.list({
              search: draft,
              perPage: 6,
              attendeesOnly: true,
              ...(eventId ? { eventId } : {}),
            });
            return result.items.map((user) => ({
              id: user.id,
              title: user.fullName || user.name,
              subtitle: [user.title, user.email].filter(Boolean).join(' · '),
              leading: user.photoUrl ? (
                <img src={user.photoUrl} alt="" />
              ) : (
                <span>{(user.fullName || user.name).charAt(0).toUpperCase()}</span>
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
      {eventId ? (
        <div className="active-filter-chip">
          Filtered by selected edition
          <button type="button" aria-label="Clear edition filter" onClick={clearEditionFilter}>
            <X size={14} />
          </button>
        </div>
      ) : null}

      {usersQuery.isLoading ? <Spinner /> : null}
      {usersQuery.isError ? (
        <p className="form-error">{getApiErrorMessage(usersQuery.error)}</p>
      ) : null}

      {usersQuery.data ? (
        usersQuery.data.items.length === 0 ? (
          <div className="empty-state">
            <Users size={28} />
            <h2>{eventId ? 'No attendees for this edition' : 'No attendees yet'}</h2>
            <p className="muted">
              {eventId
                ? 'Only people with a purchase, ticket, or membership for this event appear here.'
                : 'Add member profiles, or filter by edition to see purchasers for a specific event.'}
            </p>
            <Button onClick={openCreate}>
              <Plus size={16} />
              Create attendee
            </Button>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Title</th>
                  <th>Email</th>
                  <th>VIP</th>
                  <th>Points</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {usersQuery.data.items.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="speaker-cell">
                        {user.photoUrl ? (
                          <img
                            className="speaker-avatar"
                            src={user.photoUrl}
                            alt={user.fullName || user.name}
                          />
                        ) : (
                          <span className="speaker-avatar placeholder">
                            {(user.fullName || user.name).charAt(0).toUpperCase()}
                          </span>
                        )}
                        <div>
                          <strong>{user.fullName || user.name}</strong>
                          {user.profileCompleted ? (
                            <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
                              Profile complete
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td>{user.title || '—'}</td>
                    <td>{user.email}</td>
                    <td>{user.isVip ? 'Yes' : '—'}</td>
                    <td>{user.points ?? 0}</td>
                    <td>
                      <span className={`badge status-${user.status}`}>{user.status}</span>
                    </td>
                    <td className="actions">
                      <Button variant="secondary" onClick={() => openView(user)}>
                        <Eye size={14} />
                        View
                      </Button>
                      <Button variant="secondary" onClick={() => openEdit(user)}>
                        <Pencil size={14} />
                        Edit
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={statusMutation.isPending}
                        onClick={() => void handleStatusToggle(user)}
                      >
                        {user.status === 'active' ? 'Suspend' : 'Activate'}
                      </Button>
                      <Button
                        variant="danger"
                        disabled={deleteMutation.isPending}
                        onClick={() => void handleDelete(user)}
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
              page={usersQuery.data.meta.page}
              totalPages={usersQuery.data.meta.totalPages}
              total={usersQuery.data.meta.total}
              perPage={usersQuery.data.meta.perPage}
              onPageChange={setPage}
              label="attendees"
            />
          </div>
        )
      ) : null}

      <AttendeeDetailModal
        open={Boolean(viewing)}
        user={viewing}
        preferredEventId={eventId}
        preferredEventLabel={selectedEdition?.name}
        onClose={() => setViewing(null)}
        onEdit={openEdit}
      />

      <AttendeeFormModal
        open={modalOpen}
        mode={editing ? 'edit' : 'create'}
        initialUser={editing}
        memberships={memberships}
        loading={saving}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
