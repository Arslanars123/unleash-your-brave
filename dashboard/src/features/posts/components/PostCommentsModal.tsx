import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { MessageCircle, Pencil, Trash2, X } from 'lucide-react';
import { postsApi } from '@/features/posts/api/posts-api';
import { formatUsDateTime } from '@/shared/lib/datetime';
import { getApiErrorMessage } from '@/shared/api/client';
import type { PublicPost, PublicPostComment } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { useConfirm } from '@/shared/ui/ConfirmDialog';
import { Spinner } from '@/shared/ui/Spinner';
import { TextArea } from '@/shared/ui/TextArea';
import { useToast } from '@/shared/ui/toast';

interface PostCommentsModalProps {
  open: boolean;
  post: PublicPost | null;
  onClose: () => void;
}

export function PostCommentsModal({ open, post, onClose }: PostCommentsModalProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { confirm } = useConfirm();
  const [editing, setEditing] = useState<PublicPostComment | null>(null);
  const [text, setText] = useState('');

  const commentsQuery = useQuery({
    queryKey: ['posts', 'comments', post?.id],
    queryFn: () => postsApi.listComments(post!.id, { perPage: 100 }),
    enabled: open && Boolean(post?.id),
  });

  useEffect(() => {
    if (!open) {
      setEditing(null);
      setText('');
    }
  }, [open]);

  const updateMutation = useMutation({
    mutationFn: () =>
      postsApi.updateComment(post!.id, editing!.id, { text: text.trim() }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['posts', 'comments', post?.id] }),
        queryClient.invalidateQueries({ queryKey: ['posts', 'list'] }),
      ]);
      toast.success('Comment updated');
      setEditing(null);
      setText('');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to update comment')),
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => postsApi.removeComment(post!.id, commentId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['posts', 'comments', post?.id] }),
        queryClient.invalidateQueries({ queryKey: ['posts', 'list'] }),
      ]);
      toast.success('Comment deleted');
      if (editing) {
        setEditing(null);
        setText('');
      }
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to delete comment')),
  });

  if (!open || !post) return null;

  const comments = commentsQuery.data?.items ?? [];

  function startEdit(comment: PublicPostComment) {
    setEditing(comment);
    setText(comment.text);
  }

  async function handleDelete(comment: PublicPostComment) {
    const label = comment.user?.name ?? 'this comment';
    const ok = await confirm({
      title: 'Delete comment?',
      message: `Delete comment from “${label}”?`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    await deleteMutation.mutateAsync(comment.id);
  }

  async function handleSaveComment() {
    const ok = await confirm({
      title: 'Save comment changes?',
      message: 'Update this comment?',
      confirmLabel: 'Save changes',
      tone: 'primary',
    });
    if (!ok) return;
    await updateMutation.mutateAsync();
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel modal-panel-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-comments-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <h2 id="post-comments-title">Manage comments</h2>
            <p className="muted" style={{ marginTop: '0.25rem' }}>
              {post.commentsCount} comment{post.commentsCount === 1 ? '' : 's'}
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="modal-body event-form">
          {!post.commentsEnabled ? (
            <p className="hint">Comments are turned off — attendees can’t add new ones. You can still edit or delete existing comments.</p>
          ) : null}

          {commentsQuery.isLoading ? <Spinner /> : null}
          {commentsQuery.isError ? (
            <p className="form-error">{getApiErrorMessage(commentsQuery.error)}</p>
          ) : null}

          {editing ? (
            <div className="feedback-edit-panel">
              <div className="feedback-list-header">
                <strong>Edit comment — {editing.user?.name ?? 'Attendee'}</strong>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditing(null);
                    setText('');
                  }}
                >
                  Cancel
                </Button>
              </div>
              <TextArea
                label="Comment"
                name="comment"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <div className="modal-actions" style={{ paddingTop: 0 }}>
                <Button
                  type="button"
                  loading={updateMutation.isPending}
                  disabled={!text.trim()}
                  onClick={() => void handleSaveComment()}
                >
                  Save comment
                </Button>
              </div>
            </div>
          ) : null}

          {commentsQuery.data && comments.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem 1rem' }}>
              <MessageCircle size={24} />
              <h2>No comments yet</h2>
              <p className="muted">Attendees haven’t commented on this post.</p>
            </div>
          ) : null}

          {comments.length > 0 ? (
            <ul className="feedback-list">
              {comments.map((comment) => (
                <li key={comment.id}>
                  <div className="feedback-list-header">
                    <strong>{comment.user?.name ?? 'Attendee'}</strong>
                    <span className="hint">
                      {formatUsDateTime(comment.updatedAt)}
                    </span>
                  </div>
                  {comment.user?.email ? <p className="muted">{comment.user.email}</p> : null}
                  <p className="feedback-comment">{comment.text}</p>
                  <div className="actions" style={{ marginTop: '0.5rem' }}>
                    <Button
                      variant="secondary"
                      disabled={Boolean(editing) || deleteMutation.isPending}
                      onClick={() => startEdit(comment)}
                    >
                      <Pencil size={14} />
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      disabled={deleteMutation.isPending}
                      onClick={() => void handleDelete(comment)}
                    >
                      <Trash2 size={14} />
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
