import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { announcementsApi } from '@/features/announcements/api/announcements-api';
import { getApiErrorMessage } from '@/shared/api/client';
import { Button } from '@/shared/ui/Button';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

export function PortalNotificationsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const feedQuery = useQuery({
    queryKey: ['announcements', 'feed'],
    queryFn: () => announcementsApi.feed({ page: 1, perPage: 100, filter: 'all' }),
  });

  async function markRead(id: string) {
    try {
      await announcementsApi.markRead(id);
      void queryClient.invalidateQueries({ queryKey: ['announcements', 'feed'] });
      void queryClient.invalidateQueries({ queryKey: ['announcements', 'unread-count'] });
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to mark as read'));
    }
  }

  async function markAllRead() {
    const unread = (feedQuery.data?.items ?? []).filter((item) => !item.isRead);
    try {
      await Promise.all(unread.map((item) => announcementsApi.markRead(item.id)));
      void queryClient.invalidateQueries({ queryKey: ['announcements', 'feed'] });
      void queryClient.invalidateQueries({ queryKey: ['announcements', 'unread-count'] });
      toast.success('All notifications marked as read');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to mark all as read'));
    }
  }

  const items = feedQuery.data?.items ?? [];
  const unreadCount = feedQuery.data?.unreadCount ?? 0;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="page-kicker">Inbox</span>
          <h1>Notifications</h1>
          <p className="muted">Announcements sent to your speaker or sponsor account.</p>
        </div>
        {unreadCount > 0 ? (
          <Button variant="secondary" onClick={() => void markAllRead()}>
            Mark all read
          </Button>
        ) : null}
      </header>

      {feedQuery.isLoading ? <Spinner /> : null}
      {feedQuery.isError ? (
        <p className="form-error">{getApiErrorMessage(feedQuery.error)}</p>
      ) : null}

      {!feedQuery.isLoading && items.length === 0 ? (
        <div className="empty-state">
          <Bell size={28} />
          <h2>No notifications yet</h2>
          <p className="muted">When staff send you an announcement, it will appear here.</p>
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 12 }}>
        {items.map((item) => (
          <article
            key={item.id}
            className="panel"
            style={{
              borderColor: item.isRead ? undefined : 'var(--accent, #c45c7a)',
              opacity: item.isRead ? 0.92 : 1,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                alignItems: 'flex-start',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  {!item.isRead ? (
                    <span className="status-pill status-published">Unread</span>
                  ) : (
                    <span className="status-pill status-draft">Read</span>
                  )}
                  <span className="muted" style={{ fontSize: 12 }}>
                    {item.publishedAt
                      ? new Date(item.publishedAt).toLocaleString()
                      : new Date(item.createdAt).toLocaleString()}
                  </span>
                </div>
                <h2 style={{ margin: '0 0 8px', fontSize: '1.1rem' }}>{item.title}</h2>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  {item.description || '—'}
                </p>
              </div>
              {!item.isRead ? (
                <Button variant="secondary" onClick={() => void markRead(item.id)}>
                  Mark read
                </Button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
