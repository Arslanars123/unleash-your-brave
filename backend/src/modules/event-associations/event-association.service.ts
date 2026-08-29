import type { MongoEventAssociationRepository } from '../../db/repositories/mongo-event-association.repository.js';
import { BadRequestError, NotFoundError } from '../../core/errors/app-error.js';
import type { EventService } from '../events/event.service.js';
import type { MembershipService } from '../memberships/membership.service.js';
import type { SpeakerService } from '../speakers/speaker.service.js';
import type { SponsorService } from '../sponsors/sponsor.service.js';

export interface EventAssociationsPayload {
  speakerIds?: string[];
  sponsorIds?: string[];
  membershipIds?: string[];
}

export interface EventAssociationsView {
  eventId: string;
  speakerIds: string[];
  sponsorIds: string[];
  membershipIds: string[];
}

/**
 * Many-to-many links between editions and shared speakers / sponsors / memberships.
 * Sessions and other edition content stay event-scoped; identities can be reused.
 */
export class EventAssociationService {
  private speakers: SpeakerService | null = null;
  private sponsors: SponsorService | null = null;
  private memberships: MembershipService | null = null;

  constructor(
    private readonly associations: MongoEventAssociationRepository,
    private readonly events: EventService,
  ) {}

  setCatalogServices(input: {
    speakers: SpeakerService;
    sponsors: SponsorService;
    memberships: MembershipService;
  }): void {
    this.speakers = input.speakers;
    this.sponsors = input.sponsors;
    this.memberships = input.memberships;
  }

  async getForEvent(eventId: string): Promise<EventAssociationsView> {
    await this.events.requireEvent(eventId);
    const [speakerIds, sponsorIds, membershipIds] = await Promise.all([
      this.associations.listEntityIds(eventId, 'speaker'),
      this.associations.listEntityIds(eventId, 'sponsor'),
      this.associations.listEntityIds(eventId, 'membership'),
    ]);
    return { eventId, speakerIds, sponsorIds, membershipIds };
  }

  async setForEvent(eventId: string, input: EventAssociationsPayload): Promise<EventAssociationsView> {
    await this.events.requireEvent(eventId);

    if (input.speakerIds) {
      await this.assertSpeakersExist(input.speakerIds);
      await this.associations.setLinks(eventId, 'speaker', input.speakerIds);
    }
    if (input.sponsorIds) {
      await this.assertSponsorsExist(input.sponsorIds);
      const previouslyLinked = await this.associations.listEntityIds(eventId, 'sponsor');
      await this.associations.setLinks(eventId, 'sponsor', input.sponsorIds);
      const newlyLinked = input.sponsorIds.filter((id) => !previouslyLinked.includes(id));
      for (const sponsorId of newlyLinked) {
        void this.sponsors?.notifyAssignedToEvent(sponsorId, eventId);
      }
    }
    if (input.membershipIds) {
      await this.assertMembershipsExist(input.membershipIds);
      await this.associations.setLinks(eventId, 'membership', input.membershipIds);
    }

    return this.getForEvent(eventId);
  }

  async linkSpeaker(eventId: string, speakerId: string): Promise<void> {
    await this.events.requireEvent(eventId);
    await this.assertSpeakersExist([speakerId]);
    await this.associations.link(eventId, 'speaker', speakerId);
  }

  /** Event IDs this speaker is linked to (session assignment / associations). */
  async listEventIdsForSpeaker(speakerId: string): Promise<string[]> {
    return this.associations.listEventIds(speakerId, 'speaker');
  }

  async linkSponsor(eventId: string, sponsorId: string): Promise<void> {
    await this.events.requireEvent(eventId);
    await this.assertSponsorsExist([sponsorId]);
    const alreadyLinked = await this.associations.isLinked(eventId, 'sponsor', sponsorId);
    await this.associations.link(eventId, 'sponsor', sponsorId);
    if (!alreadyLinked) {
      void this.sponsors?.notifyAssignedToEvent(sponsorId, eventId);
    }
  }

  /** Event IDs this sponsor is linked to (for portal offer editing). */
  async listEventIdsForSponsor(sponsorId: string): Promise<string[]> {
    return this.associations.listEventIds(sponsorId, 'sponsor');
  }

  async getSponsorAssociation(
    eventId: string,
    sponsorId: string,
  ): Promise<{ offersJson?: unknown } | null> {
    const link = await this.associations.findLink(eventId, 'sponsor', sponsorId);
    if (!link) return null;
    return { offersJson: link.offersJson };
  }

  async listSponsorAssociations(eventId: string): Promise<
    Array<{ sponsorId: string; offersJson?: unknown }>
  > {
    const links = await this.associations.listLinksForEvent(eventId, 'sponsor');
    return links.map((link) => ({
      sponsorId: link.entityId,
      offersJson: link.offersJson,
    }));
  }

  /**
   * Store edition-specific offers on the sponsor↔event association.
   * Creates the link if missing.
   */
  async setSponsorOffers(
    eventId: string,
    sponsorId: string,
    offersJson: unknown,
  ): Promise<void> {
    await this.events.requireEvent(eventId);
    await this.assertSponsorsExist([sponsorId]);
    const alreadyLinked = await this.associations.isLinked(eventId, 'sponsor', sponsorId);
    await this.associations.link(eventId, 'sponsor', sponsorId, offersJson);
    if (!alreadyLinked) {
      void this.sponsors?.notifyAssignedToEvent(sponsorId, eventId);
    }
  }

  async linkMembership(eventId: string, membershipId: string): Promise<void> {
    await this.events.requireEvent(eventId);
    await this.assertMembershipsExist([membershipId]);
    await this.associations.link(eventId, 'membership', membershipId);
  }

  async unlinkSpeaker(eventId: string, speakerId: string): Promise<void> {
    await this.events.requireEvent(eventId);
    if (!(await this.associations.unlink(eventId, 'speaker', speakerId))) {
      throw new NotFoundError('Speaker association');
    }
  }

  async unlinkSponsor(eventId: string, sponsorId: string): Promise<void> {
    await this.events.requireEvent(eventId);
    if (!(await this.associations.unlink(eventId, 'sponsor', sponsorId))) {
      throw new NotFoundError('Sponsor association');
    }
  }

  async unlinkMembership(eventId: string, membershipId: string): Promise<void> {
    await this.events.requireEvent(eventId);
    if (!(await this.associations.unlink(eventId, 'membership', membershipId))) {
      throw new NotFoundError('Membership association');
    }
  }

  async isSpeakerLinked(eventId: string, speakerId: string): Promise<boolean> {
    return this.associations.isLinked(eventId, 'speaker', speakerId);
  }

  async isMembershipLinked(eventId: string, membershipId: string): Promise<boolean> {
    return this.associations.isLinked(eventId, 'membership', membershipId);
  }

  async isSponsorLinked(eventId: string, sponsorId: string): Promise<boolean> {
    return this.associations.isLinked(eventId, 'sponsor', sponsorId);
  }

  async listSpeakerIds(eventId: string): Promise<string[]> {
    return this.associations.listEntityIds(eventId, 'speaker');
  }

  async listMembershipIds(eventId: string): Promise<string[]> {
    return this.associations.listEntityIds(eventId, 'membership');
  }

  async listSponsorIds(eventId: string): Promise<string[]> {
    return this.associations.listEntityIds(eventId, 'sponsor');
  }

  private async assertSpeakersExist(ids: string[]): Promise<void> {
    if (!this.speakers) throw new BadRequestError('Speaker service not ready');
    for (const id of ids) {
      await this.speakers.getById(id);
    }
  }

  private async assertSponsorsExist(ids: string[]): Promise<void> {
    if (!this.sponsors) throw new BadRequestError('Sponsor service not ready');
    for (const id of ids) {
      await this.sponsors.getById(id);
    }
  }

  private async assertMembershipsExist(ids: string[]): Promise<void> {
    if (!this.memberships) throw new BadRequestError('Membership service not ready');
    for (const id of ids) {
      await this.memberships.getById(id);
    }
  }
}
