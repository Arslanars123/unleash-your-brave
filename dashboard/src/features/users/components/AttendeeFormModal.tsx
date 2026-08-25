import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import type {
  CreateUserPayload,
  NetworkingPref,
  PublicMembership,
  PublicUser,
  UpdateUserPayload,
} from '@/shared/types/api';
import { NETWORKING_PREFS } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { MediaImageField, type MediaImageFieldHandle } from '@/shared/ui/MediaImageField';
import { TextArea } from '@/shared/ui/TextArea';

export interface AttendeeFormValues {
  email: string;
  password: string;
  fullName: string;
  photoUrl: string;
  title: string;
  business: string;
  industry: string;
  location: string;
  bio: string;
  goals: string[];
  interests: string[];
  networkingPrefs: NetworkingPref;
  linkedinUrl: string;
  instagramUrl: string;
  websiteUrl: string;
  isVip: boolean;
  points: string;
  profileCompleted: boolean;
  status: 'active' | 'suspended';
  membershipId: string;
}

type FieldErrors = Partial<Record<keyof AttendeeFormValues | 'userId', string>>;

const emptyForm: AttendeeFormValues = {
  email: '',
  password: '',
  fullName: '',
  photoUrl: '',
  title: '',
  business: '',
  industry: '',
  location: '',
  bio: '',
  goals: [],
  interests: [],
  networkingPrefs: 'open_to_all',
  linkedinUrl: '',
  instagramUrl: '',
  websiteUrl: '',
  isVip: false,
  points: '0',
  profileCompleted: false,
  status: 'active',
  membershipId: '',
};

function userToForm(user: PublicUser): AttendeeFormValues {
  return {
    email: user.email,
    password: '',
    fullName: user.fullName || user.name,
    photoUrl: user.photoUrl ?? '',
    title: user.title ?? '',
    business: user.business ?? '',
    industry: user.industry ?? '',
    location: user.location ?? '',
    bio: user.bio ?? '',
    goals: [...(user.goals ?? [])],
    interests: [...(user.interests ?? [])],
    networkingPrefs: user.networkingPrefs ?? 'open_to_all',
    linkedinUrl: user.linkedinUrl ?? '',
    instagramUrl: user.instagramUrl ?? '',
    websiteUrl: user.websiteUrl ?? '',
    isVip: Boolean(user.isVip),
    points: String(user.points ?? 0),
    profileCompleted: Boolean(user.profileCompleted),
    status: user.status,
    membershipId: user.membershipId ?? '',
  };
}

function isOptionalUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (trimmed.startsWith('/uploads/')) return true;
  return false;
}

function validate(values: AttendeeFormValues, mode: 'create' | 'edit'): FieldErrors {
  const errors: FieldErrors = {};

  if (!values.fullName.trim()) errors.fullName = 'Full name is required';
  else if (values.fullName.trim().length < 2) errors.fullName = 'Full name must be at least 2 characters';

  if (!values.email.trim()) errors.email = 'Email is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = 'Enter a valid email';
  }

  if (mode === 'create') {
    if (!values.password) errors.password = 'Password is required';
    else if (values.password.length < 8) errors.password = 'Password must be at least 8 characters';
  } else if (values.password && values.password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
  }

  if (!isOptionalUrl(values.photoUrl)) errors.photoUrl = 'Enter a valid URL';
  if (!isOptionalUrl(values.linkedinUrl)) errors.linkedinUrl = 'Enter a valid URL';
  if (!isOptionalUrl(values.instagramUrl)) errors.instagramUrl = 'Enter a valid URL';
  if (!isOptionalUrl(values.websiteUrl)) errors.websiteUrl = 'Enter a valid URL';

  const points = Number(values.points);
  if (!Number.isInteger(points) || points < 0) errors.points = 'Points must be a non-negative integer';

  return errors;
}

export function toCreatePayload(values: AttendeeFormValues): CreateUserPayload {
  return {
    email: values.email.trim().toLowerCase(),
    name: values.fullName.trim(),
    password: values.password,
    role: 'member',
    status: values.status,
    photoUrl: values.photoUrl.trim(),
    title: values.title.trim(),
    business: values.business.trim(),
    industry: values.industry.trim(),
    location: values.location.trim(),
    bio: values.bio.trim(),
    goals: values.goals,
    interests: values.interests,
    networkingPrefs: values.networkingPrefs,
    linkedinUrl: values.linkedinUrl.trim(),
    instagramUrl: values.instagramUrl.trim(),
    websiteUrl: values.websiteUrl.trim(),
    isVip: values.isVip,
    points: Number(values.points) || 0,
    profileCompleted: values.profileCompleted,
    membershipId: values.membershipId || null,
  };
}

export function toUpdatePayload(values: AttendeeFormValues): UpdateUserPayload {
  return {
    email: values.email.trim().toLowerCase(),
    name: values.fullName.trim(),
    ...(values.password ? { password: values.password } : {}),
    status: values.status,
    photoUrl: values.photoUrl.trim(),
    title: values.title.trim(),
    business: values.business.trim(),
    industry: values.industry.trim(),
    location: values.location.trim(),
    bio: values.bio.trim(),
    goals: values.goals,
    interests: values.interests,
    networkingPrefs: values.networkingPrefs,
    linkedinUrl: values.linkedinUrl.trim(),
    instagramUrl: values.instagramUrl.trim(),
    websiteUrl: values.websiteUrl.trim(),
    isVip: values.isVip,
    points: Number(values.points) || 0,
    profileCompleted: values.profileCompleted,
    membershipId: values.membershipId || null,
  };
}

function ValuesListField({
  label,
  values,
  error,
  onChange,
}: {
  label: string;
  values: string[];
  error?: string;
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState('');

  function commitDraft() {
    const next = draft
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    if (next.length === 0) return;
    const merged = [...values];
    for (const item of next) {
      if (!merged.includes(item)) merged.push(item);
    }
    onChange(merged);
    setDraft('');
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commitDraft();
    } else if (event.key === 'Backspace' && !draft && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className={`values-list${error ? ' field-input-error' : ''}`}>
        {values.map((value) => (
          <span key={value} className="values-chip">
            {value}
            <button
              type="button"
              aria-label={`Remove ${value}`}
              onClick={() => onChange(values.filter((item) => item !== value))}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          className="values-list-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commitDraft}
          placeholder="enter values..."
        />
      </div>
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  );
}

interface AttendeeFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialUser?: PublicUser | null;
  memberships?: PublicMembership[];
  loading?: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateUserPayload | UpdateUserPayload) => Promise<void> | void;
}

export function AttendeeFormModal({
  open,
  mode,
  initialUser,
  memberships = [],
  loading = false,
  onClose,
  onSubmit,
}: AttendeeFormModalProps) {
  const [values, setValues] = useState<AttendeeFormValues>(emptyForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [committingPhoto, setCommittingPhoto] = useState(false);
  const photoRef = useRef<MediaImageFieldHandle>(null);

  useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    setErrors({});
    setValues(initialUser ? userToForm(initialUser) : emptyForm);
  }, [open, initialUser]);

  if (!open) return null;

  function update<K extends keyof AttendeeFormValues>(key: K, value: AttendeeFormValues[K]) {
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (submitted) setErrors(validate(next, mode));
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);

    let photoUrl = values.photoUrl;
    if (photoRef.current?.hasPendingFile()) {
      setCommittingPhoto(true);
      try {
        photoUrl = await photoRef.current.commit();
      } catch {
        setCommittingPhoto(false);
        return;
      }
      setCommittingPhoto(false);
    }

    const nextValues = { ...values, photoUrl };
    setValues(nextValues);
    const nextErrors = validate(nextValues, mode);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    await onSubmit(mode === 'create' ? toCreatePayload(nextValues) : toUpdatePayload(nextValues));
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel modal-panel-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="attendee-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="attendee-form-title">
            {mode === 'create' ? 'Create Attendee' : 'Edit MemberProfile'}
          </h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <form className="modal-body event-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
          {mode === 'edit' && initialUser ? (
            <Input label="user_id" name="user_id" value={initialUser.id} readOnly />
          ) : null}

          <Input
            label="full_name"
            requiredMark
            name="full_name"
            value={values.fullName}
            error={errors.fullName}
            onChange={(e) => update('fullName', e.target.value)}
          />

          <Input
            label="email"
            requiredMark
            name="email"
            type="email"
            value={values.email}
            error={errors.email}
            onChange={(e) => update('email', e.target.value)}
          />

          <Input
            label={mode === 'create' ? 'password' : 'password (leave blank to keep)'}
            requiredMark={mode === 'create'}
            name="password"
            type="password"
            autoComplete="new-password"
            value={values.password}
            error={errors.password}
            onChange={(e) => update('password', e.target.value)}
          />

          <MediaImageField
            ref={photoRef}
            label="Photo"
            value={values.photoUrl}
            error={errors.photoUrl}
            disabled={loading || committingPhoto}
            onChange={(url) => update('photoUrl', url)}
          />

          <Input
            label="title"
            name="title"
            value={values.title}
            onChange={(e) => update('title', e.target.value)}
          />

          <label className="field">
            <span className="field-label">Membership</span>
            <select
              className="field-input"
              value={values.membershipId}
              onChange={(e) => update('membershipId', e.target.value)}
            >
              <option value="">No membership assigned</option>
              {memberships.map((membership) => (
                <option key={membership.id} value={membership.id}>
                  {membership.name}
                </option>
              ))}
            </select>
          </label>

          <Input
            label="business"
            name="business"
            value={values.business}
            onChange={(e) => update('business', e.target.value)}
          />

          <Input
            label="industry"
            name="industry"
            value={values.industry}
            onChange={(e) => update('industry', e.target.value)}
          />

          <Input
            label="location"
            name="location"
            value={values.location}
            onChange={(e) => update('location', e.target.value)}
          />

          <TextArea
            label="bio"
            name="bio"
            value={values.bio}
            onChange={(e) => update('bio', e.target.value)}
          />

          <ValuesListField
            label="goals"
            values={values.goals}
            error={errors.goals}
            onChange={(goals) => update('goals', goals)}
          />

          <ValuesListField
            label="interests"
            values={values.interests}
            error={errors.interests}
            onChange={(interests) => update('interests', interests)}
          />

          <label className="field">
            <span className="field-label">networking_prefs</span>
            <select
              className="field-input"
              value={values.networkingPrefs}
              onChange={(e) => update('networkingPrefs', e.target.value as NetworkingPref)}
            >
              {NETWORKING_PREFS.map((pref) => (
                <option key={pref} value={pref}>
                  {pref}
                </option>
              ))}
            </select>
          </label>

          <Input
            label="linkedin_url"
            name="linkedin_url"
            value={values.linkedinUrl}
            error={errors.linkedinUrl}
            onChange={(e) => update('linkedinUrl', e.target.value)}
            placeholder="https://..."
          />

          <Input
            label="instagram_url"
            name="instagram_url"
            value={values.instagramUrl}
            error={errors.instagramUrl}
            onChange={(e) => update('instagramUrl', e.target.value)}
            placeholder="https://..."
          />

          <Input
            label="website_url"
            name="website_url"
            value={values.websiteUrl}
            error={errors.websiteUrl}
            onChange={(e) => update('websiteUrl', e.target.value)}
            placeholder="https://..."
          />

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={values.isVip}
              onChange={(e) => update('isVip', e.target.checked)}
            />
            <span>is_vip</span>
          </label>

          <Input
            label="points"
            name="points"
            type="number"
            min={0}
            value={values.points}
            error={errors.points}
            onChange={(e) => update('points', e.target.value)}
          />

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={values.profileCompleted}
              onChange={(e) => update('profileCompleted', e.target.checked)}
            />
            <span>profile_completed</span>
          </label>

          <label className="field">
            <span className="field-label">status</span>
            <select
              className="field-input"
              value={values.status}
              onChange={(e) => update('status', e.target.value as AttendeeFormValues['status'])}
            >
              <option value="active">active</option>
              <option value="suspended">suspended</option>
            </select>
          </label>

          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading || committingPhoto}>
              Cancel
            </Button>
            <Button type="submit" loading={loading || committingPhoto}>
              {mode === 'create' ? 'Create attendee' : 'Save changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
