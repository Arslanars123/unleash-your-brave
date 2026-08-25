import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useAuth } from '@/features/auth/context/AuthProvider';
import { sponsorsApi } from '@/features/sponsors/api/sponsors-api';
import { SponsorFormModal } from '@/features/sponsors/components/SponsorFormModal';
import { getApiErrorMessage } from '@/shared/api/client';
import { resolveMediaUrl } from '@/shared/lib/media';
import type { SponsorPayload } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

export function SponsorProfilePage() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [previewEventId, setPreviewEventId] = useState('');

  const sponsorQuery = useQuery({
    queryKey: ['sponsors', 'me', user?.sponsorId, previewEventId || 'profile'],
    queryFn: () => sponsorsApi.getMe(previewEventId ? { eventId: previewEventId } : {}),
    enabled: Boolean(user?.sponsorId),
  });

  const linkedEventsQuery = useQuery({
    queryKey: ['sponsors', 'me', 'events', user?.sponsorId],
    queryFn: () => sponsorsApi.listMyEvents(),
    enabled: Boolean(user?.sponsorId),
  });

  const eventOptions = useMemo(
    () =>
      (linkedEventsQuery.data ?? []).map((event) => ({
        id: event.id,
        label: `${event.name} · ${new Date(event.startDate).toLocaleDateString()} (${event.offerCount} offers)`,
      })),
    [linkedEventsQuery.data],
  );

  const saveMutation = useMutation({
    mutationFn: (payload: SponsorPayload) => sponsorsApi.update(user!.sponsorId!, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['sponsors', 'me'] }),
        queryClient.invalidateQueries({ queryKey: ['sponsors', 'library'] }),
      ]);
      toast.success('Sponsor profile saved');
      setModalOpen(false);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to save profile')),
  });

  if (sponsorQuery.isLoading || linkedEventsQuery.isLoading) return <Spinner />;
  if (sponsorQuery.isError) {
    return <p className="form-error">{getApiErrorMessage(sponsorQuery.error)}</p>;
  }

  const sponsor = sponsorQuery.data!;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>My sponsor profile</h1>
          <p className="muted">
            Update your brand details anytime. Offers are event-specific — select an event when
            adding or editing offers.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>Edit profile & offers</Button>
      </header>

      <label className="field" style={{ maxWidth: 420, marginBottom: '1rem' }}>
        <span className="field-label">Preview offers for event</span>
        <select
          className="field-input"
          value={previewEventId}
          onChange={(e) => setPreviewEventId(e.target.value)}
        >
          <option value="">Profile only (no event offers)</option>
          {eventOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <article className="event-single-card" style={{ gridTemplateColumns: '140px 1fr' }}>
        <div className="event-single-media" style={{ minHeight: 140 }}>
          {sponsor.image ? (
            <img
              src={resolveMediaUrl(sponsor.image)}
              alt=""
              style={{ minHeight: 140, objectFit: 'cover' }}
            />
          ) : (
            <div className="event-single-media-fallback" style={{ minHeight: 140 }}>
              {sponsor.name.charAt(0)}
            </div>
          )}
        </div>
        <div className="event-single-body">
          <h2>{sponsor.name}</h2>
          {sponsor.description ? <p className="muted">{sponsor.description}</p> : null}
          <span className="badge role-member">
            {previewEventId
              ? `${sponsor.offers.length} ${sponsor.offers.length === 1 ? 'offer' : 'offers'} for this event`
              : 'Offers are managed per event'}
          </span>
          {previewEventId && sponsor.offers.length > 0 ? (
            <ul className="day-preview" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {sponsor.offers.map((offer) => (
                <li key={offer.id} style={{ marginTop: '0.5rem' }}>
                  <strong>Offer {offer.offerNumber}</strong>
                  <span className="muted">{offer.description}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {!previewEventId && eventOptions.length === 0 ? (
            <p className="muted" style={{ marginTop: '0.75rem' }}>
              You are not linked to an event yet. Ask an admin to associate your sponsor profile with
              an edition, then you can add offers for that event.
            </p>
          ) : null}
        </div>
      </article>

      <SponsorFormModal
        open={modalOpen}
        mode="edit"
        initialSponsor={sponsor}
        eventOptions={eventOptions}
        loadOffersForEvent={async (eventId) => {
          const scoped = await sponsorsApi.getMe({ eventId });
          return scoped.offers;
        }}
        loading={saveMutation.isPending}
        onClose={() => setModalOpen(false)}
        onSubmit={async (payload) => {
          await saveMutation.mutateAsync(payload);
        }}
      />
    </div>
  );
}
