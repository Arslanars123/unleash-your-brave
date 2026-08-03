import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Pencil, Star, Trash2, X } from 'lucide-react';
import { sessionsApi } from '@/features/sessions/api/sessions-api';
import { getApiErrorMessage } from '@/shared/api/client';
import type { PublicSession, PublicSessionFeedback } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Spinner } from '@/shared/ui/Spinner';
import { TextArea } from '@/shared/ui/TextArea';
import { useToast } from '@/shared/ui/toast';

function Stars({
  rating,
  interactive = false,
  onSelect,
}: {
  rating: number;
  interactive?: boolean;
  onSelect?: (value: number) => void;
}) {
  return (
    <span className="rating-stars" aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }, (_, index) => {
        const value = index + 1;
        const filled = index < rating;
        if (!interactive) {
          return (
            <Star
              key={index}
              size={14}
              fill={filled ? 'currentColor' : 'none'}
              strokeWidth={filled ? 0 : 1.75}
            />
          );
        }
        return (
          <button
            key={index}
            type="button"
            className="rating-star-button"
            aria-label={`${value} stars`}
            onClick={() => onSelect?.(value)}
          >
            <Star
              size={18}
              fill={filled ? 'currentColor' : 'none'}
              strokeWidth={filled ? 0 : 1.75}
            />
          </button>
        );
      })}
    </span>
  );
}

interface SessionFeedbackModalProps {
  open: boolean;
  session: PublicSession | null;
  onClose: () => void;
}

export function SessionFeedbackModal({ open, session, onClose }: SessionFeedbackModalProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<PublicSessionFeedback | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const feedbackQuery = useQuery({
    queryKey: ['sessions', 'feedback', session?.id],
    queryFn: () => sessionsApi.listFeedback(session!.id, { perPage: 50 }),
    enabled: open && Boolean(session?.id),
  });

  const summaryQuery = useQuery({
    queryKey: ['sessions', 'feedback-summary', session?.id],
    queryFn: () => sessionsApi.getFeedbackSummary(session!.id),
    enabled: open && Boolean(session?.id),
  });

  useEffect(() => {
    if (!open) {
      setEditing(null);
      setComment('');
      setRating(5);
    }
  }, [open]);

  async function invalidateFeedback() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['sessions', 'feedback', session?.id] }),
      queryClient.invalidateQueries({ queryKey: ['sessions', 'feedback-summary', session?.id] }),
      queryClient.invalidateQueries({ queryKey: ['sessions', 'list'] }),
    ]);
  }

  const updateMutation = useMutation({
    mutationFn: () =>
      sessionsApi.updateFeedback(session!.id, editing!.id, {
        rating,
        comment: comment.trim(),
      }),
    onSuccess: async () => {
      await invalidateFeedback();
      toast.success('Review updated');
      setEditing(null);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to update review')),
  });

  const deleteMutation = useMutation({
    mutationFn: (feedbackId: string) => sessionsApi.removeFeedback(session!.id, feedbackId),
    onSuccess: async () => {
      await invalidateFeedback();
      toast.success('Review deleted');
      if (editing) setEditing(null);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to delete review')),
  });

  if (!open || !session) return null;

  const summary = summaryQuery.data;
  const reviews = feedbackQuery.data?.items ?? [];

  function startEdit(item: PublicSessionFeedback) {
    setEditing(item);
    setRating(item.rating);
    setComment(item.comment ?? '');
  }

  async function handleDelete(item: PublicSessionFeedback) {
    const label = item.user?.name ?? 'this review';
    const confirmed = window.confirm(`Delete review from “${label}”? This cannot be undone.`);
    if (!confirmed) return;
    await deleteMutation.mutateAsync(item.id);
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel modal-panel-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-feedback-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <h2 id="session-feedback-title">Ratings & reviews</h2>
            <p className="muted" style={{ marginTop: '0.25rem' }}>
              {session.name}
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="modal-body event-form">
          {!session.feedbackEnabled ? (
            <p className="hint">Feedback is currently disabled for this session.</p>
          ) : null}

          {summaryQuery.isLoading || feedbackQuery.isLoading ? <Spinner /> : null}

          {summaryQuery.isError ? (
            <p className="form-error">{getApiErrorMessage(summaryQuery.error)}</p>
          ) : null}
          {feedbackQuery.isError ? (
            <p className="form-error">{getApiErrorMessage(feedbackQuery.error)}</p>
          ) : null}

          {summary ? (
            <div className="feedback-summary-card">
              <div>
                <p className="field-label">Average rating</p>
                <strong className="feedback-average">
                  {summary.ratingsCount > 0 ? summary.averageRating.toFixed(1) : '—'}
                </strong>
                {summary.ratingsCount > 0 ? (
                  <Stars rating={Math.round(summary.averageRating)} />
                ) : null}
              </div>
              <div>
                <p className="field-label">Total reviews</p>
                <strong>{summary.ratingsCount}</strong>
              </div>
              <div className="feedback-distribution">
                <p className="field-label">Distribution</p>
                <ul>
                  {([5, 4, 3, 2, 1] as const).map((star) => (
                    <li key={star}>
                      <span>{star}★</span>
                      <span className="muted">{summary.ratingDistribution[String(star) as '1']}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          {editing ? (
            <div className="feedback-edit-panel">
              <div className="feedback-list-header">
                <strong>Edit review — {editing.user?.name ?? 'Member'}</strong>
                <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </div>
              <label className="field">
                <span className="field-label">
                  Rating <span className="required-mark">*</span>
                </span>
                <Stars rating={rating} interactive onSelect={setRating} />
              </label>
              <TextArea
                label="Comment"
                name="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Optional review text..."
              />
              <div className="modal-actions" style={{ paddingTop: 0 }}>
                <Button
                  type="button"
                  loading={updateMutation.isPending}
                  onClick={() => updateMutation.mutate()}
                >
                  Save review
                </Button>
              </div>
            </div>
          ) : null}

          {feedbackQuery.data && reviews.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem 1rem' }}>
              <Star size={24} />
              <h2>No reviews yet</h2>
              <p className="muted">Members haven’t rated this session yet.</p>
            </div>
          ) : null}

          {reviews.length > 0 ? (
            <ul className="feedback-list">
              {reviews.map((item) => (
                <li key={item.id}>
                  <div className="feedback-list-header">
                    <strong>{item.user?.name ?? 'Member'}</strong>
                    <Stars rating={item.rating} />
                  </div>
                  {item.user?.email ? <p className="muted">{item.user.email}</p> : null}
                  {item.comment ? <p className="feedback-comment">{item.comment}</p> : null}
                  <p className="hint">
                    {new Date(item.updatedAt).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                  <div className="actions" style={{ marginTop: '0.5rem' }}>
                    <Button
                      variant="secondary"
                      disabled={Boolean(editing) || deleteMutation.isPending}
                      onClick={() => startEdit(item)}
                    >
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
