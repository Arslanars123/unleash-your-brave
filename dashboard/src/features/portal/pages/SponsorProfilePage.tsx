import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
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

  const sponsorQuery = useQuery({
    queryKey: ['sponsors', 'me', user?.sponsorId],
    queryFn: () => sponsorsApi.getMe(),
    enabled: Boolean(user?.sponsorId),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: SponsorPayload) => sponsorsApi.update(user!.sponsorId!, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sponsors', 'me'] });
      toast.success('Sponsor profile saved');
      setModalOpen(false);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to save profile')),
  });

  if (sponsorQuery.isLoading) return <Spinner />;
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
            Update your brand details and offers. Only your linked sponsor profile is editable.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>Edit profile & offers</Button>
      </header>

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
            {sponsor.offers.length} {sponsor.offers.length === 1 ? 'offer' : 'offers'}
          </span>
          {sponsor.offers.length > 0 ? (
            <ul className="day-preview" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {sponsor.offers.map((offer) => (
                <li key={offer.id} style={{ marginTop: '0.5rem' }}>
                  <strong>Offer {offer.offerNumber}</strong>
                  <span className="muted">{offer.description}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </article>

      <SponsorFormModal
        open={modalOpen}
        mode="edit"
        initialSponsor={sponsor}
        loading={saveMutation.isPending}
        onClose={() => setModalOpen(false)}
        onSubmit={async (payload) => {
          await saveMutation.mutateAsync(payload);
        }}
      />
    </div>
  );
}
