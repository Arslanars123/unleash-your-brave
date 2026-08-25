export interface SponsorOfferLink {
  id: string;
  label: string;
  url: string;
}

export interface SponsorOffer {
  id: string;
  /** 1-based display order (Offer 1, Offer 2, …). */
  offerNumber: number;
  description: string;
  image: string;
  links: SponsorOfferLink[];
}

export interface PublicSponsorOfferLink {
  id: string;
  label: string;
  url: string;
}

export interface PublicSponsorOffer {
  id: string;
  offerNumber: number;
  description: string;
  image: string;
  links: PublicSponsorOfferLink[];
}

export interface SponsorOfferLinkInput {
  id?: string;
  label?: string;
  url: string;
}

export interface SponsorOfferInput {
  id?: string;
  offerNumber?: number;
  description: string;
  image?: string;
  links?: SponsorOfferLinkInput[];
}

export interface Sponsor {
  id: string;
  eventId: string;
  name: string;
  /** Portal login email (optional; linked user account when set). */
  email: string;
  description: string;
  image: string;
  offers: SponsorOffer[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicSponsor {
  id: string;
  eventId: string;
  name: string;
  email: string;
  description: string;
  image: string;
  offers: PublicSponsorOffer[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateSponsorInput {
  eventId?: string;
  name: string;
  email?: string;
  description?: string;
  image?: string;
  offers?: SponsorOfferInput[];
}

export interface UpdateSponsorInput {
  name?: string;
  email?: string;
  description?: string;
  image?: string;
  offers?: SponsorOfferInput[];
}

export interface ListSponsorsQuery {
  page: number;
  perPage: number;
  search?: string;
  eventId?: string;
}
