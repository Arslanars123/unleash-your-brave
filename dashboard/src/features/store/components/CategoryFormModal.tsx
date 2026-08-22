import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { uploadsApi } from '@/features/uploads/api/uploads-api';
import { getApiErrorMessage } from '@/shared/api/client';
import { prepareImageForUpload } from '@/shared/lib/compress-image';
import { isValidMediaRef, resolveMediaUrl } from '@/shared/lib/media';
import type { PublicStoreCategory, StoreCategoryPayload } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { TextArea } from '@/shared/ui/TextArea';
import { useToast } from '@/shared/ui/toast';

interface FormValues {
  name: string;
  description: string;
  image: string;
  sortOrder: string;
  isActive: boolean;
}

type FieldErrors = Partial<Record<string, string>>;

const emptyForm: FormValues = {
  name: '',
  description: '',
  image: '',
  sortOrder: '0',
  isActive: true,
};

function toForm(category: PublicStoreCategory): FormValues {
  return {
    name: category.name,
    description: category.description,
    image: category.image,
    sortOrder: String(category.sortOrder ?? 0),
    isActive: category.isActive,
  };
}

function validate(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.name.trim() || values.name.trim().length < 2) {
    errors.name = 'Name is required (min 2 characters)';
  }
  if (values.image.trim() && !isValidMediaRef(values.image.trim())) {
    errors.image = 'Enter a valid URL or upload an image';
  }
  return errors;
}

export function toCategoryPayload(values: FormValues): StoreCategoryPayload {
  return {
    name: values.name.trim(),
    description: values.description.trim(),
    image: values.image.trim(),
    sortOrder: Number(values.sortOrder) || 0,
    isActive: values.isActive,
  };
}

interface CategoryFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initial?: PublicStoreCategory | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (payload: StoreCategoryPayload) => Promise<void> | void;
}

export function CategoryFormModal({
  open,
  mode,
  initial,
  loading = false,
  onClose,
  onSubmit,
}: CategoryFormModalProps) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [values, setValues] = useState<FormValues>(emptyForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    setErrors({});
    setValues(initial ? toForm(initial) : emptyForm);
  }, [open, initial]);

  if (!open) return null;

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    const next = { ...values, [key]: value };
    setValues(next);
    if (submitted) setErrors(validate(next));
  }

  async function handleUpload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const prepared = await prepareImageForUpload(file);
      const uploaded = await uploadsApi.uploadImage(prepared);
      update('image', uploaded.url);
      toast.success('Image uploaded');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to upload image'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    await onSubmit(toCategoryPayload(values));
  }

  const busy = loading || uploading;
  const preview = resolveMediaUrl(values.image);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2>{mode === 'create' ? 'Create category' : 'Edit category'}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <form className="modal-body event-form" onSubmit={handleSubmit} noValidate>
          <Input
            label="Name"
            requiredMark
            value={values.name}
            error={errors.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Apparel"
          />
          <TextArea
            label="Description"
            value={values.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="What belongs in this category..."
          />
          <Input
            label="Sort order"
            type="number"
            value={values.sortOrder}
            onChange={(e) => update('sortOrder', e.target.value)}
          />
          <div className="field">
            <span className="field-label">Image</span>
            {preview ? (
              <img
                src={preview}
                alt=""
                style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }}
              />
            ) : null}
            <Input
              label="Image URL"
              value={values.image}
              error={errors.image}
              onChange={(e) => update('image', e.target.value)}
              placeholder="Upload or paste URL"
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => void handleUpload(e.target.files?.[0])}
            />
            <Button
              type="button"
              variant="secondary"
              loading={uploading}
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus size={14} />
              Upload image
            </Button>
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={values.isActive}
              onChange={(e) => update('isActive', e.target.checked)}
            />
            Visible in the mobile store
          </label>
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              {mode === 'create' ? 'Create category' : 'Save changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
