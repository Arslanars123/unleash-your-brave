import { NotFoundError } from '../../core/errors/app-error.js';
import type { EventService } from '../events/event.service.js';
import { toPublicMembership } from './membership.mapper.js';
import type { PaginatedResult, MembershipRepository } from './membership.repository.js';
import type {
  CreateMembershipInput,
  ListMembershipsQuery,
  Membership,
  PublicMembership,
  UpdateMembershipInput,
} from './membership.types.js';

export class MembershipService {
  constructor(
    private readonly memberships: MembershipRepository,
    private readonly events: EventService,
  ) {}

  async list(query: ListMembershipsQuery): Promise<PaginatedResult<PublicMembership>> {
    const { items, total } = await this.memberships.list(query);
    return { items: items.map(toPublicMembership), total };
  }

  async getById(id: string): Promise<PublicMembership> {
    return toPublicMembership(await this.requireMembership(id));
  }

  async create(input: CreateMembershipInput): Promise<PublicMembership> {
    await this.events.requireEvent(input.eventId);

    const created = await this.memberships.create({
      eventId: input.eventId,
      name: input.name,
      valueLink: input.valueLink ?? '',
      price: input.price ?? 0,
      description: input.description ?? '',
      features: input.features ?? [],
      paymentPlanNote: input.paymentPlanNote ?? '',
      featured: input.featured ?? false,
      tierRank: input.tierRank ?? 0,
      sortOrder: input.sortOrder ?? 0,
      validForFutureEvents: input.validForFutureEvents ?? false,
      validForFutureQr: input.validForFutureQr ?? false,
      billingKind: input.billingKind ?? 'one_time',
      durationDays:
        input.billingKind === 'renewable'
          ? Math.max(1, input.durationDays ?? 365)
          : Math.max(0, input.durationDays ?? 0),
      upgradeToMembershipId: input.upgradeToMembershipId ?? null,
    });
    return toPublicMembership(created);
  }

  async update(id: string, input: UpdateMembershipInput): Promise<PublicMembership> {
    await this.requireMembership(id);

    const updated = await this.memberships.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.valueLink !== undefined ? { valueLink: input.valueLink } : {}),
      ...(input.price !== undefined ? { price: input.price } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.features !== undefined ? { features: input.features } : {}),
      ...(input.paymentPlanNote !== undefined
        ? { paymentPlanNote: input.paymentPlanNote }
        : {}),
      ...(input.featured !== undefined ? { featured: input.featured } : {}),
      ...(input.tierRank !== undefined ? { tierRank: input.tierRank } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.validForFutureEvents !== undefined
        ? { validForFutureEvents: input.validForFutureEvents }
        : {}),
      ...(input.validForFutureQr !== undefined
        ? { validForFutureQr: input.validForFutureQr }
        : {}),
      ...(input.billingKind !== undefined ? { billingKind: input.billingKind } : {}),
      ...(input.durationDays !== undefined ? { durationDays: input.durationDays } : {}),
      ...(input.upgradeToMembershipId !== undefined
        ? { upgradeToMembershipId: input.upgradeToMembershipId }
        : {}),
    });

    if (!updated) throw new NotFoundError('Membership');
    return toPublicMembership(updated);
  }

  async delete(id: string): Promise<void> {
    if (!(await this.memberships.delete(id))) {
      throw new NotFoundError('Membership');
    }
  }

  async requireMembership(id: string): Promise<Membership> {
    const membership = await this.memberships.findById(id);
    if (!membership) throw new NotFoundError('Membership');
    return membership;
  }

  async assertMembershipsForEvent(membershipIds: string[], eventId: string): Promise<void> {
    for (const membershipId of membershipIds) {
      const membership = await this.memberships.findById(membershipId);
      if (!membership) {
        throw new NotFoundError('Membership');
      }
      if (membership.eventId !== eventId) {
        throw new NotFoundError('Membership');
      }
    }
  }
}
