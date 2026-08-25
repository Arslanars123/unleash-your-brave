import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { ImagePlus } from 'lucide-react';
import { uploadsApi } from '@/features/uploads/api/uploads-api';
import { getApiErrorMessage } from '@/shared/api/client';
import { prepareImageForUpload } from '@/shared/lib/compress-image';
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

export type MediaImageFieldHandle = {
  /** Upload a pending local file if needed, then return the final URL. */
  commit: () => Promise<string>;
  hasPendingFile: () => boolean;
};

/**
 * Image field with local file pick OR paste-URL.
 * Files are held locally and uploaded only when `commit()` runs (on form submit).
 */
export const MediaImageField = forwardRef<MediaImageFieldHandle, MediaImageFieldProps>(
  function MediaImageField(
    {
      label,
      value,
      error,
      disabled = false,
      onChange,
      hint = 'Photo is uploaded when you save the form',
    },
    ref,
  ) {
    const toast = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [localPreview, setLocalPreview] = useState<string | null>(null);
    const [committing, setCommitting] = useState(false);

    useEffect(() => {
      return () => {
        if (localPreview) URL.revokeObjectURL(localPreview);
      };
    }, [localPreview]);

    useImperativeHandle(ref, () => ({
      hasPendingFile: () => pendingFile !== null,
      commit: async () => {
        if (!pendingFile) return value.trim();

        setCommitting(true);
        try {
          const prepared = await prepareImageForUpload(pendingFile);
          const uploaded = await uploadsApi.uploadImage(prepared);
          onChange(uploaded.url);
          if (localPreview) URL.revokeObjectURL(localPreview);
          setPendingFile(null);
          setLocalPreview(null);
          return uploaded.url;
        } catch (err) {
          const message =
            err instanceof Error
              ? err.message
              : getApiErrorMessage(err, 'Unable to upload image');
          toast.error(message);
          throw err instanceof Error ? err : new Error(message);
        } finally {
          setCommitting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
    }));

    function clearPending() {
      if (localPreview) URL.revokeObjectURL(localPreview);
      setPendingFile(null);
      setLocalPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }

    function handleFileSelect(file: File | undefined) {
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        toast.error('Please choose an image file');
        return;
      }
      if (localPreview) URL.revokeObjectURL(localPreview);
      setPendingFile(file);
      setLocalPreview(URL.createObjectURL(file));
    }

    function handleRemove() {
      clearPending();
      onChange('');
    }

    function handleUrlChange(next: string) {
      clearPending();
      onChange(next);
    }

    const previewSrc = localPreview
      ? localPreview
      : value && isValidMediaRef(value)
        ? resolveMediaUrl(value)
        : '';

    return (
      <div className="field media-image-field">
        <span className="field-label">{label}</span>
        <div className="media-image-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
            hidden
            onChange={(e) => handleFileSelect(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="secondary"
            loading={committing}
            disabled={disabled || committing}
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus size={16} />
            {pendingFile ? 'Change photo' : 'Choose from device'}
          </Button>
          {value || pendingFile ? (
            <Button
              type="button"
              variant="ghost"
              onClick={handleRemove}
              disabled={committing || disabled}
            >
              Remove
            </Button>
          ) : null}
        </div>
        <Input
          label="Or paste image URL"
          value={pendingFile ? '' : value}
          error={error}
          disabled={disabled || committing || Boolean(pendingFile)}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder="https://… or uploaded URL"
        />
        {previewSrc ? (
          <div className="cover-preview">
            <img src={previewSrc} alt="" />
          </div>
        ) : null}
        <p className="hint">
          {pendingFile ? 'Photo selected — it will upload when you save.' : hint}
        </p>
      </div>
    );
  },
);

export { isValidMediaRef };
