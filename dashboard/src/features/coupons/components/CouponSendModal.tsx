import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { usersApi } from '@/features/users/api/users-api';
import type { PublicCoupon, PublicEvent } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { TextArea } from '@/shared/ui/TextArea';
import { useToast } from '@/shared/ui/toast';

export interface CouponSendPayload {
  message: string;
  audienceType: 'all' | 'users';
  audienceUserIds: string[];
  sendPush: boolean;
}

type PurchaseFilter = 'without_purchase' | 'purchasers' | 'all';

interface CouponSendModalProps {
  open: boolean;
  coupon: PublicCoupon | null;
  event?: PublicEvent | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (payload: CouponSendPayload) => Promise<void> | void;
}

function remainingRedemptions(coupon: PublicCoupon): number | null {
  if (coupon.maxRedemptions <= 0) return null;
  return Math.max(0, coupon.maxRedemptions - coupon.redemptionCount);
}

function formatEventDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function eventSummary(event: PublicEvent | null | undefined): string {
  if (!event) return 'Event not found';
  const start = formatEventDate(event.startDate);
  const end = formatEventDate(event.endDate);
  const range = start && end ? `${start} – ${end}` : start || end;
  return range ? `${event.name} · ${range}` : event.name;
}

export function CouponSendModal({
  open,
  coupon,
  event = null,
  loading = false,
  onClose,
  onSubmit,
}: CouponSendModalProps) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [audienceType, setAudienceType] = useState<'all' | 'users'>('users');
  const [purchaseFilter, setPurchaseFilter] = useState<PurchaseFilter>('without_purchase');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const remaining = coupon ? remainingRedemptions(coupon) : null;
  const unlimited = remaining === null;
  const canSendAll = unlimited;

  const usersQuery = useQuery({
    queryKey: [
      'users',
      'coupon-send-audience',
      coupon?.eventId,
      purchaseFilter,
      userSearch,
    ],
    queryFn: () =>
      usersApi.list({
        search: userSearch || undefined,
        role: 'member',
        status: 'active',
        attendeesOnly: true,
        eventId: coupon?.eventId || undefined,
        eventPurchaseFilter: coupon?.eventId ? purchaseFilter : 'all',
        perPage: 50,
      }),
    enabled: open && Boolean(coupon) && audienceType === 'users',
  });

  useEffect(() => {
    if (!open || !coupon) return;
    setNote(coupon.description?.trim() || '');
    setSelectedIds([]);
    setUserSearch('');
    setError(null);
    setPurchaseFilter('without_purchase');
    setAudienceType(remainingRedemptions(coupon) === null ? 'all' : 'users');
  }, [open, coupon]);

  const selectedLabel = useMemo(() => {
    const selected = new Set(selectedIds);
    return (usersQuery.data?.items ?? []).filter((u) => selected.has(u.id));
  }, [usersQuery.data?.items, selectedIds]);

  if (!open || !coupon) return null;

  function toggleUser(userId: string) {
    setSelectedIds((current) => {
      const has = current.includes(userId);
      if (has) {
        setError(null);
        return current.filter((id) => id !== userId);
      }
      if (remaining !== null && current.length >= remaining) {
        toast.error(
          remaining === 1
            ? 'This coupon is for one-time use — you can notify only 1 attendee.'
            : `This coupon has ${remaining} use${remaining === 1 ? '' : 's'} left — you can notify at most ${remaining} attendees.`,
        );
        return current;
      }
      setError(null);
      return [...current, userId];
    });
  }

  async function handleSubmit(eventForm: FormEvent) {
    eventForm.preventDefault();
    if (!coupon) return;

    if (remaining === 0) {
      toast.error('This coupon has no redemptions left');
      return;
    }

    if (audienceType === 'all' && !canSendAll) {
      toast.error(
        remaining === 1
          ? 'This coupon is for one-time use — select 1 attendee instead of all.'
          : `This coupon has a limited number of uses — select up to ${remaining} attendees.`,
      );
      return;
    }

    if (audienceType === 'users') {
      if (selectedIds.length === 0) {
        setError('Select at least one attendee');
        return;
      }
      if (remaining !== null && selectedIds.length > remaining) {
        toast.error(
          remaining === 1
            ? 'This coupon is for one-time use — 2 attendees cannot use it.'
            : `Select at most ${remaining} attendees for this coupon.`,
        );
        return;
      }
    }

    await onSubmit({
      message: note.trim(),
      audienceType,
      audienceUserIds: audienceType === 'users' ? selectedIds : [],
      sendPush: true,
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel modal-panel-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="coupon-send-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="coupon-send-title">Send coupon {coupon.code}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <form className="modal-body event-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
          <p style={{ marginTop: 0, marginBottom: 4, fontWeight: 600 }}>{eventSummary(event)}</p>
          <p className="hint" style={{ marginTop: 0 }}>
            {unlimited
              ? 'Unlimited uses — you can notify all attendees or pick specific people.'
              : remaining === 0
                ? 'No redemptions left on this coupon.'
                : remaining === 1
                  ? 'One-time use — notify only 1 attendee.'
                  : `${remaining} uses left — notify at most ${remaining} attendees.`}
          </p>

          <TextArea
            label="Note"
            name="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional message included with the coupon notification"
          />

          <fieldset className="form-fieldset">
            <legend>Recipients</legend>
            <div className="radio-row">
              {canSendAll ? (
                <label className="checkbox-row">
                  <input
                    type="radio"
                    name="couponAudience"
                    checked={audienceType === 'all'}
                    onChange={() => {
                      setAudienceType('all');
                      setError(null);
                    }}
                  />
                  All attendees
                </label>
              ) : null}
              <label className="checkbox-row">
                <input
                  type="radio"
                  name="couponAudience"
                  checked={audienceType === 'users'}
                  onChange={() => {
                    setAudienceType('users');
                    setError(null);
                  }}
                />
                Specific people
              </label>
            </div>

            {audienceType === 'users' ? (
              <div className="audience-picker">
                <div className="radio-row" style={{ marginBottom: 8 }}>
                  {(
                    [
                      ['without_purchase', 'No membership yet'],
                      ['purchasers', 'Already purchased'],
                      ['all', 'All members'],
                    ] as const
                  ).map(([value, label]) => (
                    <label key={value} className="checkbox-row">
                      <input
                        type="radio"
                        name="purchaseFilter"
                        checked={purchaseFilter === value}
                        onChange={() => {
                          setPurchaseFilter(value);
                          setSelectedIds([]);
                          setError(null);
                        }}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <Input
                  label="Search attendees"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Name or email"
                />
                {selectedIds.length > 0 ? (
                  <p className="hint">
                    Selected: {selectedIds.length}
                    {remaining !== null ? ` / ${remaining} max` : ''}
                    {selectedLabel.length > 0
                      ? ` (${selectedLabel.map((u) => u.name).join(', ')})`
                      : ''}
                  </p>
                ) : null}
                <div className="audience-list">
                  {(usersQuery.data?.items ?? []).map((user) => (
                    <label key={user.id} className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(user.id)}
                        onChange={() => toggleUser(user.id)}
                      />
                      <span>
                        {user.name}
                        <span className="muted"> · {user.email}</span>
                      </span>
                    </label>
                  ))}
                  {usersQuery.isLoading ? <p className="muted">Loading attendees…</p> : null}
                  {!usersQuery.isLoading && (usersQuery.data?.items.length ?? 0) === 0 ? (
                    <p className="muted">
                      {purchaseFilter === 'without_purchase'
                        ? 'No members without a membership purchase for this event.'
                        : purchaseFilter === 'purchasers'
                          ? 'No membership purchasers found for this event.'
                          : 'No attendees found.'}
                    </p>
                  ) : null}
                </div>
                {error ? <p className="field-error">{error}</p> : null}
              </div>
            ) : null}
          </fieldset>

          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" loading={loading} disabled={remaining === 0}>
              Send notification
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
