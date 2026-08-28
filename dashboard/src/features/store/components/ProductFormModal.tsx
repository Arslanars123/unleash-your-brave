import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ImagePlus, Trash2, X } from 'lucide-react';
import { getApiErrorMessage } from '@/shared/api/client';
import { uploadImageFile } from '@/shared/lib/upload-image';
import { isValidMediaRef, resolveMediaUrl } from '@/shared/lib/media';
import type {
  PublicStoreCategory,
  PublicStoreProduct,
  StoreProductPayload,
} from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { TextArea } from '@/shared/ui/TextArea';
import { useToast } from '@/shared/ui/toast';

interface FormValues {
  name: string;
  description: string;
  categoryId: string;
  sku: string;
  price: string;
  compareAtPrice: string;
  currency: string;
  images: string[];
  stockQty: string;
  lowStockThreshold: string;
  isActive: boolean;
  featured: boolean;
  sortOrder: string;
}

type FieldErrors = Partial<Record<string, string>>;

const emptyForm: FormValues = {
  name: '',
  description: '',
  categoryId: '',
  sku: '',
  price: '',
  compareAtPrice: '',
  currency: 'USD',
  images: [],
  stockQty: '0',
  lowStockThreshold: '5',
  isActive: true,
  featured: false,
  sortOrder: '0',
};

function toForm(product: PublicStoreProduct): FormValues {
  return {
    name: product.name,
    description: product.description,
    categoryId: product.categoryId ?? '',
    sku: product.sku ?? '',
    price: String(product.price),
    compareAtPrice:
      product.compareAtPrice == null ? '' : String(product.compareAtPrice),
    currency: product.currency || 'USD',
    images: [...(product.images ?? [])],
    stockQty: String(product.stockQty ?? 0),
    lowStockThreshold: String(product.lowStockThreshold ?? 5),
    isActive: product.isActive,
    featured: product.featured,
    sortOrder: String(product.sortOrder ?? 0),
  };
}

function validate(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.name.trim() || values.name.trim().length < 2) {
    errors.name = 'Name is required (min 2 characters)';
  }
  const price = Number(values.price);
  if (!Number.isFinite(price) || price < 0) errors.price = 'Enter a valid price';
  if (values.compareAtPrice.trim()) {
    const compare = Number(values.compareAtPrice);
    if (!Number.isFinite(compare) || compare < 0) {
      errors.compareAtPrice = 'Enter a valid compare-at price';
    }
  }
  if (values.currency.trim().length !== 3) errors.currency = 'Use a 3-letter currency code';
  const stockQty = Number(values.stockQty);
  if (!Number.isFinite(stockQty) || stockQty < 0 || !Number.isInteger(stockQty)) {
    errors.stockQty = 'Enter a valid stock quantity';
  }
  if (values.images.length === 0) {
    errors.images = 'Add at least one product image';
  }
  values.images.forEach((image, index) => {
    if (!isValidMediaRef(image)) errors[`image-${index}`] = 'Invalid image URL';
  });
  return errors;
}

export function toProductPayload(values: FormValues): StoreProductPayload {
  return {
    name: values.name.trim(),
    description: values.description.trim(),
    categoryId: values.categoryId || null,
    sku: values.sku.trim(),
    price: Number(values.price),
    compareAtPrice: values.compareAtPrice.trim()
      ? Number(values.compareAtPrice)
      : null,
    currency: values.currency.trim().toUpperCase(),
    images: values.images,
    stockQty: Number(values.stockQty) || 0,
    lowStockThreshold: Number(values.lowStockThreshold) || 0,
    isActive: values.isActive,
    featured: values.featured,
    sortOrder: Number(values.sortOrder) || 0,
  };
}

interface ProductFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initial?: PublicStoreProduct | null;
  categories: PublicStoreCategory[];
  loading?: boolean;
  onClose: () => void;
  onSubmit: (payload: StoreProductPayload) => Promise<void> | void;
}

export function ProductFormModal({
  open,
  mode,
  initial,
  categories,
  loading = false,
  onClose,
  onSubmit,
}: ProductFormModalProps) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [values, setValues] = useState<FormValues>(emptyForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingImages, setPendingImages] = useState<
    Array<{ key: string; file: File; preview: string }>
  >([]);

  useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    setErrors({});
    setUploading(false);
    setPendingImages((prev) => {
      for (const item of prev) URL.revokeObjectURL(item.preview);
      return [];
    });
    setValues(initial ? toForm(initial) : emptyForm);
  }, [open, initial]);

  if (!open) return null;

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    const next = { ...values, [key]: value };
    setValues(next);
    if (submitted) setErrors(validate(next));
  }

  function handleSelect(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    if (values.images.length + pendingImages.length >= 12) {
      toast.error('Maximum 12 images per product');
      return;
    }
    const preview = URL.createObjectURL(file);
    setPendingImages((current) => [
      ...current,
      { key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, file, preview },
    ]);
    if (errors.images) {
      setErrors((current) => {
        const next = { ...current };
        delete next.images;
        return next;
      });
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  function removePending(key: string) {
    setPendingImages((current) => {
      const target = current.find((item) => item.key === key);
      if (target) URL.revokeObjectURL(target.preview);
      return current.filter((item) => item.key !== key);
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);

    if (values.images.length === 0 && pendingImages.length === 0) {
      setErrors({ ...validate(values), images: 'Add at least one product image' });
      return;
    }

    let images = [...values.images];
    if (pendingImages.length > 0) {
      setUploading(true);
      try {
        for (const item of pendingImages) {
          images.push(await uploadImageFile(item.file));
        }
        for (const item of pendingImages) URL.revokeObjectURL(item.preview);
        setPendingImages([]);
        update('images', images);
      } catch (error) {
        toast.error(getApiErrorMessage(error, 'Unable to upload image'));
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    const nextValues = { ...values, images };
    const nextErrors = validate(nextValues);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    await onSubmit(toProductPayload(nextValues));
  }

  const busy = loading || uploading;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel modal-panel-wide"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2>{mode === 'create' ? 'Create product' : 'Edit product'}</h2>
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
            placeholder="Event tote bag"
          />
          <TextArea
            label="Description"
            value={values.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Product details, materials, sizing..."
          />
          <label className="field">
            <span className="field-label">Category</span>
            <select
              className="field-input"
              value={values.categoryId}
              onChange={(e) => update('categoryId', e.target.value)}
            >
              <option value="">Uncategorized</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <div className="schedule-grid">
            <Input
              label="Price"
              requiredMark
              type="number"
              step="0.01"
              min="0"
              value={values.price}
              error={errors.price}
              onChange={(e) => update('price', e.target.value)}
            />
            <Input
              label="Compare-at price"
              type="number"
              step="0.01"
              min="0"
              value={values.compareAtPrice}
              error={errors.compareAtPrice}
              onChange={(e) => update('compareAtPrice', e.target.value)}
              placeholder="Optional original price"
            />
            <Input
              label="Currency"
              value={values.currency}
              error={errors.currency}
              onChange={(e) => update('currency', e.target.value)}
              maxLength={3}
            />
          </div>
          <div className="schedule-grid">
            <Input
              label="SKU"
              value={values.sku}
              onChange={(e) => update('sku', e.target.value)}
              placeholder="TOTE-001"
            />
            <Input
              label="Sort order"
              type="number"
              value={values.sortOrder}
              onChange={(e) => update('sortOrder', e.target.value)}
            />
          </div>

          <fieldset className="schedule-fieldset">
            <legend>Inventory</legend>
            <div className="schedule-grid">
              <Input
                label="Stock quantity"
                type="number"
                min="0"
                value={values.stockQty}
                error={errors.stockQty}
                onChange={(e) => update('stockQty', e.target.value)}
              />
              <Input
                label="Low-stock threshold"
                type="number"
                min="0"
                value={values.lowStockThreshold}
                onChange={(e) => update('lowStockThreshold', e.target.value)}
              />
            </div>
          </fieldset>

          <fieldset className="schedule-fieldset">
            <legend>
              Images <span className="required-mark">*</span>
            </legend>
            <div className="day-list">
              {values.images.length === 0 && pendingImages.length === 0 ? (
                <p className="muted">Add at least one product image.</p>
              ) : (
                <>
                  {values.images.map((image, index) => (
                    <div key={`${image}-${index}`} className="material-row">
                      <img
                        src={resolveMediaUrl(image)}
                        alt=""
                        style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }}
                      />
                      <Input
                        label={`Image ${index + 1}`}
                        value={image}
                        error={errors[`image-${index}`]}
                        onChange={(e) => {
                          const images = [...values.images];
                          images[index] = e.target.value;
                          update('images', images);
                        }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          update(
                            'images',
                            values.images.filter((_, i) => i !== index),
                          )
                        }
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  ))}
                  {pendingImages.map((item) => (
                    <div key={item.key} className="material-row">
                      <img
                        src={item.preview}
                        alt=""
                        style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }}
                      />
                      <p className="hint" style={{ margin: 0 }}>
                        Pending upload
                      </p>
                      <Button type="button" variant="ghost" onClick={() => removePending(item.key)}>
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  ))}
                </>
              )}
            </div>
            <div className="toolbar" style={{ marginTop: 8 }}>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => handleSelect(e.target.files?.[0])}
              />
              <Button
                type="button"
                variant="secondary"
                loading={uploading}
                disabled={busy || values.images.length + pendingImages.length >= 12}
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus size={14} />
                Choose image
              </Button>
              <p className="hint">Images upload when you save the product</p>
            </div>
            {errors.images ? <p className="form-error">{errors.images}</p> : null}
          </fieldset>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={values.featured}
              onChange={(e) => update('featured', e.target.checked)}
            />
            Featured on store home
          </label>
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
              {mode === 'create' ? 'Create product' : 'Save changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
