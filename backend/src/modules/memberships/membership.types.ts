export interface Membership {
  id: string;
  eventId: string;
  name: string;
  valueLink: string;
  price: number;
  description: string;
  /** Bullet features shown on the marketing site. */
  features: string[];
  /** e.g. "or 3 payments of $275" */
  paymentPlanNote: string;
  /** Highlight card styling on the marketing site. */
  featured: boolean;
  /**
   * Upgrade hierarchy for the event (higher = better).
   * Gold=1, Diamond=2, Diamond Plus=3. When 0, price is used instead.
   */
  tierRank: number;
  /** Lower sorts first in catalog / website. */
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicMembership {
  id: string;
  eventId: string;
  name: string;
  valueLink: string;
  price: number;
  description: string;
  features: string[];
  paymentPlanNote: string;
  featured: boolean;
  tierRank: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMembershipInput {
  eventId: string;
  name: string;
  valueLink?: string;
  price?: number;
  description?: string;
  features?: string[];
  paymentPlanNote?: string;
  featured?: boolean;
  tierRank?: number;
  sortOrder?: number;
}

export interface UpdateMembershipInput {
  name?: string;
  valueLink?: string;
  price?: number;
  description?: string;
  features?: string[];
  paymentPlanNote?: string;
  featured?: boolean;
  tierRank?: number;
  sortOrder?: number;
}

export interface ListMembershipsQuery {
  page: number;
  perPage: number;
  search?: string;
  eventId?: string;
}
