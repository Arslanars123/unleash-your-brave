import type {
  PublicSponsor,
  PublicSponsorOffer,
  Sponsor,
  SponsorOffer,
} from './sponsor.types.js';

export function toPublicOffer(offer: SponsorOffer): PublicSponsorOffer {
  return {
    id: offer.id,
    offerNumber: offer.offerNumber,
    description: offer.description,
    image: offer.image,
    links: offer.links.map((link) => ({
      id: link.id,
      label: link.label,
      url: link.url,
    })),
  };
}

export function toPublicSponsor(sponsor: Sponsor): PublicSponsor {
  return {
    id: sponsor.id,
    eventId: sponsor.eventId,
    name: sponsor.name,
    description: sponsor.description,
    image: sponsor.image,
    offers: [...sponsor.offers]
      .sort((a, b) => a.offerNumber - b.offerNumber)
      .map(toPublicOffer),
    createdAt: sponsor.createdAt.toISOString(),
    updatedAt: sponsor.updatedAt.toISOString(),
  };
}
