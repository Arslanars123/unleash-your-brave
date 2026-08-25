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
   * When true, holders may access future event editions’ app content
   * without purchasing again, subject to event access settings / tier mapping.
   * Does not grant a check-in QR by itself — see `validForFutureQr`.
   */
  validForFutureEvents: boolean;
  /**
   * When true, holders may receive a check-in QR on future event editions
   * without purchasing again. Independent of content carry-over.
   * Still requires an active (non-expired) membership entitlement.
   */
  validForFutureQr: boolean;
  /**
   * `one_time` — event pass with no renewal cycle.
   * `renewable` — membership expires after `durationDays` and must be renewed.
   */
  billingKind: 'one_time' | 'renewable';
  /**
   * Length of each paid period in days when `billingKind` is `renewable`.
   * Ignored for one-time memberships (use 0).
   */
  durationDays: number;
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
  validForFutureQr: boolean;
  billingKind: 'one_time' | 'renewable';
  durationDays: number;
  upgradeToMembershipId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMembershipInput {
  eventId?: string;
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
  validForFutureQr?: boolean;
  billingKind?: 'one_time' | 'renewable';
  durationDays?: number;
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
  validForFutureQr?: boolean;
  billingKind?: 'one_time' | 'renewable';
  durationDays?: number;
  upgradeToMembershipId?: string | null;
}

export interface ListMembershipsQuery {
  page: number;
  perPage: number;
  search?: string;
  eventId?: string;
}
