import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pencil, X } from 'lucide-react';
import { MembershipRecordPanel } from '@/features/users/components/MembershipRecordPanel';
import { usersApi } from '@/features/users/api/users-api';
import { formatEditionRange, formatUsDateTime } from '@/shared/lib/datetime';
import type { AttendeeEventRecord, PublicUser } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Spinner } from '@/shared/ui/Spinner';

function display(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const text = String(value).trim();
  return text.length > 0 ? text : '—';
}

function formatDate(iso: string): string {
  return formatUsDateTime(iso);
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="attendee-detail-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function eventRangeLabel(record: AttendeeEventRecord): string {
  return formatEditionRange({
    startDate: record.eventStartDate,
    endDate: record.eventEndDate,
  });
}

interface AttendeeDetailModalProps {
  open: boolean;
  user: PublicUser | null;
  /** When set, that edition’s section is shown first. */
  preferredEventId?: string;
  preferredEventLabel?: string;
  onClose: () => void;
  onEdit: (user: PublicUser) => void;
}

export function AttendeeDetailModal({
  open,
  user,
  preferredEventId,
  preferredEventLabel,
  onClose,
  onEdit,
}: AttendeeDetailModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const eventRecordsQuery = useQuery({
    queryKey: ['users', 'event-records', user?.id],
    enabled: open && Boolean(user?.id),
    queryFn: () => usersApi.getEventRecords(user!.id),
  });

  if (!open || !user) return null;

  const fromGhl = Boolean(user.ghlContactId) || Boolean(user.title);
  const sourceLabel = user.ghlContactId
    ? 'GoHighLevel webhook'
    : fromGhl
      ? 'Likely purchase / GHL'
      : 'Manual / admin / Stripe';

  const records = [...(eventRecordsQuery.data ?? [])].sort((a, b) => {
    if (preferredEventId) {
      const aMatch = a.eventId === preferredEventId ? 0 : 1;
      const bMatch = b.eventId === preferredEventId ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
    }
    return new Date(b.eventStartDate).getTime() - new Date(a.eventStartDate).getTime();
  });

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel modal-panel-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="attendee-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div className="attendee-detail-heading">
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
              <h2 id="attendee-detail-title">{user.fullName || user.name}</h2>
              <p className="muted" style={{ margin: 0 }}>
                {user.email}
              </p>
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="modal-body">
          <section className="attendee-detail-section">
            <h3>
              Events & membership
              {preferredEventLabel ? (
                <span className="muted" style={{ fontWeight: 400, marginLeft: 8 }}>
                  · {preferredEventLabel} first
                </span>
              ) : null}
            </h3>
            {eventRecordsQuery.isLoading ? <Spinner /> : null}
            {eventRecordsQuery.isError ? (
              <p className="form-error">Could not load event records.</p>
            ) : null}
            {!eventRecordsQuery.isLoading && records.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                No paid event memberships recorded yet.
              </p>
            ) : null}
            {records.map((record) => (
              <div
                key={record.eventId}
                className="attendee-event-record"
                style={{
                  marginBottom: 24,
                  paddingBottom: 24,
                  borderBottom: '1px solid var(--border, #e8e4df)',
                }}
              >
                <div style={{ marginBottom: 12 }}>
                  <h4 style={{ margin: '0 0 4px' }}>{record.eventName}</h4>
                  <p className="muted" style={{ margin: 0, fontSize: '0.875rem' }}>
                    {eventRangeLabel(record)} · {record.eventStatus}
                    {preferredEventId === record.eventId ? ' · selected event' : ''}
                  </p>
                </div>
                <MembershipRecordPanel
                  summary={record.summary}
                  sourceLabel={sourceLabel}
                  productTitle={user.title}
                  preferredEventId={record.eventId}
                  eventOnly
                />
              </div>
            ))}
          </section>

          <section className="attendee-detail-section">
            <h3>Account</h3>
            <dl className="attendee-detail-grid">
              <DetailRow label="Status" value={user.status} />
              <DetailRow label="Role" value={user.role} />
              <DetailRow label="VIP" value={user.isVip ? 'Yes' : 'No'} />
              <DetailRow label="Points" value={String(user.points ?? 0)} />
              <DetailRow
                label="Profile completed"
                value={user.profileCompleted ? 'Yes' : 'No'}
              />
              <DetailRow
                label="Must change password"
                value={user.mustChangePassword ? 'Yes' : 'No'}
              />
              <DetailRow label="Created" value={formatDate(user.createdAt)} />
              <DetailRow label="Updated" value={formatDate(user.updatedAt)} />
            </dl>
          </section>

          <section className="attendee-detail-section">
            <h3>Profile</h3>
            <dl className="attendee-detail-grid">
              <DetailRow label="Full name" value={display(user.fullName || user.name)} />
              <DetailRow label="First name" value={display(user.firstName)} />
              <DetailRow label="Last name" value={display(user.lastName)} />
              <DetailRow label="Business" value={display(user.business)} />
              <DetailRow label="Industry" value={display(user.industry)} />
              <DetailRow label="Location" value={display(user.location)} />
              <DetailRow label="Networking prefs" value={display(user.networkingPrefs)} />
              <DetailRow
                label="Goals"
                value={user.goals?.length ? user.goals.join(', ') : '—'}
              />
              <DetailRow
                label="Interests"
                value={user.interests?.length ? user.interests.join(', ') : '—'}
              />
              <DetailRow label="Bio" value={display(user.bio)} />
              <DetailRow label="LinkedIn" value={display(user.linkedinUrl)} />
              <DetailRow label="Instagram" value={display(user.instagramUrl)} />
              <DetailRow label="Website" value={display(user.websiteUrl)} />
              <DetailRow label="Photo URL" value={display(user.photoUrl)} />
            </dl>
          </section>

          <div className="modal-actions">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button
              onClick={() => {
                onEdit(user);
              }}
            >
              <Pencil size={14} />
              Edit
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
