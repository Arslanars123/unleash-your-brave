import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ImagePlus, Link2, Plus, Trash2, X } from 'lucide-react';
import { getApiErrorMessage } from '@/shared/api/client';
import { uploadImageFile } from '@/shared/lib/upload-image';
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
  /** Required when creating or editing offers — offers are event-specific. */
  eventId: string;
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
  eventId: '',
  offers: [],
};

function offersToRows(offers: PublicSponsor['offers']): OfferRow[] {
  return [...offers]
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
    }));
}

function sponsorToForm(sponsor: PublicSponsor, eventId = ''): SponsorFormValues {
  return {
    name: sponsor.name,
    email: sponsor.email,
    description: sponsor.description,
    image: sponsor.image,
    eventId: eventId || sponsor.eventId || '',
    offers: offersToRows(sponsor.offers),
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

  if (values.offers.length > 0 && !values.eventId) {
    errors.eventId = 'Select which event these offers belong to';
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
  const eventId = values.eventId.trim() || undefined;
  return {
    name: values.name.trim(),
    email: values.email.trim() || undefined,
    description: values.description.trim(),
    image: values.image.trim(),
    ...(eventId ? { eventId } : {}),
    // Only send offers when an event is selected — they are stored per event.
    ...(eventId
      ? {
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
        }
      : {}),
  };
}

export interface SponsorEventOption {
  id: string;
  label: string;
}

interface SponsorFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialSponsor?: PublicSponsor | null;
  /** Editions the user can attach offers to. */
  eventOptions?: SponsorEventOption[];
  /** Load offers for the selected event (edit mode). */
  loadOffersForEvent?: (eventId: string) => Promise<PublicSponsor['offers']>;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (payload: SponsorPayload) => Promise<void> | void;
}

export function SponsorFormModal({
  open,
  mode,
  initialSponsor,
  eventOptions = [],
  loadOffersForEvent,
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
  const [uploading, setUploading] = useState(false);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<
    Record<string, { file: File; preview: string }>
  >({});

  useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    setErrors({});
    setUploading(false);
    setLoadingOffers(false);
    setPendingFiles((prev) => {
      for (const item of Object.values(prev)) URL.revokeObjectURL(item.preview);
      return {};
    });
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

  async function handleEventChange(eventId: string) {
    if (!eventId) {
      setForm({ ...values, eventId: '', offers: [] });
      return;
    }
    if (!loadOffersForEvent) {
      setForm({ ...values, eventId, offers: [] });
      return;
    }
    setLoadingOffers(true);
    try {
      const offers = await loadOffersForEvent(eventId);
      setForm({ ...values, eventId, offers: offersToRows(offers) });
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to load offers for this event'));
      setForm({ ...values, eventId, offers: [] });
    } finally {
      setLoadingOffers(false);
    }
  }

  function updateOffer(index: number, patch: Partial<OfferRow>) {
    const offers = values.offers.map((offer, i) => (i === index ? { ...offer, ...patch } : offer));
    setForm({ ...values, offers });
  }

  function addOffer() {
    if (!values.eventId) {
      toast.error('Select an event before adding offers');
      setErrors((current) => ({ ...current, eventId: 'Select which event these offers belong to' }));
      return;
    }
    setForm({ ...values, offers: [...values.offers, emptyOffer()] });
  }

  function removeOffer(index: number) {
    const offer = values.offers[index];
    if (offer) {
      setPendingFiles((current) => {
        const next = { ...current };
        if (next[offer.key]) {
          URL.revokeObjectURL(next[offer.key]!.preview);
          delete next[offer.key];
        }
        return next;
      });
    }
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

  function selectImage(file: File | undefined, target: 'sponsor' | string) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    setPendingFiles((current) => {
      const next = { ...current };
      if (next[target]) URL.revokeObjectURL(next[target]!.preview);
      next[target] = { file, preview: URL.createObjectURL(file) };
      return next;
    });
    if (target === 'sponsor' && sponsorImageRef.current) sponsorImageRef.current.value = '';
    else if (offerImageRefs.current[target]) offerImageRefs.current[target]!.value = '';
  }

  function clearPending(target: string) {
    setPendingFiles((current) => {
      const next = { ...current };
      if (next[target]) {
        URL.revokeObjectURL(next[target]!.preview);
        delete next[target];
      }
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);

    let nextValues = { ...values, offers: values.offers.map((o) => ({ ...o, links: [...o.links] })) };
    const entries = Object.entries(pendingFiles);
    if (entries.length > 0) {
      setUploading(true);
      try {
        for (const [target, item] of entries) {
          const url = await uploadImageFile(item.file);
          if (target === 'sponsor') {
            nextValues = { ...nextValues, image: url };
          } else {
            nextValues = {
              ...nextValues,
              offers: nextValues.offers.map((offer) =>
                offer.key === target ? { ...offer, image: url } : offer,
              ),
            };
          }
        }
        for (const item of Object.values(pendingFiles)) URL.revokeObjectURL(item.preview);
        setPendingFiles({});
        setValues(nextValues);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : getApiErrorMessage(error, 'Unable to upload image'),
        );
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    const nextErrors = validate(nextValues);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    await onSubmit(toSponsorPayload(nextValues));
  }

  const busy = loading || uploading || loadingOffers;
  const sponsorPreview =
    pendingFiles.sponsor?.preview ||
    (values.image && isValidMediaRef(values.image) ? resolveMediaUrl(values.image) : '');

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
                onChange={(e) => selectImage(e.target.files?.[0], 'sponsor')}
              />
              <Button
                type="button"
                variant="secondary"
                loading={uploading}
                disabled={busy}
                onClick={() => sponsorImageRef.current?.click()}
              >
                <ImagePlus size={16} />
                {pendingFiles.sponsor ? 'Change image' : 'Choose image'}
              </Button>
              {values.image || pendingFiles.sponsor ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    clearPending('sponsor');
                    update('image', '');
                  }}
                >
                  Remove
                </Button>
              ) : null}
            </div>
            <Input
              label="Or paste image URL"
              name="image"
              value={pendingFiles.sponsor ? '' : values.image}
              error={errors.image}
              disabled={Boolean(pendingFiles.sponsor)}
              onChange={(e) => {
                clearPending('sponsor');
                update('image', e.target.value);
              }}
              placeholder="https://… or /uploads/…"
            />
            {sponsorPreview ? (
              <div className="cover-preview">
                <img src={sponsorPreview} alt="Sponsor preview" />
              </div>
            ) : null}
            <p className="hint">
              {pendingFiles.sponsor
                ? 'Photo selected — it will upload when you save.'
                : 'Photos upload when you save the form'}
            </p>
          </div>

          <fieldset className="schedule-fieldset">
            <legend>Sponsor offers</legend>
            <p className="hint">
              Offers are event-specific. Select an event, then add Offer 1, Offer 2… Attendees only
              see offers for the event they have selected.
            </p>

            <label className="field">
              <span className="field-label">
                Event for these offers{values.offers.length > 0 ? ' *' : ''}
              </span>
              <select
                className={`field-input${errors.eventId ? ' field-input-error' : ''}`}
                value={values.eventId}
                disabled={busy || eventOptions.length === 0}
                onChange={(e) => void handleEventChange(e.target.value)}
              >
                <option value="">
                  {eventOptions.length === 0
                    ? 'No events available — schedule or link an event first'
                    : 'Select an event…'}
                </option>
                {eventOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              {errors.eventId ? <span className="field-error">{errors.eventId}</span> : null}
            </label>

            {!values.eventId ? (
              <p className="muted">
                {mode === 'create'
                  ? 'Create the profile now, or select an event above to add offers immediately.'
                  : 'Select an event to view and edit offers for that edition.'}
              </p>
            ) : null}

            <div className="day-list">
              {values.offers.length === 0 ? (
                <p className="muted">
                  {values.eventId ? 'No offers for this event yet.' : 'No offers yet.'}
                </p>
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
                          onChange={(e) => selectImage(e.target.files?.[0], offer.key)}
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          loading={uploading}
                          disabled={busy}
                          onClick={() => offerImageRefs.current[offer.key]?.click()}
                        >
                          <ImagePlus size={14} />
                          {pendingFiles[offer.key] ? 'Change' : 'Choose'}
                        </Button>
                        {offer.image || pendingFiles[offer.key] ? (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                              clearPending(offer.key);
                              updateOffer(offerIndex, { image: '' });
                            }}
                          >
                            Remove
                          </Button>
                        ) : null}
                      </div>
                      <Input
                        label="Or paste image URL"
                        name={`offer-image-${offerIndex}`}
                        value={pendingFiles[offer.key] ? '' : offer.image}
                        error={errors[`offer-image-${offerIndex}`]}
                        disabled={Boolean(pendingFiles[offer.key])}
                        onChange={(e) => {
                          clearPending(offer.key);
                          updateOffer(offerIndex, { image: e.target.value });
                        }}
                        placeholder="https://…"
                      />
                      {pendingFiles[offer.key]?.preview ||
                      (offer.image && isValidMediaRef(offer.image)) ? (
                        <div className="speaker-photo-preview">
                          <img
                            src={
                              pendingFiles[offer.key]?.preview ||
                              resolveMediaUrl(offer.image)
                            }
                            alt=""
                          />
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
