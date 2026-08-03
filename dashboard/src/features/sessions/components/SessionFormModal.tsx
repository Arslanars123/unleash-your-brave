import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Plus, Trash2, Upload, X } from 'lucide-react';
import { uploadsApi } from '@/features/uploads/api/uploads-api';
import { getApiErrorMessage } from '@/shared/api/client';
import { isValidMediaRef } from '@/shared/lib/media';
import type {
  PublicEventDay,
  PublicSession,
  PublicSpeaker,
  SessionMaterialType,
  SessionPayload,
} from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { TextArea } from '@/shared/ui/TextArea';
import { useToast } from '@/shared/ui/toast';

interface MaterialRow {
  key: string;
  type: SessionMaterialType;
  title: string;
  url: string;
}

export interface SessionFormValues {
  name: string;
  description: string;
  speakerId: string;
  eventDayNumber: string;
  startTime: string;
  endTime: string;
  location: string;
  materials: MaterialRow[];
  feedbackEnabled: boolean;
}

type FieldErrors = Partial<Record<string, string>>;

const MATERIAL_TYPES: SessionMaterialType[] = ['pdf', 'video', 'doc', 'link'];

function newKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyMaterial(): MaterialRow {
  return { key: newKey(), type: 'link', title: '', url: '' };
}

const emptyForm: SessionFormValues = {
  name: '',
  description: '',
  speakerId: '',
  eventDayNumber: '',
  startTime: '',
  endTime: '',
  location: '',
  materials: [],
  feedbackEnabled: true,
};

function sessionToForm(session: PublicSession): SessionFormValues {
  return {
    name: session.name,
    description: session.description,
    speakerId: session.speakerId,
    eventDayNumber: String(session.eventDayNumber),
    startTime: session.startTime ?? '',
    endTime: session.endTime ?? '',
    location: session.location ?? '',
    materials: session.materials.map((material) => ({
      key: material.id || newKey(),
      type: material.type,
      title: material.title,
      url: material.url,
    })),
    feedbackEnabled: session.feedbackEnabled ?? true,
  };
}

function validate(values: SessionFormValues): FieldErrors {
  const errors: FieldErrors = {};

  if (!values.name.trim()) errors.name = 'Name is required';
  else if (values.name.trim().length < 2) errors.name = 'Name must be at least 2 characters';

  if (!values.speakerId) errors.speakerId = 'Select a speaker';
  if (!values.eventDayNumber) errors.eventDayNumber = 'Select an event day';

  const start = values.startTime.trim();
  const end = values.endTime.trim();
  if ((start && !end) || (!start && end)) {
    errors[start ? 'endTime' : 'startTime'] =
      'Provide both start and end time, or leave both empty';
  } else if (start && end && end <= start) {
    errors.endTime = 'End time must be after start time';
  }

  if (values.location.trim().length > 160) {
    errors.location = 'Location must be 160 characters or fewer';
  }

  values.materials.forEach((material, index) => {
    if (!material.title.trim()) errors[`material-title-${index}`] = 'Title is required';
    if (!material.url.trim()) errors[`material-url-${index}`] = 'URL or file is required';
    else if (!isValidMediaRef(material.url.trim())) {
      errors[`material-url-${index}`] = 'Enter a valid URL or upload a file';
    }
  });

  return errors;
}

export function toSessionPayload(values: SessionFormValues): SessionPayload {
  return {
    name: values.name.trim(),
    description: values.description.trim(),
    speakerId: values.speakerId,
    eventDayNumber: Number(values.eventDayNumber),
    startTime: values.startTime.trim(),
    endTime: values.endTime.trim(),
    location: values.location.trim(),
    materials: values.materials.map((material) => ({
      type: material.type,
      title: material.title.trim(),
      url: material.url.trim(),
    })),
    feedbackEnabled: values.feedbackEnabled,
  };
}

interface SessionFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialSession?: PublicSession | null;
  speakers: PublicSpeaker[];
  eventDays: PublicEventDay[];
  loading?: boolean;
  onClose: () => void;
  onSubmit: (payload: SessionPayload) => Promise<void> | void;
}

export function SessionFormModal({
  open,
  mode,
  initialSession,
  speakers,
  eventDays,
  loading = false,
  onClose,
  onSubmit,
}: SessionFormModalProps) {
  const toast = useToast();
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [values, setValues] = useState<SessionFormValues>(emptyForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    setErrors({});
    setUploadingKey(null);
    setValues(
      initialSession
        ? sessionToForm(initialSession)
        : {
            ...emptyForm,
            eventDayNumber: eventDays[0] ? String(eventDays[0].dayNumber) : '',
            speakerId: speakers[0]?.id ?? '',
          },
    );
  }, [open, initialSession, eventDays, speakers]);

  if (!open) return null;

  function setForm(next: SessionFormValues) {
    setValues(next);
    if (submitted) setErrors(validate(next));
  }

  function update<K extends keyof SessionFormValues>(key: K, value: SessionFormValues[K]) {
    setForm({ ...values, [key]: value });
  }

  function updateMaterial(index: number, patch: Partial<MaterialRow>) {
    const materials = values.materials.map((row, i) => (i === index ? { ...row, ...patch } : row));
    setForm({ ...values, materials });
  }

  function addMaterial() {
    setForm({ ...values, materials: [...values.materials, emptyMaterial()] });
  }

  function removeMaterial(index: number) {
    setForm({
      ...values,
      materials: values.materials.filter((_, i) => i !== index),
    });
  }

  async function handleMaterialUpload(index: number, file: File | undefined) {
    if (!file) return;
    const row = values.materials[index];
    if (!row) return;

    setUploadingKey(row.key);
    try {
      const uploaded = await uploadsApi.uploadMaterial(file);
      updateMaterial(index, {
        url: uploaded.url,
        title: row.title || uploaded.originalName,
        type: guessMaterialType(file),
      });
      toast.success('Material uploaded');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to upload material'));
    } finally {
      setUploadingKey(null);
      const input = fileRefs.current[row.key];
      if (input) input.value = '';
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    await onSubmit(toSessionPayload(values));
  }

  const busy = loading || uploadingKey !== null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel modal-panel-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="session-form-title">{mode === 'create' ? 'Create Session' : 'Edit Session'}</h2>
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
            placeholder="Opening Keynote"
          />
          <TextArea
            label="Description"
            name="description"
            value={values.description}
            error={errors.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="What this session covers..."
          />

          <label className="field">
            <span className="field-label">
              Assigned speaker <span className="required-mark">*</span>
            </span>
            <select
              className={`field-input${errors.speakerId ? ' field-input-error' : ''}`}
              value={values.speakerId}
              onChange={(e) => update('speakerId', e.target.value)}
            >
              <option value="">Select speaker</option>
              {speakers.map((speaker) => (
                <option key={speaker.id} value={speaker.id}>
                  {speaker.name}
                  {speaker.title ? ` — ${speaker.title}` : ''}
                </option>
              ))}
            </select>
            {errors.speakerId ? <span className="field-error">{errors.speakerId}</span> : null}
          </label>

          <label className="field">
            <span className="field-label">
              Event day <span className="required-mark">*</span>
            </span>
            <select
              className={`field-input${errors.eventDayNumber ? ' field-input-error' : ''}`}
              value={values.eventDayNumber}
              onChange={(e) => update('eventDayNumber', e.target.value)}
            >
              <option value="">Select day</option>
              {eventDays.map((day) => (
                <option key={day.dayNumber} value={day.dayNumber}>
                  Day {day.dayNumber}
                  {day.label ? ` — ${day.label}` : ''} ({day.date.slice(0, 10)})
                </option>
              ))}
            </select>
            {errors.eventDayNumber ? (
              <span className="field-error">{errors.eventDayNumber}</span>
            ) : null}
          </label>

          <div className="schedule-grid">
            <Input
              label="Start time"
              name="startTime"
              type="time"
              value={values.startTime}
              error={errors.startTime}
              onChange={(e) => update('startTime', e.target.value)}
            />
            <Input
              label="End time"
              name="endTime"
              type="time"
              value={values.endTime}
              error={errors.endTime}
              onChange={(e) => update('endTime', e.target.value)}
            />
          </div>
          <p className="hint" style={{ marginTop: '-0.35rem' }}>
            Optional. Example: 9:00 AM – 10:00 AM.
          </p>

          <Input
            label="Location"
            name="location"
            value={values.location}
            error={errors.location}
            onChange={(e) => update('location', e.target.value)}
            placeholder="Main Ballroom"
            maxLength={160}
          />

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={values.feedbackEnabled}
              onChange={(e) => update('feedbackEnabled', e.target.checked)}
            />
            <span>
              Allow ratings &amp; reviews for this session
              <span className="hint" style={{ display: 'block', marginTop: '0.15rem' }}>
                Members can submit a 1–5 star rating and optional comment in the app.
              </span>
            </span>
          </label>

          <fieldset className="schedule-fieldset">
            <legend>Materials</legend>
            <p className="hint">Add PDFs, videos, docs, or links. Upload a file or paste a URL.</p>

            <div className="day-list">
              {values.materials.length === 0 ? (
                <p className="muted">No materials yet.</p>
              ) : (
                values.materials.map((material, index) => (
                  <div className="material-row" key={material.key}>
                    <label className="field">
                      <span className="field-label">Type</span>
                      <select
                        className="field-input"
                        value={material.type}
                        onChange={(e) =>
                          updateMaterial(index, {
                            type: e.target.value as SessionMaterialType,
                          })
                        }
                      >
                        {MATERIAL_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Input
                      label="Title"
                      name={`material-title-${index}`}
                      value={material.title}
                      error={errors[`material-title-${index}`]}
                      onChange={(e) => updateMaterial(index, { title: e.target.value })}
                      placeholder="Worksheet PDF"
                    />
                    <Input
                      label="URL / file path"
                      name={`material-url-${index}`}
                      value={material.url}
                      error={errors[`material-url-${index}`]}
                      onChange={(e) => updateMaterial(index, { url: e.target.value })}
                      placeholder="https://… or /uploads/…"
                    />
                    <div className="material-row-actions">
                      <input
                        ref={(el) => {
                          fileRefs.current[material.key] = el;
                        }}
                        type="file"
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.mp4,.webm,.mov,application/pdf,video/*"
                        hidden
                        onChange={(e) =>
                          void handleMaterialUpload(index, e.target.files?.[0])
                        }
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        loading={uploadingKey === material.key}
                        disabled={busy}
                        onClick={() => fileRefs.current[material.key]?.click()}
                      >
                        <Upload size={14} />
                        Upload
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => removeMaterial(index)}
                        aria-label="Remove material"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                ))
              )}

              <Button type="button" variant="secondary" onClick={addMaterial} disabled={busy}>
                <Plus size={16} />
                Add material
              </Button>
            </div>
          </fieldset>

          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              {mode === 'create' ? 'Create session' : 'Save changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function guessMaterialType(file: File): SessionMaterialType {
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  if (mime.includes('pdf') || name.endsWith('.pdf')) return 'pdf';
  if (mime.startsWith('video/') || /\.(mp4|webm|mov)$/.test(name)) return 'video';
  if (
    mime.includes('word') ||
    mime.includes('presentation') ||
    mime.includes('text') ||
    /\.(doc|docx|ppt|pptx|txt)$/.test(name)
  ) {
    return 'doc';
  }
  return 'link';
}
