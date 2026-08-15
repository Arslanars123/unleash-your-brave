import { useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { uploadsApi } from '@/features/uploads/api/uploads-api';
import { getApiErrorMessage } from '@/shared/api/client';
import { resolveMediaUrl } from '@/shared/lib/media';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { useToast } from '@/shared/ui/toast';

function isValidMediaRef(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (/^https?:\/\//i.test(v)) return true;
  if (v.startsWith('/uploads/')) return true;
  return false;
}

interface MediaImageFieldProps {
  label: string;
  value: string;
  error?: string;
  disabled?: boolean;
  onChange: (url: string) => void;
  hint?: string;
}

/**
 * Image field with upload OR paste-URL — same pattern as event cover.
 * Uploads go to S3 when the API has S3_BUCKET configured.
 */
export function MediaImageField({
  label,
  value,
  error,
  disabled = false,
  onChange,
  hint = 'JPEG, PNG, WebP, or GIF · max 5MB · stored in cloud storage',
}: MediaImageFieldProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be 5MB or smaller');
      return;
    }

    setUploading(true);
    try {
      const uploaded = await uploadsApi.uploadImage(file);
      onChange(uploaded.url);
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Unable to upload image'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="field media-image-field">
      <span className="field-label">{label}</span>
      <div className="media-image-actions">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          hidden
          onChange={(e) => void handleUpload(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="secondary"
          loading={uploading}
          disabled={disabled || uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus size={16} />
          Upload from device
        </Button>
        {value ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => onChange('')}
            disabled={uploading || disabled}
          >
            Remove
          </Button>
        ) : null}
      </div>
      <Input
        label="Or paste image URL"
        value={value}
        error={error}
        disabled={disabled || uploading}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://… or uploaded URL"
      />
      {value && isValidMediaRef(value) ? (
        <div className="cover-preview">
          <img src={resolveMediaUrl(value)} alt="" />
        </div>
      ) : null}
      <p className="hint">{hint}</p>
    </div>
  );
}

export { isValidMediaRef };
