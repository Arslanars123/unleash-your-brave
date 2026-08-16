import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { uploadsApi } from '@/features/uploads/api/uploads-api';
import { getApiErrorMessage } from '@/shared/api/client';
import { prepareImageForUpload } from '@/shared/lib/compress-image';
import { isValidMediaRef, resolveMediaUrl } from '@/shared/lib/media';
import type { PostPayload, PublicPost } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { TextArea } from '@/shared/ui/TextArea';
import { useToast } from '@/shared/ui/toast';

export interface PostFormValues {
  text: string;
  image: string;
  commentsEnabled: boolean;
}

type FieldErrors = Partial<Record<keyof PostFormValues, string>>;

const emptyForm: PostFormValues = {
  text: '',
  image: '',
  commentsEnabled: true,
};

function toForm(post: PublicPost): PostFormValues {
  return {
    text: post.text,
    image: post.image,
    commentsEnabled: post.commentsEnabled ?? true,
  };
}

function validate(values: PostFormValues): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.text.trim()) errors.text = 'Post text is required';
  if (values.image.trim() && !isValidMediaRef(values.image)) {
    errors.image = 'Enter a valid image URL or upload a file';
  }
  return errors;
}

export function toPostPayload(values: PostFormValues): PostPayload {
  return {
    text: values.text.trim(),
    image: values.image.trim(),
    commentsEnabled: values.commentsEnabled,
  };
}

interface PostFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialPost?: PublicPost | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (payload: PostPayload) => Promise<void> | void;
}

export function PostFormModal({
  open,
  mode,
  initialPost,
  loading = false,
  onClose,
  onSubmit,
}: PostFormModalProps) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<PostFormValues>(emptyForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    setErrors({});
    setValues(initialPost ? toForm(initialPost) : emptyForm);
  }, [open, initialPost]);

  if (!open) return null;

  function update<K extends keyof PostFormValues>(key: K, value: PostFormValues[K]) {
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (submitted) setErrors(validate(next));
      return next;
    });
  }

  async function uploadImage(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }

    setUploading(true);
    try {
      const prepared = await prepareImageForUpload(file, { maxEdge: 1440 });
      const uploaded = await uploadsApi.uploadImage(prepared);
      update('image', uploaded.url);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : getApiErrorMessage(error, 'Unable to upload image'),
      );
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
    await onSubmit(toPostPayload(values));
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel modal-panel-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="post-form-title">{mode === 'create' ? 'Create Post' : 'Edit Post'}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <form className="modal-body event-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
          <TextArea
            label="Caption"
            requiredMark
            name="text"
            value={values.text}
            error={errors.text}
            onChange={(e) => update('text', e.target.value)}
            placeholder="Write a caption..."
          />

          <div className="field">
            <span className="field-label">Picture</span>
            <div className="page-header-actions">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
                hidden
                onChange={(e) => void uploadImage(e.target.files?.[0])}
              />
              <Button
                type="button"
                variant="secondary"
                loading={uploading}
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus size={16} />
                Upload image
              </Button>
            </div>
            <p className="hint">
              Pick any photo from your device — it’s resized and compressed automatically
              before upload (Instagram-style).
            </p>
            <Input
              label="Image URL"
              name="image"
              value={values.image}
              error={errors.image}
              onChange={(e) => update('image', e.target.value)}
              placeholder="https://… or /uploads/…"
            />
            {values.image && isValidMediaRef(values.image) ? (
              <div className="cover-preview">
                <img src={resolveMediaUrl(values.image)} alt="Post preview" />
              </div>
            ) : null}
          </div>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={values.commentsEnabled}
              onChange={(e) => update('commentsEnabled', e.target.checked)}
            />
            <span>Allow comments — attendees can leave comments when this is on</span>
          </label>

          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" loading={loading || uploading}>
              {mode === 'create' ? 'Publish post' : 'Save changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
