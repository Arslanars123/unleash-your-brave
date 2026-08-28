import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/shared/ui/Button';

interface AttendeeDeleteModalProps {
  open: boolean;
  attendeeLabel: string;
  eventLabel?: string | null;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (options: { scope: 'event' | 'all'; eventId?: string }) => void;
}

export function AttendeeDeleteModal({
  open,
  attendeeLabel,
  eventLabel,
  loading = false,
  onClose,
  onConfirm,
}: AttendeeDeleteModalProps) {
  const [deleteFromAll, setDeleteFromAll] = useState(false);
  const scopedToEvent = Boolean(eventLabel);

  useEffect(() => {
    if (!open) return;
    setDeleteFromAll(false);
  }, [open, eventLabel, attendeeLabel]);

  if (!open) return null;

  const title = scopedToEvent && !deleteFromAll ? 'Remove from this event?' : 'Delete from all events?';
  const message = scopedToEvent
    ? deleteFromAll
      ? `Delete “${attendeeLabel}” from every event? This removes their account and all event records permanently.`
      : `You currently have ${eventLabel} selected. “${attendeeLabel}” will only be removed from this event. Their account stays active for other events.`
    : `Do you want to delete “${attendeeLabel}” from all events? This removes their account and all event records permanently.`;

  return (
    <div className="modal-backdrop confirm-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel confirm-panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="attendee-delete-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div className="confirm-body" style={{ margin: 0 }}>
            <div className="confirm-icon confirm-icon-danger" aria-hidden>
              <AlertTriangle size={22} />
            </div>
            <div className="confirm-copy">
              <h2 id="attendee-delete-title">{title}</h2>
              <p className="muted" style={{ margin: 0 }}>
                {message}
              </p>
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        {scopedToEvent ? (
          <label className="checkbox-row" style={{ margin: '0 24px 16px' }}>
            <input
              type="checkbox"
              checked={deleteFromAll}
              disabled={loading}
              onChange={(event) => setDeleteFromAll(event.target.checked)}
            />
            <span>
              <strong>Delete from all events</strong> — remove account and every event record
            </span>
          </label>
        ) : null}

        <div className="modal-actions confirm-actions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={loading}
            onClick={() =>
              onConfirm({
                scope: scopedToEvent && !deleteFromAll ? 'event' : 'all',
              })
            }
          >
            {scopedToEvent && !deleteFromAll ? 'Remove from event' : 'Delete from all events'}
          </Button>
        </div>
      </div>
    </div>
  );
}
