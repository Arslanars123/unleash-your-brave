import { useEffect } from 'react';
import { QrCode, UserCheck, X } from 'lucide-react';
import { CheckInFormSubmissionPanel } from '@/features/checkins/components/CheckInFormSubmissionPanel';
import { MembershipRecordPanel } from '@/features/users/components/MembershipRecordPanel';
import { formatUsDateTime } from '@/shared/lib/datetime';
import type { CheckInScanResult } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';

interface CheckInScanDetailsModalProps {
  open: boolean;
  result: CheckInScanResult | null;
  preferredEventId?: string;
  onClose: () => void;
  /** When set, primary action resumes scanning (already checked in / re-scan flow). */
  onScanNew?: () => void;
}

export function CheckInScanDetailsModal({
  open,
  result,
  preferredEventId,
  onClose,
  onScanNew,
}: CheckInScanDetailsModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !result?.checkIn || !result.membership) return null;

  const membership = result.membership;
  const title = result.alreadyCheckedIn ? 'Already checked in' : 'Check-in complete';

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel modal-panel-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkin-scan-details-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <h2 id="checkin-scan-details-title">{title}</h2>
            <p className="muted" style={{ margin: 0 }}>
              {result.user.name} · {result.user.email}
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="modal-body">
          <section className="attendee-detail-section">
            <h3 style={{ marginTop: 0 }}>Check-in summary</h3>
            <dl className="attendee-detail-grid" style={{ marginBottom: 0 }}>
              <div className="attendee-detail-row">
                <dt>Checked in</dt>
                <dd>
                  {result.checkIn.checkedInAt
                    ? formatUsDateTime(result.checkIn.checkedInAt)
                    : '—'}
                  {result.alreadyCheckedIn ? ' (already checked in)' : ''}
                </dd>
              </div>
              <div className="attendee-detail-row">
                <dt>Membership at check-in</dt>
                <dd>{membership.membershipNameAtCheckIn ?? '—'}</dd>
              </div>
              {membership.qrStatusLabel ? (
                <div className="attendee-detail-row">
                  <dt>QR eligibility</dt>
                  <dd>
                    {membership.qrStatusLabel}
                    {membership.qrDeniedReason === 'renewal_payment_required' ? (
                      <span className="hint" style={{ display: 'block', marginTop: 4 }}>
                        Recurring payment still pending — QR not valid for this / next event under
                        the current access rule.
                      </span>
                    ) : null}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          <MembershipRecordPanel
            summary={membership}
            sourceLabel={
              result.user.ghlContactId ? 'GoHighLevel webhook' : 'Manual / admin / Stripe'
            }
            productTitle={result.user.title}
            preferredEventId={preferredEventId ?? result.eventId}
            eventOnly
          />

          {result.formSubmission ? (
            <CheckInFormSubmissionPanel
              form={result.form}
              submission={result.formSubmission}
            />
          ) : null}
        </div>

        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
          {onScanNew ? (
            <Button type="button" onClick={onScanNew} autoFocus>
              <QrCode size={16} />
              Scan new
            </Button>
          ) : (
            <Button type="button" onClick={onClose} autoFocus>
              <UserCheck size={16} />
              Done
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
