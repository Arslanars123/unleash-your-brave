import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import type {
  AttendeeEventRecord,
  CreateUserPayload,
  NetworkingPref,
  PublicEvent,
  PublicMembership,
  PublicUser,
  UpdateUserPayload,
} from '@/shared/types/api';
import { NETWORKING_PREFS } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { MediaImageField, type MediaImageFieldHandle } from '@/shared/ui/MediaImageField';
import { TextArea } from '@/shared/ui/TextArea';
import { formatEditionRange } from '@/features/events/hooks/useEditionScope';
import { membershipsApi } from '@/features/memberships/api/memberships-api';
import { usersApi } from '@/features/users/api/users-api';
import { ATTENDEE_UI } from '@/features/users/attendee-ui-flags';

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
  eventId: string;
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
  eventId: '',
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
    eventId: '',
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
    if (!values.eventId) errors.eventId = 'Event is required';
    if (!values.membershipId) errors.membershipId = 'Membership is required';
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
    role: 'member',
    status: values.status,
    eventId: values.eventId,
    membershipId: values.membershipId,
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
  };
}

export function toUpdatePayload(values: AttendeeFormValues): UpdateUserPayload {
  return {
    email: values.email.trim().toLowerCase(),
    name: values.fullName.trim(),
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
  events?: PublicEvent[];
  defaultEventId?: string;
  /** Edition filter active when opening edit — shown first in membership list. */
  contextEventId?: string;
  contextEvent?: PublicEvent | null;
  memberships?: PublicMembership[];
  membershipsLoading?: boolean;
  loading?: boolean;
  onEventChange?: (eventId: string) => void;
  onClose: () => void;
  onSubmit: (payload: CreateUserPayload | UpdateUserPayload) => Promise<void> | void;
}

function eventRecordLabel(record: AttendeeEventRecord): string {
  return `${record.eventName} (${formatEditionRange({
    startDate: record.eventStartDate,
    endDate: record.eventEndDate,
  })})`;
}

function eventLabel(event: PublicEvent): string {
  return `${event.name} (${formatEditionRange(event)}${
    event.status === 'live'
      ? ', live'
      : event.status === 'upcoming'
        ? ', upcoming'
        : event.status === 'ended'
          ? ', past'
          : ''
  })`;
}

export function AttendeeFormModal({
  open,
  mode,
  initialUser,
  events = [],
  defaultEventId,
  contextEventId,
  contextEvent,
  memberships = [],
  membershipsLoading = false,
  loading = false,
  onEventChange,
  onClose,
  onSubmit,
}: AttendeeFormModalProps) {
  const [values, setValues] = useState<AttendeeFormValues>(emptyForm);
  const [eventMemberships, setEventMemberships] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [committingPhoto, setCommittingPhoto] = useState(false);
  const photoRef = useRef<MediaImageFieldHandle>(null);

  const eventRecordsQuery = useQuery({
    queryKey: ['users', 'event-records', initialUser?.id],
    enabled: open && mode === 'edit' && Boolean(initialUser?.id),
    queryFn: () => usersApi.getEventRecords(initialUser!.id),
  });

  const editEventIds = useMemo(() => {
    const ids = new Set<string>();
    for (const record of eventRecordsQuery.data ?? []) ids.add(record.eventId);
    if (contextEventId) ids.add(contextEventId);
    return [...ids];
  }, [eventRecordsQuery.data, contextEventId]);

  const membershipQueries = useQueries({
    queries: editEventIds.map((eventId) => ({
      queryKey: ['memberships', 'list', eventId, 'attendee-edit'],
      queryFn: () => membershipsApi.list({ eventId, perPage: 100 }),
      enabled: open && mode === 'edit',
    })),
  });

  const membershipsByEventId = useMemo(() => {
    const map = new Map<string, PublicMembership[]>();
    editEventIds.forEach((eventId, index) => {
      map.set(eventId, membershipQueries[index]?.data?.items ?? []);
    });
    return map;
  }, [editEventIds, membershipQueries]);

  const sortedEventRecords = useMemo(() => {
    const records = [...(eventRecordsQuery.data ?? [])];
    records.sort((a, b) => {
      if (contextEventId) {
        const aMatch = a.eventId === contextEventId ? 0 : 1;
        const bMatch = b.eventId === contextEventId ? 0 : 1;
        if (aMatch !== bMatch) return aMatch - bMatch;
      }
      return new Date(b.eventStartDate).getTime() - new Date(a.eventStartDate).getTime();
    });
    return records;
  }, [eventRecordsQuery.data, contextEventId]);

  useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    setErrors({});
    setEventMemberships({});
    if (initialUser) {
      setValues(userToForm(initialUser));
    } else {
      const eventId = defaultEventId || events[0]?.id || '';
      setValues({ ...emptyForm, eventId });
      if (eventId) onEventChange?.(eventId);
    }
    // Intentionally only reset when opening / switching user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialUser]);

  useEffect(() => {
    if (!open || mode !== 'edit' || !eventRecordsQuery.data) return;
    const next: Record<string, string> = {};
    for (const record of eventRecordsQuery.data) {
      if (record.summary.currentMembershipId) {
        next[record.eventId] = record.summary.currentMembershipId;
      }
    }
    if (contextEventId && !next[contextEventId] && initialUser?.membershipId) {
      next[contextEventId] = initialUser.membershipId;
    }
    setEventMemberships(next);
  }, [open, mode, eventRecordsQuery.data, contextEventId, initialUser?.membershipId]);

  const editMembershipsLoading =
    eventRecordsQuery.isLoading || membershipQueries.some((query) => query.isLoading);

  const visibleEditEventIds = useMemo(() => {
    const ids = sortedEventRecords.map((record) => record.eventId);
    if (
      contextEventId &&
      contextEvent &&
      !ids.includes(contextEventId)
    ) {
      ids.push(contextEventId);
    }
    return ids;
  }, [sortedEventRecords, contextEventId, contextEvent]);

  useEffect(() => {
    if (!open || mode !== 'edit' || editMembershipsLoading) return;
    setEventMemberships((current) => {
      const next = { ...current };
      let changed = false;
      for (const eventId of visibleEditEventIds) {
        if (next[eventId]?.trim()) continue;
        const options = membershipsByEventId.get(eventId) ?? [];
        if (options[0]) {
          next[eventId] = options[0].id;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [open, mode, editMembershipsLoading, visibleEditEventIds, membershipsByEventId]);

  if (!open) return null;

  function update<K extends keyof AttendeeFormValues>(key: K, value: AttendeeFormValues[K]) {
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (key === 'eventId') {
        next.membershipId = '';
        onEventChange?.(String(value));
      }
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
    await onSubmit(
      mode === 'create' ? toCreatePayload(nextValues) : toUpdatePayload(nextValues),
    );
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

          {mode === 'create' ? (
            <p className="hint" style={{ marginTop: -4 }}>
              No password needed — they get an invite code by email (same as checkout).
            </p>
          ) : null}

          {mode === 'create' ? (
            <label className="field">
              <span className="field-label">
                Event <span className="required-mark">*</span>
              </span>
              <select
                className="field-input"
                value={values.eventId}
                onChange={(e) => update('eventId', e.target.value)}
                required
              >
                <option value="">Select event</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name} ({formatEditionRange(event)}
                    {event.status === 'live'
                      ? ', live'
                      : event.status === 'upcoming'
                        ? ', upcoming'
                        : event.status === 'ended'
                          ? ', past'
                          : ''}
                    )
                  </option>
                ))}
              </select>
              {errors.eventId ? <p className="form-error">{errors.eventId}</p> : null}
            </label>
          ) : null}

          {mode === 'create' ? (
            <label className="field">
              <span className="field-label">
                Membership <span className="required-mark">*</span>
              </span>
              <select
                className="field-input"
                value={values.membershipId}
                onChange={(e) => update('membershipId', e.target.value)}
                disabled={!values.eventId}
                required
              >
                <option value="">
                  {values.eventId ? 'Select membership' : 'Select an event first'}
                </option>
                {memberships.map((membership) => (
                  <option key={membership.id} value={membership.id}>
                    {membership.name}
                    {membership.price != null ? ` ($${membership.price})` : ''}
                  </option>
                ))}
              </select>
              {membershipsLoading ? <p className="hint">Loading memberships…</p> : null}
              {values.eventId && !membershipsLoading && memberships.length === 0 ? (
                <p className="hint">No memberships are linked to this event yet.</p>
              ) : null}
              {errors.membershipId ? <p className="form-error">{errors.membershipId}</p> : null}
            </label>
          ) : (
            <fieldset className="schedule-fieldset">
              <legend>Memberships by event</legend>
              <p className="hint" style={{ marginTop: 0 }}>
                Membership is read-only here. Changes are made through checkout or when creating
                the attendee.
              </p>
              {editMembershipsLoading ? <p className="hint">Loading event memberships…</p> : null}
              {!editMembershipsLoading && sortedEventRecords.length === 0 ? (
                <p className="hint">No paid event memberships recorded yet.</p>
              ) : null}
              {sortedEventRecords.map((record) => {
                const options = membershipsByEventId.get(record.eventId) ?? [];
                const selected = eventMemberships[record.eventId] ?? options[0]?.id ?? '';
                return (
                  <label key={record.eventId} className="field">
                    <span className="field-label">{eventRecordLabel(record)}</span>
                    <select
                      className="field-input"
                      value={selected}
                      disabled
                    >
                      {options.map((membership) => (
                        <option key={membership.id} value={membership.id}>
                          {membership.name}
                          {membership.price != null ? ` ($${membership.price})` : ''}
                        </option>
                      ))}
                    </select>
                    {!options.length ? (
                      <p className="hint">No memberships are linked to this event yet.</p>
                    ) : null}
                  </label>
                );
              })}
              {contextEventId &&
              contextEvent &&
              !sortedEventRecords.some((record) => record.eventId === contextEventId) ? (
                (() => {
                  const options = membershipsByEventId.get(contextEventId) ?? [];
                  const selected = eventMemberships[contextEventId] ?? options[0]?.id ?? '';
                  return (
                <label className="field">
                  <span className="field-label">{eventLabel(contextEvent)}</span>
                  <select className="field-input" value={selected} disabled>
                    {options.map((membership) => (
                      <option key={membership.id} value={membership.id}>
                        {membership.name}
                        {membership.price != null ? ` ($${membership.price})` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                  );
                })()
              ) : null}
            </fieldset>
          )}

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

          {ATTENDEE_UI.showIsVip ? (
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={values.isVip}
                onChange={(e) => update('isVip', e.target.checked)}
              />
              <span>is_vip</span>
            </label>
          ) : null}

          {ATTENDEE_UI.showPoints ? (
            <Input
              label="points"
              name="points"
              type="number"
              min={0}
              value={values.points}
              error={errors.points}
              onChange={(e) => update('points', e.target.value)}
            />
          ) : null}

          {ATTENDEE_UI.showProfileCompleted ? (
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={values.profileCompleted}
                onChange={(e) => update('profileCompleted', e.target.checked)}
              />
              <span>profile_completed</span>
            </label>
          ) : null}

          {ATTENDEE_UI.showStatus ? (
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
          ) : null}

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
