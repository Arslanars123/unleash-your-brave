import type { Membership, PublicMembership } from './membership.types.js';

export function toPublicMembership(membership: Membership): PublicMembership {
  return {
    id: membership.id,
    eventId: membership.eventId,
    name: membership.name,
    valueLink: membership.valueLink,
    price: membership.price,
    description: membership.description,
    features: membership.features ?? [],
    paymentPlanNote: membership.paymentPlanNote ?? '',
    featured: Boolean(membership.featured),
    tierRank: membership.tierRank ?? 0,
    sortOrder: membership.sortOrder ?? 0,
    createdAt: membership.createdAt.toISOString(),
    updatedAt: membership.updatedAt.toISOString(),
  };
}
