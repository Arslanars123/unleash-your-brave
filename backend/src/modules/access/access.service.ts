import type { EventService } from '../events/event.service.js';
import type { MembershipRepository } from '../memberships/membership.repository.js';
import type { Membership } from '../memberships/membership.types.js';
import type { UserRepository } from '../users/user.repository.js';

export interface EffectiveEventAccess {
  eventId: string;
  allowPreviousAttendeesAccess: boolean;
  /** User may view this edition’s app content / receive a check-in QR. */
  entitled: boolean;
  /** Access comes from a previous edition membership. */
  carriedFromPrevious: boolean;
  /** Membership UUID(s) that unlock restricted sessions on this event. */
  accessibleMembershipIds: string[];
  /** Best single membership id for this event (mapped or owned). */
  effectiveMembershipId: string | null;
  effectiveMembershipName: string | null;
  sourceMembershipId: string | null;
  sourceMembershipName: string | null;
  validForFutureEvents: boolean;
  /**
   * Upgrade options the app should show for this user on this event.
   * Empty = show purchase catalog as-is (no current pass).
   * One id = only that next level.
   */
  upgradeMembershipIds: string[];
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function upgradeRank(membership: Membership): number {
  if ((membership.tierRank ?? 0) > 0) return membership.tierRank;
  return membership.price;
}

function mapPastToCurrent(
  past: Membership,
  currentEventMemberships: Membership[],
): Membership | null {
  const byName = currentEventMemberships.find(
    (item) => normalizeName(item.name) === normalizeName(past.name),
  );
  if (byName) return byName;

  if ((past.tierRank ?? 0) > 0) {
    const byRank = currentEventMemberships.find(
      (item) => (item.tierRank ?? 0) === past.tierRank,
    );
    if (byRank) return byRank;
  }

  return null;
}

function nextUpgradeIds(
  current: Membership,
  catalog: Membership[],
): string[] {
  if (current.upgradeToMembershipId) {
    const explicit = catalog.find((item) => item.id === current.upgradeToMembershipId);
    if (explicit && explicit.id !== current.id) return [explicit.id];
  }

  const rank = upgradeRank(current);
  const higher = catalog
    .filter((item) => item.id !== current.id && upgradeRank(item) > rank)
    .sort((a, b) => {
      const rankDiff = upgradeRank(a) - upgradeRank(b);
      if (rankDiff !== 0) return rankDiff;
      return a.sortOrder - b.sortOrder;
    });

  return higher[0] ? [higher[0].id] : [];
}

/**
 * Resolves whether a member can access a given event edition’s content and QR,
 * including carry-forward from previous memberships.
 */
export class EffectiveAccessService {
  constructor(
    private readonly users: UserRepository,
    private readonly memberships: MembershipRepository,
    private readonly events: EventService,
  ) {}

  async resolveForUser(
    userId: string,
    eventId?: string,
  ): Promise<EffectiveEventAccess> {
    const event = eventId
      ? await this.events.requireEvent(eventId)
      : await this.events.getLatest();
    if (!event) {
      return {
        eventId: eventId ?? '',
        allowPreviousAttendeesAccess: false,
        entitled: false,
        carriedFromPrevious: false,
        accessibleMembershipIds: [],
        effectiveMembershipId: null,
        effectiveMembershipName: null,
        sourceMembershipId: null,
        sourceMembershipName: null,
        validForFutureEvents: false,
        upgradeMembershipIds: [],
      };
    }

    const allowPrevious = Boolean(event.allowPreviousAttendeesAccess);
    const { items: catalog } = await this.memberships.list({
      page: 1,
      perPage: 100,
      eventId: event.id,
    });

    const user = await this.users.findById(userId);
    if (!user || user.status !== 'active' || user.role !== 'member') {
      return {
        eventId: event.id,
        allowPreviousAttendeesAccess: allowPrevious,
        entitled: false,
        carriedFromPrevious: false,
        accessibleMembershipIds: [],
        effectiveMembershipId: null,
        effectiveMembershipName: null,
        sourceMembershipId: null,
        sourceMembershipName: null,
        validForFutureEvents: false,
        upgradeMembershipIds: catalog.map((item) => item.id),
      };
    }

    const sourceId = user.membershipId;
    if (!sourceId) {
      return {
        eventId: event.id,
        allowPreviousAttendeesAccess: allowPrevious,
        entitled: false,
        carriedFromPrevious: false,
        accessibleMembershipIds: [],
        effectiveMembershipId: null,
        effectiveMembershipName: null,
        sourceMembershipId: null,
        sourceMembershipName: null,
        validForFutureEvents: false,
        upgradeMembershipIds: catalog.map((item) => item.id),
      };
    }

    const source = await this.memberships.findById(sourceId);
    if (!source) {
      return {
        eventId: event.id,
        allowPreviousAttendeesAccess: allowPrevious,
        entitled: false,
        carriedFromPrevious: false,
        accessibleMembershipIds: [],
        effectiveMembershipId: null,
        effectiveMembershipName: null,
        sourceMembershipId: sourceId,
        sourceMembershipName: null,
        validForFutureEvents: false,
        upgradeMembershipIds: catalog.map((item) => item.id),
      };
    }

    // Same-edition membership — full access.
    if (source.eventId === event.id) {
      return {
        eventId: event.id,
        allowPreviousAttendeesAccess: allowPrevious,
        entitled: true,
        carriedFromPrevious: false,
        accessibleMembershipIds: [source.id],
        effectiveMembershipId: source.id,
        effectiveMembershipName: source.name,
        sourceMembershipId: source.id,
        sourceMembershipName: source.name,
        validForFutureEvents: Boolean(source.validForFutureEvents),
        upgradeMembershipIds: nextUpgradeIds(source, catalog),
      };
    }

    const canCarry =
      Boolean(source.validForFutureEvents) || allowPrevious;
    if (!canCarry) {
      return {
        eventId: event.id,
        allowPreviousAttendeesAccess: allowPrevious,
        entitled: false,
        carriedFromPrevious: false,
        accessibleMembershipIds: [],
        effectiveMembershipId: null,
        effectiveMembershipName: null,
        sourceMembershipId: source.id,
        sourceMembershipName: source.name,
        validForFutureEvents: Boolean(source.validForFutureEvents),
        upgradeMembershipIds: catalog.map((item) => item.id),
      };
    }

    const mapped = mapPastToCurrent(source, catalog);
    if (mapped) {
      return {
        eventId: event.id,
        allowPreviousAttendeesAccess: allowPrevious,
        entitled: true,
        carriedFromPrevious: true,
        accessibleMembershipIds: [mapped.id],
        effectiveMembershipId: mapped.id,
        effectiveMembershipName: mapped.name,
        sourceMembershipId: source.id,
        sourceMembershipName: source.name,
        validForFutureEvents: Boolean(source.validForFutureEvents),
        upgradeMembershipIds: nextUpgradeIds(mapped, catalog),
      };
    }

    // Carry-eligible but no matching tier on the new edition:
    // still entitled for open sessions + QR when validForFutureEvents or allowPrevious.
    return {
      eventId: event.id,
      allowPreviousAttendeesAccess: allowPrevious,
      entitled: true,
      carriedFromPrevious: true,
      accessibleMembershipIds: [],
      effectiveMembershipId: null,
      effectiveMembershipName: null,
      sourceMembershipId: source.id,
      sourceMembershipName: source.name,
      validForFutureEvents: Boolean(source.validForFutureEvents),
      upgradeMembershipIds: catalog.map((item) => item.id),
    };
  }
}
