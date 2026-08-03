import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Megaphone, Pencil, Plus, Trash2 } from 'lucide-react';
import { announcementsApi } from '@/features/announcements/api/announcements-api';
import { AnnouncementFormModal } from '@/features/announcements/components/AnnouncementFormModal';
import { getApiErrorMessage } from '@/shared/api/client';
import type { AnnouncementPayload, PublicAnnouncement } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

export function AnnouncementsPage() {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PublicAnnouncement | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const listQuery = useQuery({
    queryKey: ['announcements', 'list', search],
    queryFn: () => announcementsApi.list({ search: search || undefined, perPage: 50 }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: AnnouncementPayload) => announcementsApi.create(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['announcements', 'list'] });
      toast.success('Announcement created');
      closeModal();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to create announcement')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AnnouncementPayload }) =>
      announcementsApi.update(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['announcements', 'list'] });
      toast.success('Announcement updated');
      closeModal();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to update announcement')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => announcementsApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['announcements', 'list'] });
      toast.success('Announcement deleted');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to delete announcement')),
  });

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(item: PublicAnnouncement) {
    setEditing(item);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  async function handleSubmit(payload: AnnouncementPayload) {
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, payload });
      return;
    }
    await createMutation.mutateAsync(payload);
  }

  async function handleDelete(item: PublicAnnouncement) {
    const confirmed = window.confirm(`Delete “${item.title}”? This cannot be undone.`);
    if (!confirmed) return;
    await deleteMutation.mutateAsync(item.id);
  }

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Announcements</h1>
          <p className="muted">Simple title + description notices for attendees. No likes or comments.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} />
          Create announcement
        </Button>
      </header>

      <div className="toolbar">
        <Input
          label="Search"
          placeholder="Title or description"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {listQuery.isLoading ? <Spinner /> : null}
      {listQuery.isError ? (
        <p className="form-error">{getApiErrorMessage(listQuery.error)}</p>
      ) : null}

      {listQuery.data ? (
        listQuery.data.items.length === 0 ? (
          <div className="empty-state">
            <Megaphone size={28} />
            <h2>No announcements yet</h2>
            <p className="muted">Share schedule updates, reminders, and venue notes.</p>
            <Button onClick={openCreate}>
              <Plus size={16} />
              Create announcement
            </Button>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Description</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {listQuery.data.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.title}</strong>
                    </td>
                    <td>
                      <span className="cell-clamp">{item.description || '—'}</span>
                    </td>
                    <td>{new Date(item.updatedAt).toLocaleDateString()}</td>
                    <td className="actions">
                      <Button variant="secondary" onClick={() => openEdit(item)}>
                        <Pencil size={14} />
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        disabled={deleteMutation.isPending}
                        onClick={() => void handleDelete(item)}
                      >
                        <Trash2 size={14} />
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      <AnnouncementFormModal
        open={modalOpen}
        mode={editing ? 'edit' : 'create'}
        initialAnnouncement={editing}
        loading={saving}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
