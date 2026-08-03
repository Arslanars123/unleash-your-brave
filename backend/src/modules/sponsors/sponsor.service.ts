import { randomUUID } from 'node:crypto';
import { NotFoundError } from '../../core/errors/app-error.js';
import type { EventService } from '../events/event.service.js';
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
  constructor(
    private readonly sponsors: SponsorRepository,
    private readonly events: EventService,
  ) {}

  async list(query: ListSponsorsQuery): Promise<PaginatedResult<PublicSponsor>> {
    const { items, total } = await this.sponsors.list(query);
    return { items: items.map(toPublicSponsor), total };
  }

  async getById(id: string): Promise<PublicSponsor> {
    return toPublicSponsor(await this.requireSponsor(id));
  }

  async create(input: CreateSponsorInput): Promise<PublicSponsor> {
    await this.events.requireEvent(input.eventId);

    const created = await this.sponsors.create({
      eventId: input.eventId,
      name: input.name,
      description: input.description ?? '',
      image: input.image ?? '',
      offers: normalizeOffers(input.offers),
    });
    return toPublicSponsor(created);
  }

  async update(id: string, input: UpdateSponsorInput): Promise<PublicSponsor> {
    await this.requireSponsor(id);

    const updated = await this.sponsors.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.image !== undefined ? { image: input.image } : {}),
      ...(input.offers !== undefined ? { offers: normalizeOffers(input.offers) } : {}),
    });

    if (!updated) throw new NotFoundError('Sponsor');
    return toPublicSponsor(updated);
  }

  async delete(id: string): Promise<void> {
    if (!(await this.sponsors.delete(id))) {
      throw new NotFoundError('Sponsor');
    }
  }

  private async requireSponsor(id: string): Promise<Sponsor> {
    const sponsor = await this.sponsors.findById(id);
    if (!sponsor) throw new NotFoundError('Sponsor');
    return sponsor;
  }
}
