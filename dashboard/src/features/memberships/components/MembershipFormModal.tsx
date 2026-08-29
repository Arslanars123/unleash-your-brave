import { useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import type { MembershipPayload, PublicMembership } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { TextArea } from '@/shared/ui/TextArea';

/** UI flag — recurring memberships still work in API/data when enabled here. */
const SHOW_RENEWABLE_MEMBERSHIP_UI = false;

export interface MembershipFormValues {
  name: string;
  price: string;
  description: string;
  features: string;
  paymentPlanNote: string;
  featured: boolean;
  tierRank: string;
  sortOrder: string;
  validForFutureEvents: boolean;
  validForFutureQr: boolean;
  billingKind: 'one_time' | 'renewable';
  durationDays: string;
  upgradeToMembershipId: string;
}

type FieldErrors = Partial<Record<keyof MembershipFormValues, string>>;

const emptyForm: MembershipFormValues = {
  name: '',
  price: '0',
  description: '',
  features: '',
  paymentPlanNote: '',
  featured: false,
  tierRank: '0',
  sortOrder: '0',
  validForFutureEvents: false,
  validForFutureQr: false,
  billingKind: 'one_time',
  durationDays: '365',
  upgradeToMembershipId: '',
};

function membershipToForm(membership: PublicMembership): MembershipFormValues {
  return {
    name: membership.name,
    price: String(membership.price),
    description: membership.description,
    features: (membership.features ?? []).join('\n'),
    paymentPlanNote: membership.paymentPlanNote ?? '',
    featured: Boolean(membership.featured),
    tierRank: String(membership.tierRank ?? 0),
    sortOrder: String(membership.sortOrder ?? 0),
    validForFutureEvents: Boolean(membership.validForFutureEvents),
    validForFutureQr: Boolean(membership.validForFutureQr),
    billingKind: membership.billingKind === 'renewable' ? 'renewable' : 'one_time',
    durationDays: String(
      membership.billingKind === 'renewable'
        ? Math.max(1, membership.durationDays ?? 365)
        : membership.durationDays ?? 0,
    ),
    upgradeToMembershipId: membership.upgradeToMembershipId ?? '',
  };
}

function validate(values: MembershipFormValues): FieldErrors {
  const errors: FieldErrors = {};

  if (!values.name.trim()) errors.name = 'Membership name is required';
  else if (values.name.trim().length < 2) errors.name = 'Name must be at least 2 characters';

  const price = Number(values.price);
  if (!Number.isFinite(price) || price < 0) errors.price = 'Price must be zero or greater';

  const tierRank = Number(values.tierRank);
  if (!Number.isFinite(tierRank) || tierRank < 0) errors.tierRank = 'Tier rank must be 0 or greater';

  const sortOrder = Number(values.sortOrder);
  if (!Number.isFinite(sortOrder) || sortOrder < 0) errors.sortOrder = 'Sort order must be 0 or greater';

  const durationDays = Number(values.durationDays);
  if (values.billingKind === 'renewable') {
    if (!Number.isFinite(durationDays) || durationDays < 1) {
      errors.durationDays = 'Renewable memberships need at least 1 day';
    }
  } else if (!Number.isFinite(durationDays) || durationDays < 0) {
    errors.durationDays = 'Duration must be 0 or greater';
  }

  return errors;
}

export function toMembershipPayload(values: MembershipFormValues): MembershipPayload {
  return {
    name: values.name.trim(),
    // Checkout is in-app; external value links are no longer used.
    valueLink: '',
    price: Number(values.price) || 0,
    description: values.description.trim(),
    features: values.features
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
    paymentPlanNote: values.paymentPlanNote.trim(),
    featured: values.featured,
    tierRank: Number(values.tierRank) || 0,
    sortOrder: Number(values.sortOrder) || 0,
    validForFutureEvents: values.validForFutureEvents,
    validForFutureQr: values.validForFutureQr,
    billingKind: values.billingKind,
    durationDays:
      values.billingKind === 'renewable'
        ? Math.max(1, Number(values.durationDays) || 365)
        : 0,
    upgradeToMembershipId: values.upgradeToMembershipId.trim()
      ? values.upgradeToMembershipId.trim()
      : null,
  };
}

interface MembershipFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialMembership?: PublicMembership | null;
  /** Other memberships on the same event (for upgrade target picker). */
  siblings?: PublicMembership[];
  loading?: boolean;
  onClose: () => void;
  onSubmit: (payload: MembershipPayload) => Promise<void> | void;
}

export function MembershipFormModal({
  open,
  mode,
  initialMembership,
  siblings = [],
  loading = false,
  onClose,
  onSubmit,
}: MembershipFormModalProps) {
  const [values, setValues] = useState<MembershipFormValues>(emptyForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    setErrors({});
    setValues(initialMembership ? membershipToForm(initialMembership) : emptyForm);
  }, [open, initialMembership]);

  if (!open) return null;

  function update<K extends keyof MembershipFormValues>(key: K, value: MembershipFormValues[K]) {
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (submitted) setErrors(validate(next));
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    await onSubmit(toMembershipPayload(values));
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="membership-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="membership-form-title">
            {mode === 'create' ? 'Create Membership' : 'Edit Membership'}
          </h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <form className="modal-body event-form" onSubmit={handleSubmit} noValidate>
          <Input
            label="Name"
            requiredMark
            name="name"
            value={values.name}
            error={errors.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Gold Pass"
          />
          <Input
            label="Price"
            name="price"
            type="number"
            min={0}
            step="0.01"
            value={values.price}
            error={errors.price}
            onChange={(e) => update('price', e.target.value)}
            placeholder="777"
          />
          <Input
            label="Payment plan note"
            name="paymentPlanNote"
            value={values.paymentPlanNote}
            error={errors.paymentPlanNote}
            onChange={(e) => update('paymentPlanNote', e.target.value)}
            placeholder="or 3 payments of $275"
          />
          <TextArea
            label="Features (one per line)"
            name="features"
            value={values.features}
            error={errors.features}
            onChange={(e) => update('features', e.target.value)}
            placeholder={'Full 3-Day Experience\nLunch each day'}
          />
          <TextArea
            label="Description"
            name="description"
            value={values.description}
            error={errors.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="What this membership tier includes..."
          />
          <Input
            label="Tier rank (upgrade hierarchy)"
            name="tierRank"
            type="number"
            min={0}
            step="1"
            value={values.tierRank}
            error={errors.tierRank}
            onChange={(e) => update('tierRank', e.target.value)}
            placeholder="1 = Gold, 2 = Diamond"
          />
          <Input
            label="Sort order"
            name="sortOrder"
            type="number"
            min={0}
            step="1"
            value={values.sortOrder}
            error={errors.sortOrder}
            onChange={(e) => update('sortOrder', e.target.value)}
            placeholder="0"
          />
          <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={values.featured}
              onChange={(e) => update('featured', e.target.checked)}
            />
            <span>Featured on website</span>
          </label>
          <label className="field">
            <span>Membership type</span>
            <select
              value={values.billingKind}
              onChange={(e) =>
                update('billingKind', e.target.value === 'renewable' ? 'renewable' : 'one_time')
              }
            >
              <option value="one_time">One-time (event pass)</option>
              {SHOW_RENEWABLE_MEMBERSHIP_UI || values.billingKind === 'renewable' ? (
                <option value="renewable">Recurring / renewable</option>
              ) : null}
            </select>
            {SHOW_RENEWABLE_MEMBERSHIP_UI || values.billingKind === 'renewable' ? (
              <p className="hint">
                Renewable memberships expire after the duration below. Attendees get a renewal
                reminder, and check-in QR stays active only while the period is paid.
              </p>
            ) : (
              <p className="hint">One-time pass for this event edition.</p>
            )}
          </label>
          {values.billingKind === 'renewable' ? (
            <Input
              label="Duration (days)"
              name="durationDays"
              type="number"
              min={1}
              value={values.durationDays}
              error={errors.durationDays}
              onChange={(e) => update('durationDays', e.target.value)}
              placeholder="365"
            />
          ) : null}
          <label className="field">
            <span>Upgrade next level (optional)</span>
            <select
              value={values.upgradeToMembershipId}
              onChange={(e) => update('upgradeToMembershipId', e.target.value)}
            >
              <option value="">Auto — next higher tier only</option>
              {siblings
                .filter((item) => item.id !== initialMembership?.id)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
            <p className="hint">
              App upgrade list shows only this next level (never lower tiers).
            </p>
          </label>

          <footer className="modal-footer">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {mode === 'create' ? 'Create membership' : 'Save changes'}
            </Button>
          </footer>
        </form>
      </div>
    </div>
  );
}
