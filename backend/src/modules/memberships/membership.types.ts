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
  /**
   * When true, holders may access future event editions (content + QR)
   * without purchasing again, subject to event access settings / tier mapping.
   */
  validForFutureEvents: boolean;
  /**
   * Optional next upgrade target on the same event.
   * When set, the app only offers this membership as the upgrade option.
   */
  upgradeToMembershipId: string | null;
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
  validForFutureEvents: boolean;
  upgradeToMembershipId: string | null;
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
  validForFutureEvents?: boolean;
  upgradeToMembershipId?: string | null;
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
  validForFutureEvents?: boolean;
  upgradeToMembershipId?: string | null;
}

export interface ListMembershipsQuery {
  page: number;
  perPage: number;
  search?: string;
  eventId?: string;
}
