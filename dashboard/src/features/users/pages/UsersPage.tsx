import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Eye, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { usersApi } from '@/features/users/api/users-api';
import { AttendeeDetailModal } from '@/features/users/components/AttendeeDetailModal';
import { AttendeeFormModal } from '@/features/users/components/AttendeeFormModal';
import { useAttendeeRealtime } from '@/features/users/hooks/useAttendeeRealtime';
import { getApiErrorMessage } from '@/shared/api/client';
import type { CreateUserPayload, PublicUser, UpdateUserPayload, UserStatus } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

export function UsersPage() {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PublicUser | null>(null);
  const [viewing, setViewing] = useState<PublicUser | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  useAttendeeRealtime(true);

  const usersQuery = useQuery({
    queryKey: ['users', 'list', 'member', search],
    queryFn: () =>
      usersApi.list({ search: search || undefined, perPage: 50, role: 'member' }),
    refetchInterval: 15_000,
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateUserPayload) => usersApi.create(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['users', 'list'] }),
        queryClient.invalidateQueries({ queryKey: ['users', 'stats'] }),
      ]);
      toast.success('Attendee created');
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
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['users', 'list'] }),
        queryClient.invalidateQueries({ queryKey: ['users', 'stats'] }),
      ]);
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
      await updateMutation.mutateAsync({ id: editing.id, payload });
      return;
    }
    await createMutation.mutateAsync(payload as CreateUserPayload);
  }

  async function handleDelete(user: PublicUser) {
    const confirmed = window.confirm(`Delete “${user.fullName || user.name}”? This cannot be undone.`);
    if (!confirmed) return;
    await deleteMutation.mutateAsync(user.id);
  }

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Attendees</h1>
          <p className="muted">Create and manage member profiles for the event.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} />
          Create attendee
        </Button>
      </header>

      <div className="toolbar">
        <Input
          label="Search"
          placeholder="Name, email, title, business..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {usersQuery.isLoading ? <Spinner /> : null}
      {usersQuery.isError ? (
        <p className="form-error">{getApiErrorMessage(usersQuery.error)}</p>
      ) : null}

      {usersQuery.data ? (
        usersQuery.data.items.length === 0 ? (
          <div className="empty-state">
            <Users size={28} />
            <h2>No attendees yet</h2>
            <p className="muted">Add member profiles with VIP status, points, and networking prefs.</p>
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
                        onClick={() =>
                          statusMutation.mutate({
                            id: user.id,
                            status: user.status === 'active' ? 'suspended' : 'active',
                          })
                        }
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
            <p className="muted table-meta">
              Showing {usersQuery.data.items.length} of {usersQuery.data.meta.total} attendees
            </p>
          </div>
        )
      ) : null}

      <AttendeeDetailModal
        open={Boolean(viewing)}
        user={viewing}
        onClose={() => setViewing(null)}
        onEdit={openEdit}
      />

      <AttendeeFormModal
        open={modalOpen}
        mode={editing ? 'edit' : 'create'}
        initialUser={editing}
        loading={saving}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
