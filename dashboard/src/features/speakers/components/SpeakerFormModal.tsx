import { useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import type { PublicSpeaker, SpeakerPayload } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { TextArea } from '@/shared/ui/TextArea';

export interface SpeakerFormValues {
  name: string;
  title: string;
  description: string;
  photo: string;
}

type FieldErrors = Partial<Record<keyof SpeakerFormValues, string>>;

const emptyForm: SpeakerFormValues = {
  name: '',
  title: '',
  description: '',
  photo: '',
};

function speakerToForm(speaker: PublicSpeaker): SpeakerFormValues {
  return {
    name: speaker.name,
    title: speaker.title,
    description: speaker.description,
    photo: speaker.photo,
  };
}

function validate(values: SpeakerFormValues): FieldErrors {
  const errors: FieldErrors = {};

  if (!values.name.trim()) errors.name = 'Name is required';
  else if (values.name.trim().length < 2) errors.name = 'Name must be at least 2 characters';

  if (values.photo.trim() && !/^https?:\/\//i.test(values.photo.trim())) {
    errors.photo = 'Photo must be a valid URL';
  }

  return errors;
}

export function toSpeakerPayload(values: SpeakerFormValues): SpeakerPayload {
  return {
    name: values.name.trim(),
    title: values.title.trim(),
    description: values.description.trim(),
    photo: values.photo.trim(),
  };
}

interface SpeakerFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialSpeaker?: PublicSpeaker | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (payload: SpeakerPayload) => Promise<void> | void;
}

export function SpeakerFormModal({
  open,
  mode,
  initialSpeaker,
  loading = false,
  onClose,
  onSubmit,
}: SpeakerFormModalProps) {
  const [values, setValues] = useState<SpeakerFormValues>(emptyForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    setErrors({});
    setValues(initialSpeaker ? speakerToForm(initialSpeaker) : emptyForm);
  }, [open, initialSpeaker]);

  if (!open) return null;

  function update<K extends keyof SpeakerFormValues>(key: K, value: SpeakerFormValues[K]) {
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
    await onSubmit(toSpeakerPayload(values));
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="speaker-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="speaker-form-title">{mode === 'create' ? 'Create Speaker' : 'Edit Speaker'}</h2>
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
            placeholder="Maya Chen"
          />
          <Input
            label="Title"
            name="title"
            value={values.title}
            error={errors.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="Founder & Keynote Speaker"
          />
          <TextArea
            label="Description"
            name="description"
            value={values.description}
            error={errors.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="A short bio for the speaker..."
          />
          <Input
            label="Photo URL"
            name="photo"
            value={values.photo}
            error={errors.photo}
            onChange={(e) => update('photo', e.target.value)}
            placeholder="https://..."
          />
          {values.photo.trim() && /^https?:\/\//i.test(values.photo.trim()) ? (
            <div className="speaker-photo-preview">
              <img src={values.photo.trim()} alt="Speaker preview" />
            </div>
          ) : null}

          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              {mode === 'create' ? 'Create speaker' : 'Save changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
