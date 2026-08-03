import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import {
  ExternalLink,
  FileText,
  FolderOpen,
  Pencil,
  Star,
  X,
} from 'lucide-react';
import { sessionsApi } from '@/features/sessions/api/sessions-api';
import { getApiErrorMessage } from '@/shared/api/client';
import { formatSessionTimeRange } from '@/shared/lib/datetime';
import { isValidMediaRef, resolveMediaUrl } from '@/shared/lib/media';
import type { PublicSession } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Spinner } from '@/shared/ui/Spinner';
import { TextArea } from '@/shared/ui/TextArea';
import { useToast } from '@/shared/ui/toast';

function Stars({ rating }: { rating: number }) {
  return (
    <span className="rating-stars" aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          size={14}
          fill={index < rating ? 'currentColor' : 'none'}
          strokeWidth={index < rating ? 0 : 1.75}
        />
      ))}
    </span>
  );
}

type ViewTab = 'details' | 'reviews';

interface ViewSessionModalProps {
  open: boolean;
  session: PublicSession | null;
  onClose: () => void;
  onManageContent: () => void;
}

export function ViewSessionModal({
  open,
  session,
  onClose,
  onManageContent,
}: ViewSessionModalProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<ViewTab>('details');
  const [editingDescription, setEditingDescription] = useState(false);
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!open || !session) return;
    setTab('details');
    setEditingDescription(false);
    setDescription(session.description ?? '');
  }, [open, session]);

  const summaryQuery = useQuery({
    queryKey: ['sessions', 'feedback-summary', session?.id],
    queryFn: () => sessionsApi.getFeedbackSummary(session!.id),
    enabled: open && Boolean(session?.id),
  });

  const reviewsQuery = useQuery({
    queryKey: ['sessions', 'feedback', session?.id],
    queryFn: () => sessionsApi.listFeedback(session!.id, { perPage: 50 }),
    enabled: open && Boolean(session?.id) && tab === 'reviews',
  });

  const saveDescriptionMutation = useMutation({
    mutationFn: (nextDescription: string) =>
      sessionsApi.update(session!.id, { description: nextDescription }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sessions', 'mine'] });
      toast.success('Description updated');
      setEditingDescription(false);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to save description')),
  });

  if (!open || !session) return null;

  const summary = summaryQuery.data;
  const reviews = reviewsQuery.data?.items ?? [];
  const ratingsCount = session.feedbackSummary?.ratingsCount ?? summary?.ratingsCount ?? 0;
  const averageRating = session.feedbackSummary?.averageRating ?? summary?.averageRating ?? 0;
  const timeRange = formatSessionTimeRange(session.startTime, session.endTime);

  async function handleSaveDescription(event: FormEvent) {
    event.preventDefault();
    await saveDescriptionMutation.mutateAsync(description.trim());
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel modal-panel-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="view-session-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <h2 id="view-session-title">View session</h2>
            <p className="muted" style={{ marginTop: '0.25rem' }}>
              {session.name}
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="modal-body event-form">
          <div className="view-session-tabs" role="tablist" aria-label="Session sections">
            <button
              type="button"
              className={tab === 'details' ? 'active' : ''}
              role="tab"
              aria-selected={tab === 'details'}
              onClick={() => setTab('details')}
            >
              Details
            </button>
            <button
              type="button"
              className={tab === 'reviews' ? 'active' : ''}
              role="tab"
              aria-selected={tab === 'reviews'}
              onClick={() => setTab('reviews')}
            >
              Reviews
              {ratingsCount > 0 ? ` (${ratingsCount})` : ''}
            </button>
          </div>

          {tab === 'details' ? (
            <>
              <div className="view-session-meta">
                <span className="badge role-member">Day {session.eventDayNumber}</span>
                {timeRange ? <span>{timeRange}</span> : null}
                {session.location?.trim() ? (
                  <span className="muted">{session.location}</span>
                ) : null}
                {ratingsCount > 0 ? (
                  <span className="session-rating-cell">
                    <Star size={14} fill="currentColor" strokeWidth={0} />
                    <strong>{averageRating.toFixed(1)}</strong>
                    <span className="muted">
                      ({ratingsCount} {ratingsCount === 1 ? 'review' : 'reviews'})
                    </span>
                  </span>
                ) : (
                  <span className="muted">No reviews yet</span>
                )}
                {!session.feedbackEnabled ? (
                  <span className="hint">Feedback is off for this session</span>
                ) : null}
              </div>

              <section className="view-session-section">
                <div className="content-materials-header">
                  <h3>Description</h3>
                  {!editingDescription ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setDescription(session.description ?? '');
                        setEditingDescription(true);
                      }}
                    >
                      <Pencil size={14} />
                      Edit
                    </Button>
                  ) : null}
                </div>

                {editingDescription ? (
                  <form
                    className="view-session-edit"
                    onSubmit={(e) => void handleSaveDescription(e)}
                  >
                    <TextArea
                      label="Description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="What attendees should know about this session…"
                    />
                    <div className="modal-actions" style={{ paddingTop: 0 }}>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setEditingDescription(false);
                          setDescription(session.description ?? '');
                        }}
                        disabled={saveDescriptionMutation.isPending}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" loading={saveDescriptionMutation.isPending}>
                        Save description
                      </Button>
                    </div>
                  </form>
                ) : (
                  <p className={session.description ? 'view-session-description' : 'muted'}>
                    {session.description || 'No description yet. Click Edit to add one.'}
                  </p>
                )}
              </section>

              <section className="view-session-section">
                <div className="content-materials-header">
                  <div>
                    <h3>Content</h3>
                    <p className="hint">
                      {session.materials.length === 0
                        ? 'No materials uploaded yet.'
                        : `${session.materials.length} ${session.materials.length === 1 ? 'item' : 'items'} uploaded.`}
                    </p>
                  </div>
                  <Button type="button" onClick={onManageContent}>
                    <FolderOpen size={14} />
                    Manage content
                  </Button>
                </div>

                {session.materials.length === 0 ? (
                  <div className="content-empty">
                    <FileText size={22} />
                    <p>No content for this session yet.</p>
                  </div>
                ) : (
                  <ul className="view-session-materials">
                    {session.materials.map((material) => (
                      <li key={material.id}>
                        <span className="badge role-admin">{material.type}</span>
                        <strong>{material.title}</strong>
                        {isValidMediaRef(material.url) ? (
                          <a
                            className="content-open-link"
                            href={resolveMediaUrl(material.url)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink size={14} />
                            Open
                          </a>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : null}

          {tab === 'reviews' ? (
            <section className="view-session-section">
              {summaryQuery.isLoading || reviewsQuery.isLoading ? <Spinner /> : null}
              {summaryQuery.isError ? (
                <p className="form-error">{getApiErrorMessage(summaryQuery.error)}</p>
              ) : null}
              {reviewsQuery.isError ? (
                <p className="form-error">{getApiErrorMessage(reviewsQuery.error)}</p>
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
                          <span className="muted">
                            {summary.ratingDistribution[String(star) as '1']}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}

              {!session.feedbackEnabled ? (
                <p className="hint">Feedback is currently disabled for this session.</p>
              ) : null}

              {reviewsQuery.data && reviews.length === 0 ? (
                <div className="content-empty">
                  <Star size={22} />
                  <p>No reviews yet for this session.</p>
                </div>
              ) : null}

              {reviews.length > 0 ? (
                <ul className="feedback-list">
                  {reviews.map((item) => (
                    <li key={item.id}>
                      <div className="feedback-list-header">
                        <strong>{item.user?.name ?? 'Attendee'}</strong>
                        <Stars rating={item.rating} />
                      </div>
                      {item.comment ? <p className="feedback-comment">{item.comment}</p> : null}
                      <p className="hint">
                        {new Date(item.updatedAt).toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
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
