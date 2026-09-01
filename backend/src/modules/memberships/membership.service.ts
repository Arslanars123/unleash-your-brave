import { BadRequestError, NotFoundError } from '../../core/errors/app-error.js';
import type { EventAssociationService } from '../event-associations/event-association.service.js';
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
  private associations: EventAssociationService | null = null;

  constructor(
    private readonly memberships: MembershipRepository,
    private readonly events: EventService,
  ) {}

  setAssociationService(service: EventAssociationService): void {
    this.associations = service;
  }

  async list(query: ListMembershipsQuery): Promise<PaginatedResult<PublicMembership>> {
    if (query.eventId && this.associations) {
      const linkedIds = await this.associations.listMembershipIds(query.eventId);
      const legacy = await this.memberships.list({
        page: 1,
        perPage: 500,
        eventId: query.eventId,
        search: query.search,
      });
      const byId = new Map<string, Membership>();
      for (const membership of await this.memberships.listByIds(linkedIds)) {
        byId.set(membership.id, membership);
      }
      for (const membership of legacy.items) {
        byId.set(membership.id, membership);
      }

      let items = [...byId.values()];
      if (query.search?.trim()) {
        const search = query.search.trim().toLowerCase();
        items = items.filter(
          (membership) =>
            membership.name.toLowerCase().includes(search) ||
            membership.description.toLowerCase().includes(search),
        );
      }
      items.sort(
        (a, b) =>
          a.sortOrder - b.sortOrder ||
          a.price - b.price ||
          a.name.localeCompare(b.name),
      );
      const total = items.length;
      const start = (query.page - 1) * query.perPage;
      const pageItems = items.slice(start, start + query.perPage);
      const linkMetaById = new Map(
        (await this.associations.listMembershipLinks(query.eventId!)).map((link) => [
          link.membershipId,
          link,
        ]),
      );
      return {
        items: pageItems.map((membership) =>
          toPublicMembership(
            { ...membership, eventId: query.eventId! },
            linkMetaById.get(membership.id) ?? null,
          ),
        ),
        total,
      };
    }

    const { items, total } = await this.memberships.list(query);
    return { items: items.map((membership) => toPublicMembership(membership)), total };
  }

  async getById(id: string): Promise<PublicMembership> {
    return toPublicMembership(await this.requireMembership(id));
  }

  async create(input: CreateMembershipInput): Promise<PublicMembership> {
    const eventId = input.eventId?.trim() || '';
    if (eventId) {
      await this.events.requireEvent(eventId);
    }

    const created = await this.memberships.create({
      eventId,
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

    if (eventId && this.associations) {
      await this.associations.linkMembership(eventId, created.id);
    }

    return toPublicMembership(eventId ? { ...created, eventId } : created);
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

  async assertLinkedToEvent(membershipId: string, eventId: string): Promise<void> {
    const membership = await this.memberships.findById(membershipId);
    if (!membership) throw new BadRequestError('Selected membership was not found');
    if (membership.eventId === eventId) return;
    if (this.associations && (await this.associations.isMembershipLinked(eventId, membershipId))) {
      return;
    }
    throw new BadRequestError('Membership must be associated with this event edition');
  }

  async assertMembershipSaleOpen(membershipId: string, eventId: string): Promise<void> {
    if (!this.associations) return;
    await this.associations.assertMembershipSaleOpen(eventId, membershipId);
  }

  async requireMembership(id: string): Promise<Membership> {
    const membership = await this.memberships.findById(id);
    if (!membership) throw new NotFoundError('Membership');
    return membership;
  }

  async assertMembershipsForEvent(membershipIds: string[], eventId: string): Promise<void> {
    for (const membershipId of membershipIds) {
      await this.assertLinkedToEvent(membershipId, eventId);
    }
  }
}
