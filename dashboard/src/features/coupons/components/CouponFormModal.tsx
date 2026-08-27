import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type {
  CouponPayload,
  PublicCoupon,
  PublicEvent,
  PublicMembership,
} from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { TextArea } from '@/shared/ui/TextArea';

interface DiscountRow {
  membershipId: string;
  percentOff: string;
}

export interface CouponFormValues {
  eventId: string;
  code: string;
  name: string;
  description: string;
  active: boolean;
  expiresAt: string;
  maxRedemptions: string;
  discounts: DiscountRow[];
}

type FieldErrors = Partial<Record<keyof CouponFormValues | 'discounts', string>>;

const emptyForm: CouponFormValues = {
  eventId: '',
  code: '',
  name: '',
  description: '',
  active: true,
  expiresAt: '',
  maxRedemptions: '0',
  discounts: [{ membershipId: '', percentOff: '20' }],
};

function couponToForm(coupon: PublicCoupon): CouponFormValues {
  return {
    eventId: coupon.eventId ?? '',
    code: coupon.code,
    name: coupon.name,
    description: coupon.description ?? '',
    active: Boolean(coupon.active),
    expiresAt: coupon.expiresAt ? coupon.expiresAt.slice(0, 16) : '',
    maxRedemptions: String(coupon.maxRedemptions ?? 0),
    discounts:
      coupon.membershipDiscounts.length > 0
        ? coupon.membershipDiscounts.map((item) => ({
            membershipId: item.membershipId,
            percentOff: String(item.percentOff),
          }))
        : [{ membershipId: '', percentOff: '20' }],
  };
}

function validate(values: CouponFormValues): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.eventId.trim()) errors.eventId = 'Event is required';
  if (!values.name.trim()) errors.name = 'Name is required';
  if (values.code.trim() && !/^[A-Za-z0-9_-]+$/.test(values.code.trim())) {
    errors.code = 'Use letters, numbers, - or _ only';
  }
  const max = Number(values.maxRedemptions);
  if (!Number.isFinite(max) || max < 0) errors.maxRedemptions = 'Must be 0 or greater';

  const seen = new Set<string>();
  for (const row of values.discounts) {
    if (!row.membershipId) {
      errors.discounts = 'Select a membership for each discount row';
      break;
    }
    if (seen.has(row.membershipId)) {
      errors.discounts = 'Each membership can only appear once';
      break;
    }
    seen.add(row.membershipId);
    const pct = Number(row.percentOff);
    if (!Number.isFinite(pct) || pct < 1 || pct > 100) {
      errors.discounts = 'Percent must be between 1 and 100';
      break;
    }
  }
  if (values.discounts.length === 0) {
    errors.discounts = 'Add at least one membership discount';
  }
  return errors;
}

export function toCouponPayload(values: CouponFormValues): CouponPayload {
  return {
    eventId: values.eventId,
    ...(values.code.trim() ? { code: values.code.trim().toUpperCase() } : {}),
    name: values.name.trim(),
    description: values.description.trim(),
    active: values.active,
    expiresAt: values.expiresAt
      ? new Date(values.expiresAt).toISOString()
      : null,
    maxRedemptions: Number(values.maxRedemptions) || 0,
    membershipDiscounts: values.discounts.map((row) => ({
      membershipId: row.membershipId,
      percentOff: Number(row.percentOff),
    })),
  };
}

interface CouponFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialCoupon?: PublicCoupon | null;
  events: PublicEvent[];
  memberships: PublicMembership[];
  loading?: boolean;
  onEventChange?: (eventId: string) => void;
  onClose: () => void;
  onSubmit: (payload: CouponPayload) => Promise<void> | void;
}

export function CouponFormModal({
  open,
  mode,
  initialCoupon,
  events,
  memberships,
  loading = false,
  onEventChange,
  onClose,
  onSubmit,
}: CouponFormModalProps) {
  const [values, setValues] = useState<CouponFormValues>(emptyForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const membershipOptions = useMemo(
    () =>
      [...memberships].sort(
        (a, b) =>
          (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
          a.price - b.price ||
          a.name.localeCompare(b.name),
      ),
    [memberships],
  );

  useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    setErrors({});
    if (initialCoupon) {
      setValues(couponToForm(initialCoupon));
      return;
    }
    const defaultEventId = events[0]?.id ?? '';
    setValues({ ...emptyForm, eventId: defaultEventId });
    if (defaultEventId) onEventChange?.(defaultEventId);
  }, [open, initialCoupon]);

  if (!open) return null;

  function update<K extends keyof CouponFormValues>(key: K, value: CouponFormValues[K]) {
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (submitted) setErrors(validate(next));
      return next;
    });
  }

  function handleEventChange(eventId: string) {
    setValues((current) => {
      const next: CouponFormValues = {
        ...current,
        eventId,
        discounts: [{ membershipId: '', percentOff: '20' }],
      };
      if (submitted) setErrors(validate(next));
      return next;
    });
    onEventChange?.(eventId);
  }

  function updateDiscount(index: number, patch: Partial<DiscountRow>) {
    setValues((current) => {
      const discounts = current.discounts.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      );
      const next = { ...current, discounts };
      if (submitted) setErrors(validate(next));
      return next;
    });
  }

  function addDiscountRow() {
    setValues((current) => ({
      ...current,
      discounts: [...current.discounts, { membershipId: '', percentOff: '20' }],
    }));
  }

  function removeDiscountRow(index: number) {
    setValues((current) => ({
      ...current,
      discounts: current.discounts.filter((_, i) => i !== index),
    }));
  }

  function fillAllMemberships() {
    setValues((current) => ({
      ...current,
      discounts: membershipOptions.map((item) => ({
        membershipId: item.id,
        percentOff:
          current.discounts.find((row) => row.membershipId === item.id)?.percentOff ?? '20',
      })),
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    await onSubmit(toCouponPayload(values));
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="coupon-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="coupon-form-title">
            {mode === 'create' ? 'Create coupon' : 'Edit coupon'}
          </h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <form className="modal-body event-form" onSubmit={handleSubmit} noValidate>
          <label className="field">
            <span>
              Event <span className="required-mark">*</span>
            </span>
            <select
              value={values.eventId}
              onChange={(e) => handleEventChange(e.target.value)}
              required
            >
              <option value="">Select event</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                  {event.status === 'live' ? ' (live)' : event.status === 'upcoming' ? ' (upcoming)' : ''}
                </option>
              ))}
            </select>
            {errors.eventId ? <p className="form-error">{errors.eventId}</p> : null}
            {events.length === 0 ? (
              <p className="hint">No current or upcoming events available for coupons.</p>
            ) : null}
          </label>
          <Input
            label="Name"
            requiredMark
            name="name"
            value={values.name}
            error={errors.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Spring launch discount"
          />
          <Input
            label="Code (leave blank to auto-generate)"
            name="code"
            value={values.code}
            error={errors.code}
            onChange={(e) => update('code', e.target.value.toUpperCase())}
            placeholder="BRAVE20"
          />
          <TextArea
            label="Description"
            name="description"
            value={values.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Shown when you send the coupon in a notification"
          />
          <Input
            label="Expires at (optional)"
            name="expiresAt"
            type="datetime-local"
            value={values.expiresAt}
            onChange={(e) => update('expiresAt', e.target.value)}
          />
          <Input
            label="Max redemptions (0 = unlimited)"
            name="maxRedemptions"
            type="number"
            min={0}
            value={values.maxRedemptions}
            error={errors.maxRedemptions}
            onChange={(e) => update('maxRedemptions', e.target.value)}
          />
          <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={values.active}
              onChange={(e) => update('active', e.target.checked)}
            />
            <span>Active</span>
          </label>

          <div className="field">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span>Membership discounts</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={fillAllMemberships}
                  disabled={!values.eventId || membershipOptions.length === 0}
                >
                  Add all memberships
                </Button>
                <Button type="button" variant="secondary" onClick={addDiscountRow}>
                  <Plus size={16} /> Add
                </Button>
              </div>
            </div>
            <p className="hint">
              Choose which memberships this code works for, and set a different % for each
              (e.g. 20% on Standard, 50% on VIP).
            </p>
            {errors.discounts ? <p className="form-error">{errors.discounts}</p> : null}
            <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
              {values.discounts.map((row, index) => (
                <div
                  key={`discount-${index}`}
                  style={{ display: 'grid', gridTemplateColumns: '1fr 110px 40px', gap: 8 }}
                >
                  <select
                    value={row.membershipId}
                    onChange={(e) => updateDiscount(index, { membershipId: e.target.value })}
                    disabled={!values.eventId}
                  >
                    <option value="">Select membership</option>
                    {membershipOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} (${item.price})
                      </option>
                    ))}
                  </select>
                  <Input
                    label=""
                    name={`percent-${index}`}
                    type="number"
                    min={1}
                    max={100}
                    value={row.percentOff}
                    onChange={(e) => updateDiscount(index, { percentOff: e.target.value })}
                    placeholder="%"
                  />
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => removeDiscountRow(index)}
                    aria-label="Remove discount"
                    disabled={values.discounts.length <= 1}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <footer className="modal-footer">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || events.length === 0}>
              {mode === 'create' ? 'Create coupon' : 'Save changes'}
            </Button>
          </footer>
        </form>
      </div>
    </div>
  );
}
