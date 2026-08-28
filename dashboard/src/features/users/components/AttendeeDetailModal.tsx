import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pencil, X } from 'lucide-react';
import { MembershipRecordPanel } from '@/features/users/components/MembershipRecordPanel';
import { usersApi } from '@/features/users/api/users-api';
import { formatUsDateTime } from '@/shared/lib/datetime';
import type { PublicUser } from '@/shared/types/api';
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

interface AttendeeDetailModalProps {
  open: boolean;
  user: PublicUser | null;
  /** When set, membership summary / history prioritizes this edition. */
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

  const purchasesQuery = useQuery({
    queryKey: ['users', 'purchases', user?.id, preferredEventId ?? 'all'],
    enabled: open && Boolean(user?.id),
    queryFn: () =>
      usersApi.getPurchases(user!.id, preferredEventId ? { eventId: preferredEventId } : {}),
  });

  if (!open || !user) return null;

  const fromGhl = Boolean(user.ghlContactId) || Boolean(user.title);
  const summary = purchasesQuery.data;
  const sourceLabel = user.ghlContactId
    ? 'GoHighLevel webhook'
    : fromGhl
      ? 'Likely purchase / GHL'
      : 'Manual / admin / Stripe';

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
              Membership
              {preferredEventLabel ? (
                <span className="muted" style={{ fontWeight: 400, marginLeft: 8 }}>
                  · {preferredEventLabel} first
                </span>
              ) : null}
            </h3>
            {purchasesQuery.isLoading ? <Spinner /> : null}
            {purchasesQuery.isError ? (
              <p className="form-error">Could not load purchase history.</p>
            ) : null}
            {summary ? (
              <MembershipRecordPanel
                summary={summary}
                sourceLabel={sourceLabel}
                productTitle={user.title}
                preferredEventId={preferredEventId}
              />
            ) : null}
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
