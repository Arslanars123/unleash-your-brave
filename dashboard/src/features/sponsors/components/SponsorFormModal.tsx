import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ImagePlus, Link2, Plus, Trash2, X } from 'lucide-react';
import { uploadsApi } from '@/features/uploads/api/uploads-api';
import { getApiErrorMessage } from '@/shared/api/client';
import { prepareImageForUpload } from '@/shared/lib/compress-image';
import { isValidMediaRef, resolveMediaUrl } from '@/shared/lib/media';
import type { PublicSponsor, SponsorPayload } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { TextArea } from '@/shared/ui/TextArea';
import { useToast } from '@/shared/ui/toast';

interface LinkRow {
  key: string;
  label: string;
  url: string;
}

interface OfferRow {
  key: string;
  description: string;
  image: string;
  links: LinkRow[];
}

export interface SponsorFormValues {
  name: string;
  email: string;
  description: string;
  image: string;
  offers: OfferRow[];
}

type FieldErrors = Partial<Record<string, string>>;

function newKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyLink(): LinkRow {
  return { key: newKey(), label: '', url: '' };
}

function emptyOffer(): OfferRow {
  return { key: newKey(), description: '', image: '', links: [] };
}

const emptyForm: SponsorFormValues = {
  name: '',
  email: '',
  description: '',
  image: '',
  offers: [],
};

function sponsorToForm(sponsor: PublicSponsor): SponsorFormValues {
  return {
    name: sponsor.name,
    email: sponsor.email,
    description: sponsor.description,
    image: sponsor.image,
    offers: [...sponsor.offers]
      .sort((a, b) => a.offerNumber - b.offerNumber)
      .map((offer) => ({
        key: offer.id || newKey(),
        description: offer.description,
        image: offer.image,
        links: offer.links.map((link) => ({
          key: link.id || newKey(),
          label: link.label,
          url: link.url,
        })),
      })),
  };
}

function validate(values: SponsorFormValues): FieldErrors {
  const errors: FieldErrors = {};

  if (!values.name.trim()) errors.name = 'Sponsor name is required';
  else if (values.name.trim().length < 2) errors.name = 'Name must be at least 2 characters';

  if (values.image.trim() && !isValidMediaRef(values.image.trim())) {
    errors.image = 'Use a valid URL or upload an image';
  }

  const email = values.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Enter a valid email address';
  }

  values.offers.forEach((offer, offerIndex) => {
    if (!offer.description.trim()) {
      errors[`offer-desc-${offerIndex}`] = 'Offer description is required';
    }
    if (offer.image.trim() && !isValidMediaRef(offer.image.trim())) {
      errors[`offer-image-${offerIndex}`] = 'Use a valid URL or upload an image';
    }
    offer.links.forEach((link, linkIndex) => {
      if (!link.url.trim()) {
        errors[`offer-${offerIndex}-link-${linkIndex}`] = 'Link URL is required';
      } else if (!isValidMediaRef(link.url.trim())) {
        errors[`offer-${offerIndex}-link-${linkIndex}`] = 'Enter a valid URL';
      }
    });
  });

  return errors;
}

export function toSponsorPayload(values: SponsorFormValues): SponsorPayload {
  return {
    name: values.name.trim(),
    email: values.email.trim() || undefined,
    description: values.description.trim(),
    image: values.image.trim(),
    offers: values.offers.map((offer, index) => ({
      offerNumber: index + 1,
      description: offer.description.trim(),
      image: offer.image.trim(),
      links: offer.links
        .filter((link) => link.url.trim())
        .map((link) => ({
          label: link.label.trim(),
          url: link.url.trim(),
        })),
    })),
  };
}

interface SponsorFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialSponsor?: PublicSponsor | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (payload: SponsorPayload) => Promise<void> | void;
}

export function SponsorFormModal({
  open,
  mode,
  initialSponsor,
  loading = false,
  onClose,
  onSubmit,
}: SponsorFormModalProps) {
  const toast = useToast();
  const sponsorImageRef = useRef<HTMLInputElement>(null);
  const offerImageRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [values, setValues] = useState<SponsorFormValues>(emptyForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    setErrors({});
    setUploading(null);
    setValues(initialSponsor ? sponsorToForm(initialSponsor) : emptyForm);
  }, [open, initialSponsor]);

  if (!open) return null;

  function setForm(next: SponsorFormValues) {
    setValues(next);
    if (submitted) setErrors(validate(next));
  }

  function update<K extends keyof SponsorFormValues>(key: K, value: SponsorFormValues[K]) {
    setForm({ ...values, [key]: value });
  }

  function updateOffer(index: number, patch: Partial<OfferRow>) {
    const offers = values.offers.map((offer, i) => (i === index ? { ...offer, ...patch } : offer));
    setForm({ ...values, offers });
  }

  function addOffer() {
    setForm({ ...values, offers: [...values.offers, emptyOffer()] });
  }

  function removeOffer(index: number) {
    setForm({ ...values, offers: values.offers.filter((_, i) => i !== index) });
  }

  function updateLink(offerIndex: number, linkIndex: number, patch: Partial<LinkRow>) {
    const offers = values.offers.map((offer, i) => {
      if (i !== offerIndex) return offer;
      return {
        ...offer,
        links: offer.links.map((link, j) => (j === linkIndex ? { ...link, ...patch } : link)),
      };
    });
    setForm({ ...values, offers });
  }

  function addLink(offerIndex: number) {
    const offers = values.offers.map((offer, i) =>
      i === offerIndex ? { ...offer, links: [...offer.links, emptyLink()] } : offer,
    );
    setForm({ ...values, offers });
  }

  function removeLink(offerIndex: number, linkIndex: number) {
    const offers = values.offers.map((offer, i) =>
      i === offerIndex
        ? { ...offer, links: offer.links.filter((_, j) => j !== linkIndex) }
        : offer,
    );
    setForm({ ...values, offers });
  }

  async function uploadImage(file: File | undefined, target: 'sponsor' | string) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }

    setUploading(target);
    try {
      const prepared = await prepareImageForUpload(file);
      const uploaded = await uploadsApi.uploadImage(prepared);
      if (target === 'sponsor') {
        update('image', uploaded.url);
      } else {
        const index = values.offers.findIndex((offer) => offer.key === target);
        if (index >= 0) updateOffer(index, { image: uploaded.url });
      }
      toast.success('Image uploaded');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : getApiErrorMessage(error, 'Unable to upload image'),
      );
    } finally {
      setUploading(null);
      if (target === 'sponsor' && sponsorImageRef.current) sponsorImageRef.current.value = '';
      else if (offerImageRefs.current[target]) offerImageRefs.current[target]!.value = '';
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    await onSubmit(toSponsorPayload(values));
  }

  const busy = loading || uploading !== null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel modal-panel-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sponsor-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="sponsor-form-title">{mode === 'create' ? 'Create Sponsor' : 'Edit Sponsor'}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <form className="modal-body event-form" onSubmit={handleSubmit} noValidate>
          <Input
            label="Sponsor name"
            requiredMark
            name="name"
            value={values.name}
            error={errors.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Brave Collective"
          />
          <Input
            label="Portal email"
            name="email"
            type="email"
            value={values.email}
            error={errors.email}
            onChange={(e) => update('email', e.target.value)}
            placeholder="sponsor@example.com"
          />
          <p className="hint">Optional. Sends a login invite when creating or updating.</p>
          <TextArea
            label="Description"
            name="description"
            value={values.description}
            error={errors.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Who this sponsor is and why they partner with the event..."
          />

          <div className="cover-field">
            <span className="field-label">Sponsor image</span>
            <div className="cover-actions">
              <input
                ref={sponsorImageRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                hidden
                onChange={(e) => void uploadImage(e.target.files?.[0], 'sponsor')}
              />
              <Button
                type="button"
                variant="secondary"
                loading={uploading === 'sponsor'}
                disabled={busy}
                onClick={() => sponsorImageRef.current?.click()}
              >
                <ImagePlus size={16} />
                Upload image
              </Button>
              {values.image ? (
                <Button type="button" variant="ghost" onClick={() => update('image', '')}>
                  Remove
                </Button>
              ) : null}
            </div>
            <Input
              label="Or paste image URL"
              name="image"
              value={values.image}
              error={errors.image}
              onChange={(e) => update('image', e.target.value)}
              placeholder="https://… or /uploads/…"
            />
            {values.image && isValidMediaRef(values.image) ? (
              <div className="cover-preview">
                <img src={resolveMediaUrl(values.image)} alt="Sponsor preview" />
              </div>
            ) : null}
          </div>

          <fieldset className="schedule-fieldset">
            <legend>Sponsor offers</legend>
            <p className="hint">
              Add Offer 1, Offer 2, Offer 3… Each offer needs a description. Image and links are
              optional.
            </p>

            <div className="day-list">
              {values.offers.length === 0 ? (
                <p className="muted">No offers yet.</p>
              ) : (
                values.offers.map((offer, offerIndex) => (
                  <div className="material-row" key={offer.key}>
                    <div className="offer-header">
                      <strong>Offer {offerIndex + 1}</strong>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => removeOffer(offerIndex)}
                        aria-label={`Remove offer ${offerIndex + 1}`}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>

                    <TextArea
                      label="Description"
                      requiredMark
                      name={`offer-desc-${offerIndex}`}
                      value={offer.description}
                      error={errors[`offer-desc-${offerIndex}`]}
                      onChange={(e) => updateOffer(offerIndex, { description: e.target.value })}
                      placeholder="What attendees get with this offer..."
                    />

                    <div className="cover-field">
                      <span className="field-label">Offer image (optional)</span>
                      <div className="cover-actions">
                        <input
                          ref={(el) => {
                            offerImageRefs.current[offer.key] = el;
                          }}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          hidden
                          onChange={(e) =>
                            void uploadImage(e.target.files?.[0], offer.key)
                          }
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          loading={uploading === offer.key}
                          disabled={busy}
                          onClick={() => offerImageRefs.current[offer.key]?.click()}
                        >
                          <ImagePlus size={14} />
                          Upload
                        </Button>
                        {offer.image ? (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => updateOffer(offerIndex, { image: '' })}
                          >
                            Remove
                          </Button>
                        ) : null}
                      </div>
                      <Input
                        label="Or paste image URL"
                        name={`offer-image-${offerIndex}`}
                        value={offer.image}
                        error={errors[`offer-image-${offerIndex}`]}
                        onChange={(e) => updateOffer(offerIndex, { image: e.target.value })}
                        placeholder="https://…"
                      />
                      {offer.image && isValidMediaRef(offer.image) ? (
                        <div className="speaker-photo-preview">
                          <img src={resolveMediaUrl(offer.image)} alt="" />
                        </div>
                      ) : null}
                    </div>

                    <div className="offer-links">
                      <span className="field-label">Links (optional)</span>
                      {offer.links.map((link, linkIndex) => (
                        <div className="offer-link-row" key={link.key}>
                          <Input
                            label="Label"
                            name={`offer-${offerIndex}-label-${linkIndex}`}
                            value={link.label}
                            onChange={(e) =>
                              updateLink(offerIndex, linkIndex, { label: e.target.value })
                            }
                            placeholder="Claim offer"
                          />
                          <Input
                            label="URL"
                            name={`offer-${offerIndex}-url-${linkIndex}`}
                            value={link.url}
                            error={errors[`offer-${offerIndex}-link-${linkIndex}`]}
                            onChange={(e) =>
                              updateLink(offerIndex, linkIndex, { url: e.target.value })
                            }
                            placeholder="https://…"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            className="day-remove"
                            onClick={() => removeLink(offerIndex, linkIndex)}
                            aria-label="Remove link"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => addLink(offerIndex)}
                      >
                        <Link2 size={14} />
                        Add link
                      </Button>
                    </div>
                  </div>
                ))
              )}

              <Button type="button" variant="secondary" onClick={addOffer} disabled={busy}>
                <Plus size={16} />
                Add offer {values.offers.length + 1}
              </Button>
            </div>
          </fieldset>

          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              {mode === 'create' ? 'Create sponsor' : 'Save changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
