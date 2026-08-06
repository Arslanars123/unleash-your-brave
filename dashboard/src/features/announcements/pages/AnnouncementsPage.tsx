import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Bell, Megaphone, Pencil, Plus, Trash2 } from 'lucide-react';
import { announcementsApi } from '@/features/announcements/api/announcements-api';
import { AnnouncementFormModal } from '@/features/announcements/components/AnnouncementFormModal';
import { getApiErrorMessage } from '@/shared/api/client';
import type { AnnouncementPayload, PublicAnnouncement } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

function statusLabel(item: PublicAnnouncement): string {
  if (item.kind === 'system') return 'System';
  return item.status.charAt(0).toUpperCase() + item.status.slice(1);
}

function audienceLabel(item: PublicAnnouncement): string {
  if (item.audienceType === 'all') return 'All attendees';
  if (item.audienceType === 'roles') {
    return (item.audienceRoles ?? []).join(', ') || 'Groups';
  }
  const count = item.audienceUserIds?.length ?? 0;
  return `${count} attendee${count === 1 ? '' : 's'}`;
}

function whenLabel(item: PublicAnnouncement): string {
  if (item.status === 'scheduled' && item.scheduledAt) {
    return `Scheduled ${new Date(item.scheduledAt).toLocaleString()}`;
  }
  if (item.publishedAt) {
    return new Date(item.publishedAt).toLocaleString();
  }
  return new Date(item.updatedAt).toLocaleString();
}

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
          <p className="muted">
            Publish or schedule notices with push delivery. Manual and automatic countdown notices
            share one attendee feed.
          </p>
        </div>
        <div className="page-header-actions">
          <Link to="/announcements/countdown">
            <Button variant="secondary" type="button">
              <Bell size={16} />
              Countdown settings
            </Button>
          </Link>
          <Button onClick={openCreate}>
            <Plus size={16} />
            Create announcement
          </Button>
        </div>
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
                  <th>Status</th>
                  <th>Audience</th>
                  <th>When</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {listQuery.data.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.title}</strong>
                      {item.description ? (
                        <div className="cell-clamp muted">{item.description}</div>
                      ) : null}
                    </td>
                    <td>
                      <span className={`status-pill status-${item.status}`}>
                        {statusLabel(item)}
                      </span>
                      {item.sendPush && item.status !== 'draft' ? (
                        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                          Push on
                        </div>
                      ) : null}
                    </td>
                    <td>{audienceLabel(item)}</td>
                    <td>{whenLabel(item)}</td>
                    <td className="actions">
                      {item.kind !== 'system' ? (
                        <Button variant="secondary" onClick={() => openEdit(item)}>
                          <Pencil size={14} />
                          Edit
                        </Button>
                      ) : null}
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
