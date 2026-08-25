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
  LinkedSponsorEvent,
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

function parseStoredOffers(raw: unknown): SponsorOffer[] | null {
  if (raw === undefined) return null;
  if (!Array.isArray(raw)) return [];
  return normalizeOffers(raw as SponsorOfferInput[]);
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
      const eventId = query.eventId;
      const linkedIds = await this.associations.listSponsorIds(eventId);
      const associationRows = await this.associations.listSponsorAssociations(eventId);
      const offersBySponsor = new Map(
        associationRows.map((row) => [row.sponsorId, row.offersJson] as const),
      );

      const legacy = await this.sponsors.list({
        page: 1,
        perPage: 500,
        eventId,
        search: query.search,
      });
      const byId = new Map<string, Sponsor>();
      for (const sponsor of await this.sponsors.listByIds(linkedIds)) {
        byId.set(sponsor.id, sponsor);
      }
      for (const sponsor of legacy.items) {
        byId.set(sponsor.id, sponsor);
      }

      let items = [...byId.values()].map((sponsor) =>
        this.withEventOffers(sponsor, eventId, offersBySponsor.get(sponsor.id)),
      );

      if (query.search?.trim()) {
        const search = query.search.trim().toLowerCase();
        items = items.filter(
          (sponsor) =>
            sponsor.name.toLowerCase().includes(search) ||
            sponsor.email.toLowerCase().includes(search) ||
            sponsor.description.toLowerCase().includes(search) ||
            sponsor.offers.some((offer) => offer.description.toLowerCase().includes(search)),
        );
      }
      items.sort((a, b) => a.name.localeCompare(b.name));
      const total = items.length;
      const start = (query.page - 1) * query.perPage;
      const pageItems = items.slice(start, start + query.perPage);
      return {
        items: pageItems.map((sponsor) => toPublicSponsor({ ...sponsor, eventId })),
        total,
      };
    }

    // Library view: profile only — offers are per-event, so hide embedded legacy offers.
    const { items, total } = await this.sponsors.list(query);
    return {
      items: items.map((sponsor) => toPublicSponsor({ ...sponsor, offers: [] })),
      total,
    };
  }

  async getById(id: string, eventId?: string): Promise<PublicSponsor> {
    const sponsor = await this.requireSponsor(id);
    if (!eventId) {
      return toPublicSponsor({ ...sponsor, offers: [] });
    }
    await this.events.requireEvent(eventId);
    const link = this.associations
      ? await this.associations.getSponsorAssociation(eventId, id)
      : null;
    const scoped = this.withEventOffers(sponsor, eventId, link?.offersJson);
    return toPublicSponsor({ ...scoped, eventId });
  }

  async listLinkedEvents(sponsorId: string): Promise<LinkedSponsorEvent[]> {
    const sponsor = await this.requireSponsor(sponsorId);
    if (!this.associations) return [];

    const eventIds = await this.associations.listEventIdsForSponsor(sponsorId);
    const results: LinkedSponsorEvent[] = [];
    for (const eventId of eventIds) {
      try {
        const event = await this.events.getById(eventId);
        const link = await this.associations.getSponsorAssociation(eventId, sponsorId);
        const scoped = this.withEventOffers(sponsor, eventId, link?.offersJson);
        results.push({
          id: event.id,
          name: event.name,
          startDate: event.startDate,
          endDate: event.endDate,
          status: event.status,
          offerCount: scoped.offers.length,
        });
      } catch {
        // Skip deleted / missing events.
      }
    }
    results.sort((a, b) => b.startDate.localeCompare(a.startDate));
    return results;
  }

  async create(input: CreateSponsorInput): Promise<PublicSponsor> {
    const eventId = input.eventId?.trim() || '';
    const offers = normalizeOffers(input.offers);
    if (offers.length > 0 && !eventId) {
      throw new BadRequestError('Select an event when creating sponsor offers');
    }
    if (eventId) {
      await this.events.requireEvent(eventId);
    }

    // Shared sponsor profile — offers live on the event association.
    const created = await this.sponsors.create({
      eventId: '',
      name: input.name,
      email: input.email?.trim().toLowerCase() ?? '',
      description: input.description ?? '',
      image: input.image ?? '',
      offers: [],
    });

    if (eventId && this.associations) {
      await this.associations.setSponsorOffers(eventId, created.id, offers);
    }

    if (input.email?.trim()) {
      await this.provisionPortalAccount(created, input.email.trim(), true);
    }

    return this.getById(created.id, eventId || undefined);
  }

  async update(id: string, input: UpdateSponsorInput): Promise<PublicSponsor> {
    await this.requireSponsor(id);

    if (input.offers !== undefined && !input.eventId?.trim()) {
      throw new BadRequestError('Select an event when saving sponsor offers');
    }

    const updated = await this.sponsors.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email.trim().toLowerCase() } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.image !== undefined ? { image: input.image } : {}),
      // Never write event offers onto the shared sponsor document.
    });

    if (!updated) throw new NotFoundError('Sponsor');

    const eventId = input.eventId?.trim();
    if (input.offers !== undefined && eventId && this.associations) {
      await this.associations.setSponsorOffers(eventId, id, normalizeOffers(input.offers));
    }

    const email = input.email?.trim() || updated.email.trim();
    if (email) {
      await this.provisionPortalAccount(updated, email, Boolean(input.email?.trim()));
    }

    return this.getById(id, eventId);
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

  /**
   * Resolve offers for an event: association offersJson wins; legacy home-event
   * sponsors fall back to embedded offers once.
   */
  private withEventOffers(
    sponsor: Sponsor,
    eventId: string,
    offersJson: unknown,
  ): Sponsor {
    const stored = parseStoredOffers(offersJson);
    if (stored !== null) {
      return { ...sponsor, eventId, offers: stored };
    }
    if (sponsor.eventId === eventId && sponsor.offers.length > 0) {
      return { ...sponsor, eventId, offers: sponsor.offers };
    }
    return { ...sponsor, eventId, offers: [] };
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
