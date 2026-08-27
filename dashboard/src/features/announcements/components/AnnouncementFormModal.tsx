import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { usersApi } from '@/features/users/api/users-api';
import type {
  AnnouncementDelivery,
  AnnouncementPayload,
  AudienceType,
  PublicAnnouncement,
  UserRole,
} from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { TextArea } from '@/shared/ui/TextArea';

export interface AnnouncementFormValues {
  title: string;
  description: string;
  delivery: AnnouncementDelivery;
  scheduledAtLocal: string;
  audienceType: AudienceType;
  audienceRoles: UserRole[];
  audienceUserIds: string[];
  sendPush: boolean;
}

type FieldErrors = Partial<Record<keyof AnnouncementFormValues, string>>;

const emptyForm: AnnouncementFormValues = {
  title: '',
  description: '',
  delivery: 'immediate',
  scheduledAtLocal: '',
  audienceType: 'all',
  audienceRoles: [],
  audienceUserIds: [],
  sendPush: true,
};

function toLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localInputToIso(local: string): string | null {
  if (!local.trim()) return null;
  const date = new Date(local);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function toForm(announcement: PublicAnnouncement): AnnouncementFormValues {
  const delivery: AnnouncementDelivery =
    announcement.status === 'scheduled'
      ? 'scheduled'
      : announcement.status === 'draft'
        ? 'draft'
        : 'immediate';
  // Selected groups (roles) removed from UI — treat legacy role audiences as all attendees.
  const audienceType: AudienceType =
    announcement.audienceType === 'users' ? 'users' : 'all';
  return {
    title: announcement.title,
    description: announcement.description,
    delivery,
    scheduledAtLocal: toLocalInputValue(announcement.scheduledAt),
    audienceType,
    audienceRoles: [],
    audienceUserIds: announcement.audienceUserIds ?? [],
    sendPush: announcement.sendPush ?? true,
  };
}

function validate(values: AnnouncementFormValues): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.title.trim()) errors.title = 'Title is required';
  else if (values.title.trim().length < 2) errors.title = 'Title must be at least 2 characters';

  if (values.delivery === 'scheduled') {
    if (!values.scheduledAtLocal) errors.scheduledAtLocal = 'Pick a date and time';
    else if (new Date(values.scheduledAtLocal).getTime() <= Date.now()) {
      errors.scheduledAtLocal = 'Scheduled time must be in the future';
    }
  }
  if (values.audienceType === 'users' && values.audienceUserIds.length === 0) {
    errors.audienceUserIds = 'Select at least one attendee';
  }
  return errors;
}

export function toAnnouncementPayload(values: AnnouncementFormValues): AnnouncementPayload {
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    delivery: values.delivery,
    audienceType: values.audienceType,
    audienceRoles: values.audienceType === 'roles' ? values.audienceRoles : [],
    audienceUserIds: values.audienceType === 'users' ? values.audienceUserIds : [],
    scheduledAt:
      values.delivery === 'scheduled' ? localInputToIso(values.scheduledAtLocal) : null,
    sendPush: values.sendPush,
  };
}

interface AnnouncementFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialAnnouncement?: PublicAnnouncement | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (payload: AnnouncementPayload) => Promise<void> | void;
}

export function AnnouncementFormModal({
  open,
  mode,
  initialAnnouncement,
  loading = false,
  onClose,
  onSubmit,
}: AnnouncementFormModalProps) {
  const [values, setValues] = useState<AnnouncementFormValues>(emptyForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  const usersQuery = useQuery({
    queryKey: ['users', 'announcement-audience', userSearch],
    queryFn: () =>
      usersApi.list({
        search: userSearch || undefined,
        role: 'member',
        status: 'active',
        perPage: 50,
      }),
    enabled: open && values.audienceType === 'users',
  });

  const selectedUsersLabel = useMemo(() => {
    const selected = new Set(values.audienceUserIds);
    return (usersQuery.data?.items ?? []).filter((u) => selected.has(u.id));
  }, [usersQuery.data?.items, values.audienceUserIds]);

  useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    setErrors({});
    setUserSearch('');
    setValues(initialAnnouncement ? toForm(initialAnnouncement) : emptyForm);
  }, [open, initialAnnouncement]);

  if (!open) return null;

  function update<K extends keyof AnnouncementFormValues>(
    key: K,
    value: AnnouncementFormValues[K],
  ) {
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (submitted) setErrors(validate(next));
      return next;
    });
  }

  function toggleUser(userId: string) {
    setValues((current) => {
      const has = current.audienceUserIds.includes(userId);
      const audienceUserIds = has
        ? current.audienceUserIds.filter((id) => id !== userId)
        : [...current.audienceUserIds, userId];
      const next = { ...current, audienceUserIds };
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
    await onSubmit(toAnnouncementPayload(values));
  }

  const isPublishedEdit =
    mode === 'edit' && initialAnnouncement?.status === 'published';

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel modal-panel-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="announcement-form-title">
            {mode === 'create' ? 'Create Announcement' : 'Edit Announcement'}
          </h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <form className="modal-body event-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
          <Input
            label="Title"
            requiredMark
            name="title"
            value={values.title}
            error={errors.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="Doors open at 8:30 AM"
          />
          <TextArea
            label="Description"
            name="description"
            value={values.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Share details attendees need to know..."
          />

          {!isPublishedEdit ? (
            <fieldset className="form-fieldset">
              <legend>Delivery</legend>
              <div className="radio-row">
                {(
                  [
                    ['immediate', 'Send now'],
                    ['scheduled', 'Schedule'],
                    ['draft', 'Save as draft'],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className="checkbox-row">
                    <input
                      type="radio"
                      name="delivery"
                      checked={values.delivery === value}
                      onChange={() => update('delivery', value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
              {values.delivery === 'scheduled' ? (
                <Input
                  label="Send at"
                  requiredMark
                  type="datetime-local"
                  name="scheduledAt"
                  value={values.scheduledAtLocal}
                  error={errors.scheduledAtLocal}
                  onChange={(e) => update('scheduledAtLocal', e.target.value)}
                />
              ) : null}
            </fieldset>
          ) : null}

          <fieldset className="form-fieldset">
            <legend>Audience</legend>
            <div className="radio-row">
              {(
                [
                  ['all', 'All attendees'],
                  ['users', 'Specific people'],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="checkbox-row">
                  <input
                    type="radio"
                    name="audienceType"
                    checked={values.audienceType === value}
                    onChange={() => update('audienceType', value)}
                  />
                  {label}
                </label>
              ))}
            </div>

            {values.audienceType === 'users' ? (
              <div className="audience-picker">
                <Input
                  label="Search attendees"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Name or email"
                />
                {selectedUsersLabel.length > 0 ? (
                  <p className="hint">
                    Selected: {values.audienceUserIds.length} attendee
                    {values.audienceUserIds.length === 1 ? '' : 's'}
                  </p>
                ) : null}
                <div className="audience-list">
                  {(usersQuery.data?.items ?? []).map((user) => (
                    <label key={user.id} className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={values.audienceUserIds.includes(user.id)}
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
                    <p className="muted">No attendees found.</p>
                  ) : null}
                </div>
                {errors.audienceUserIds ? (
                  <p className="field-error">{errors.audienceUserIds}</p>
                ) : null}
              </div>
            ) : null}
          </fieldset>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={values.sendPush}
              onChange={(e) => update('sendPush', e.target.checked)}
            />
            Send push notification when published
          </label>

          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              {mode === 'create'
                ? values.delivery === 'immediate'
                  ? 'Publish now'
                  : values.delivery === 'scheduled'
                    ? 'Schedule'
                    : 'Save draft'
                : 'Save changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
