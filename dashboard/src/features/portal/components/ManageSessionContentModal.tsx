import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ExternalLink, FileText, Plus, Trash2, Upload, X } from 'lucide-react';
import { uploadsApi } from '@/features/uploads/api/uploads-api';
import { getApiErrorMessage } from '@/shared/api/client';
import { formatSessionTimeRange } from '@/shared/lib/datetime';
import { isValidMediaRef, resolveMediaUrl } from '@/shared/lib/media';
import type {
  PublicSession,
  SessionMaterialPayload,
  SessionMaterialType,
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

type FieldErrors = Partial<Record<string, string>>;

const MATERIAL_TYPES: SessionMaterialType[] = ['pdf', 'video', 'doc', 'link'];

function newKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyMaterial(): MaterialRow {
  return { key: newKey(), type: 'link', title: '', url: '' };
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

interface ManageSessionContentModalProps {
  open: boolean;
  session: PublicSession | null;
  loading?: boolean;
  onClose: () => void;
  onSave: (payload: {
    description: string;
    materials: SessionMaterialPayload[];
  }) => Promise<void> | void;
}

export function ManageSessionContentModal({
  open,
  session,
  loading = false,
  onClose,
  onSave,
}: ManageSessionContentModalProps) {
  const toast = useToast();
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [description, setDescription] = useState('');
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !session) return;
    setSubmitted(false);
    setErrors({});
    setUploadingKey(null);
    setDescription(session.description ?? '');
    setMaterials(
      session.materials.map((material) => ({
        key: material.id || newKey(),
        type: material.type,
        title: material.title,
        url: material.url,
      })),
    );
  }, [open, session]);

  if (!open || !session) return null;

  function validate(rows: MaterialRow[]): FieldErrors {
    const next: FieldErrors = {};
    rows.forEach((material, index) => {
      if (!material.title.trim()) next[`title-${index}`] = 'Title is required';
      if (!material.url.trim()) next[`url-${index}`] = 'URL or file is required';
      else if (!isValidMediaRef(material.url.trim())) {
        next[`url-${index}`] = 'Enter a valid URL or upload a file';
      }
    });
    return next;
  }

  function updateMaterial(index: number, patch: Partial<MaterialRow>) {
    setMaterials((current) => {
      const next = current.map((row, i) => (i === index ? { ...row, ...patch } : row));
      if (submitted) setErrors(validate(next));
      return next;
    });
  }

  function addMaterial() {
    setMaterials((current) => [...current, emptyMaterial()]);
  }

  function removeMaterial(index: number) {
    setMaterials((current) => {
      const next = current.filter((_, i) => i !== index);
      if (submitted) setErrors(validate(next));
      return next;
    });
  }

  async function handleUpload(index: number, file: File | undefined) {
    if (!file) return;
    const row = materials[index];
    if (!row) return;

    setUploadingKey(row.key);
    try {
      const uploaded = await uploadsApi.uploadMaterial(file);
      updateMaterial(index, {
        url: uploaded.url,
        title: row.title || uploaded.originalName,
        type: guessMaterialType(file),
      });
      toast.success('File uploaded');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to upload file'));
    } finally {
      setUploadingKey(null);
      const input = fileRefs.current[row.key];
      if (input) input.value = '';
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    const nextErrors = validate(materials);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    await onSave({
      description: description.trim(),
      materials: materials.map((material) => ({
        type: material.type,
        title: material.title.trim(),
        url: material.url.trim(),
      })),
    });
  }

  const busy = loading || uploadingKey !== null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel modal-panel-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-content-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <h2 id="manage-content-title">Manage content</h2>
            <p className="muted" style={{ marginTop: '0.25rem' }}>
              {[
                session.name,
                `Day ${session.eventDayNumber}`,
                formatSessionTimeRange(session.startTime, session.endTime),
                session.location?.trim(),
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <form className="modal-body event-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
          <TextArea
            label="Session description"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What attendees should know about this session…"
          />

          <section className="content-materials-section">
            <div className="content-materials-header">
              <div>
                <h3>Uploaded content</h3>
                <p className="hint">
                  {materials.length === 0
                    ? 'No materials yet — add PDFs, videos, docs, or links.'
                    : `${materials.length} ${materials.length === 1 ? 'item' : 'items'} for this session.`}
                </p>
              </div>
              <Button type="button" variant="secondary" onClick={addMaterial} disabled={busy}>
                <Plus size={16} />
                Add content
              </Button>
            </div>

            {materials.length === 0 ? (
              <div className="content-empty">
                <FileText size={22} />
                <p>No content uploaded for this session yet.</p>
                <Button type="button" onClick={addMaterial} disabled={busy}>
                  <Plus size={16} />
                  Add your first file or link
                </Button>
              </div>
            ) : (
              <ul className="content-material-list">
                {materials.map((material, index) => {
                  const canOpen = material.url && isValidMediaRef(material.url);
                  return (
                    <li key={material.key} className="content-material-card">
                      <div className="content-material-card-top">
                        <span className="badge role-admin">{material.type}</span>
                        {canOpen ? (
                          <a
                            className="content-open-link"
                            href={resolveMediaUrl(material.url)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink size={14} />
                            Open
                          </a>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => removeMaterial(index)}
                          aria-label="Remove content"
                          disabled={busy}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>

                      <div className="content-material-fields">
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
                          requiredMark
                          value={material.title}
                          error={errors[`title-${index}`]}
                          onChange={(e) => updateMaterial(index, { title: e.target.value })}
                          placeholder="Worksheet PDF"
                        />
                        <Input
                          label="URL / file path"
                          requiredMark
                          value={material.url}
                          error={errors[`url-${index}`]}
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
                            onChange={(e) => void handleUpload(index, e.target.files?.[0])}
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            loading={uploadingKey === material.key}
                            disabled={busy}
                            onClick={() => fileRefs.current[material.key]?.click()}
                          >
                            <Upload size={14} />
                            Upload file
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Save content
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
