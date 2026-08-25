import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { BadRequestError, NotFoundError } from '../../core/errors/app-error.js';
import type { EventAssociationService } from '../event-associations/event-association.service.js';
import type { EventService } from '../events/event.service.js';
import type { MailService } from '../mail/mail.service.js';
import type { UserService } from '../users/user.service.js';
import { toPublicSponsor } from './sponsor.mapper.js';
import type { PaginatedResult, SponsorRepository } from './sponsor.repository.js';
import type {
  CreateSponsorInput,
  ListSponsorsQuery,
  PublicSponsor,
  Sponsor,
  SponsorOffer,
  SponsorOfferInput,
  UpdateSponsorInput,
} from './sponsor.types.js';

function normalizeOffers(offers: SponsorOfferInput[] | undefined): SponsorOffer[] {
  return (offers ?? []).map((offer, index) => ({
    id: offer.id ?? randomUUID(),
    offerNumber: index + 1,
    description: offer.description.trim(),
    image: offer.image?.trim() ?? '',
    links: (offer.links ?? [])
      .filter((link) => link.url.trim())
      .map((link) => ({
        id: link.id ?? randomUUID(),
        label: link.label?.trim() ?? '',
        url: link.url.trim(),
      })),
  }));
}

export class SponsorService {
  private associations: EventAssociationService | null = null;

  constructor(
    private readonly sponsors: SponsorRepository,
    private readonly events: EventService,
    private readonly users: UserService,
    private readonly mail: MailService,
  ) {}

  setAssociationService(service: EventAssociationService): void {
    this.associations = service;
  }

  async list(query: ListSponsorsQuery): Promise<PaginatedResult<PublicSponsor>> {
    if (query.eventId && this.associations) {
      const linkedIds = await this.associations.listSponsorIds(query.eventId);
      const legacy = await this.sponsors.list({
        page: 1,
        perPage: 500,
        eventId: query.eventId,
        search: query.search,
      });
      const byId = new Map<string, Sponsor>();
      for (const sponsor of await this.sponsors.listByIds(linkedIds)) {
        byId.set(sponsor.id, sponsor);
      }
      for (const sponsor of legacy.items) {
        byId.set(sponsor.id, sponsor);
      }

      let items = [...byId.values()];
      if (query.search?.trim()) {
        const search = query.search.trim().toLowerCase();
        items = items.filter(
          (sponsor) =>
            sponsor.name.toLowerCase().includes(search) ||
            sponsor.email.toLowerCase().includes(search) ||
            sponsor.description.toLowerCase().includes(search),
        );
      }
      items.sort((a, b) => a.name.localeCompare(b.name));
      const total = items.length;
      const start = (query.page - 1) * query.perPage;
      const pageItems = items.slice(start, start + query.perPage);
      return {
        items: pageItems.map((sponsor) =>
          toPublicSponsor({ ...sponsor, eventId: query.eventId! }),
        ),
        total,
      };
    }

    const { items, total } = await this.sponsors.list(query);
    return { items: items.map(toPublicSponsor), total };
  }

  async getById(id: string): Promise<PublicSponsor> {
    return toPublicSponsor(await this.requireSponsor(id));
  }

  async create(input: CreateSponsorInput): Promise<PublicSponsor> {
    const eventId = input.eventId?.trim() || '';
    if (eventId) {
      await this.events.requireEvent(eventId);
    }

    const created = await this.sponsors.create({
      eventId,
      name: input.name,
      email: input.email?.trim().toLowerCase() ?? '',
      description: input.description ?? '',
      image: input.image ?? '',
      offers: normalizeOffers(input.offers),
    });

    if (eventId && this.associations) {
      await this.associations.linkSponsor(eventId, created.id);
    }

    if (input.email?.trim()) {
      await this.provisionPortalAccount(created, input.email.trim(), true);
    }

    return toPublicSponsor(eventId ? { ...created, eventId } : created);
  }

  async update(id: string, input: UpdateSponsorInput): Promise<PublicSponsor> {
    await this.requireSponsor(id);

    const updated = await this.sponsors.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email.trim().toLowerCase() } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.image !== undefined ? { image: input.image } : {}),
      ...(input.offers !== undefined ? { offers: normalizeOffers(input.offers) } : {}),
    });

    if (!updated) throw new NotFoundError('Sponsor');

    const email = input.email?.trim() || updated.email.trim();
    if (email) {
      await this.provisionPortalAccount(updated, email, Boolean(input.email?.trim()));
    }

    return toPublicSponsor(updated);
  }

  async delete(id: string): Promise<void> {
    if (!(await this.sponsors.delete(id))) {
      throw new NotFoundError('Sponsor');
    }
  }

  async assertLinkedToEvent(sponsorId: string, eventId: string): Promise<void> {
    const sponsor = await this.sponsors.findById(sponsorId);
    if (!sponsor) throw new BadRequestError('Selected sponsor was not found');
    if (sponsor.eventId === eventId) return;
    if (this.associations && (await this.associations.isSponsorLinked(eventId, sponsorId))) {
      return;
    }
    throw new BadRequestError('Sponsor must be associated with this event edition');
  }

  private async provisionPortalAccount(
    sponsor: Sponsor,
    email: string,
    issueInvite: boolean,
  ): Promise<void> {
    const { inviteCode } = await this.users.upsertPortalAccount({
      email,
      name: sponsor.name,
      role: 'sponsor',
      sponsorId: sponsor.id,
      issueInvite,
    });

    if (inviteCode) {
      const expiresAt = new Date(
        Date.now() + env.inviteCodeTtlDays * 24 * 60 * 60 * 1000,
      );
      await this.mail.sendInviteCode({
        to: email,
        name: sponsor.name,
        inviteCode,
        expiresAt,
        dualAccess: true,
      });
    } else if (issueInvite) {
      await this.mail.sendExistingAccountPortalAccess({
        to: email,
        name: sponsor.name,
        portalRole: 'sponsor',
      });
    }
  }

  private async requireSponsor(id: string): Promise<Sponsor> {
    const sponsor = await this.sponsors.findById(id);
    if (!sponsor) throw new NotFoundError('Sponsor');
    return sponsor;
  }
}
