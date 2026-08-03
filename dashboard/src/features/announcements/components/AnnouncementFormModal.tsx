import { useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import type { AnnouncementPayload, PublicAnnouncement } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { TextArea } from '@/shared/ui/TextArea';

export interface AnnouncementFormValues {
  title: string;
  description: string;
}

type FieldErrors = Partial<Record<keyof AnnouncementFormValues, string>>;

const emptyForm: AnnouncementFormValues = {
  title: '',
  description: '',
};

function toForm(announcement: PublicAnnouncement): AnnouncementFormValues {
  return {
    title: announcement.title,
    description: announcement.description,
  };
}

function validate(values: AnnouncementFormValues): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.title.trim()) errors.title = 'Title is required';
  else if (values.title.trim().length < 2) errors.title = 'Title must be at least 2 characters';
  return errors;
}

export function toAnnouncementPayload(values: AnnouncementFormValues): AnnouncementPayload {
  return {
    title: values.title.trim(),
    description: values.description.trim(),
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

  useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    setErrors({});
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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    await onSubmit(toAnnouncementPayload(values));
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel"
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
          <p className="hint">Announcements are title + description only — no likes or comments.</p>

          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              {mode === 'create' ? 'Create announcement' : 'Save changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
