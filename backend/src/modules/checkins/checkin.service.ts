import { BadRequestError, NotFoundError } from '../../core/errors/app-error.js';
import type { CheckInRepository } from '../../db/repositories/mongo-checkin.repository.js';
import type { EventService } from '../events/event.service.js';
import { toPublicUser } from '../users/user.mapper.js';
import type { UserRepository } from '../users/user.repository.js';
import { toPublicCheckIn } from './checkin.mapper.js';
import { issueCheckInToken, verifyCheckInToken } from './checkin.token.js';
import type {
  CheckInScanResult,
  CheckInStats,
  ListCheckInsQuery,
  MyCheckInQr,
  PublicCheckIn,
} from './checkin.types.js';

export class CheckInService {
  constructor(
    private readonly checkIns: CheckInRepository,
    private readonly users: UserRepository,
    private readonly events: EventService,
  ) {}

  async getMyQr(userId: string, eventId?: string): Promise<MyCheckInQr> {
    const event = eventId
      ? await this.events.getById(eventId)
      : await this.events.getCurrent();
    if (!event) throw new NotFoundError('Event');

    const user = await this.users.findById(userId);
    if (!user || user.status !== 'active') throw new NotFoundError('User');

    const existing = await this.checkIns.findByEventAndUser(event.id, userId);
    return {
      eventId: event.id,
      eventName: event.name,
      eventStatus: event.status,
      userId,
      token: issueCheckInToken(event.id, userId),
      checkedIn: Boolean(existing),
      checkedInAt: existing?.checkedInAt.toISOString() ?? null,
    };
  }

  async scan(input: {
    token?: string;
    eventId?: string;
    userId?: string;
    expectedEventId?: string;
    adminUserId: string;
  }): Promise<CheckInScanResult> {
    let eventId: string;
    let userId: string;

    if (input.token) {
      const decoded = verifyCheckInToken(input.token);
      eventId = decoded.eventId;
      userId = decoded.userId;
    } else if (input.eventId && input.userId) {
      eventId = input.eventId;
      userId = input.userId;
    } else {
      throw new BadRequestError('Provide a QR token, or both eventId and userId');
    }

    if (input.expectedEventId && input.expectedEventId !== eventId) {
      throw new BadRequestError(
        'This QR belongs to a different event edition. Switch edition or ask for the current event QR.',
      );
    }

    const event = await this.events.getById(eventId);
    if (!event) throw new NotFoundError('Event');

    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('Attendee');
    if (user.role !== 'member') {
      throw new BadRequestError('Only attendees can be checked in');
    }
    if (user.status !== 'active') {
      throw new BadRequestError('Attendee account is not active');
    }

    const existing = await this.checkIns.findByEventAndUser(eventId, userId);
    if (existing) {
      return {
        checkIn: toPublicCheckIn(existing, toPublicUser(user)),
        alreadyCheckedIn: true,
        user: toPublicUser(user),
      };
    }

    try {
      const created = await this.checkIns.create({
        eventId,
        userId,
        checkedInAt: new Date(),
        checkedInBy: input.adminUserId,
      });

      return {
        checkIn: toPublicCheckIn(created, toPublicUser(user)),
        alreadyCheckedIn: false,
        user: toPublicUser(user),
      };
    } catch {
      const raced = await this.checkIns.findByEventAndUser(eventId, userId);
      if (raced) {
        return {
          checkIn: toPublicCheckIn(raced, toPublicUser(user)),
          alreadyCheckedIn: true,
          user: toPublicUser(user),
        };
      }
      throw new BadRequestError('Unable to complete check-in');
    }
  }

  async list(query: ListCheckInsQuery): Promise<{
    items: Array<PublicCheckIn & { checkedIn: boolean }>;
    total: number;
    stats: CheckInStats;
  }> {
    const event = await this.events.getById(query.eventId);
    if (!event) throw new NotFoundError('Event');

    const members = await this.users.list({
      page: 1,
      perPage: 5000,
      role: 'member',
      search: query.search,
    });

    const checkIns = await this.checkIns.listByEvent(query.eventId);
    const byUser = new Map(checkIns.map((c) => [c.userId, c]));

    let rows = members.items.map((user) => {
      const checkIn = byUser.get(user.id);
      const publicUser = toPublicUser(user);
      if (checkIn) {
        return {
          ...toPublicCheckIn(checkIn, publicUser),
          checkedIn: true as const,
        };
      }
      return {
        id: `pending:${user.id}`,
        eventId: query.eventId,
        userId: user.id,
        checkedInAt: '',
        checkedInBy: null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        user: publicUser,
        checkedIn: false as const,
      };
    });

    if (query.status === 'checked_in') {
      rows = rows.filter((r) => r.checkedIn);
    } else if (query.status === 'not_checked_in') {
      rows = rows.filter((r) => !r.checkedIn);
    }

    rows.sort((a, b) => {
      if (a.checkedIn !== b.checkedIn) return a.checkedIn ? -1 : 1;
      const aTime = a.checkedInAt ? Date.parse(a.checkedInAt) : 0;
      const bTime = b.checkedInAt ? Date.parse(b.checkedInAt) : 0;
      if (aTime !== bTime) return bTime - aTime;
      return (a.user?.name ?? '').localeCompare(b.user?.name ?? '');
    });

    const start = (query.page - 1) * query.perPage;
    const attendeeCount = await this.countActiveMembers();
    const checkedInCount = await this.checkIns.countByEvent(query.eventId);

    return {
      items: rows.slice(start, start + query.perPage),
      total: rows.length,
      stats: {
        eventId: query.eventId,
        checkedInCount,
        attendeeCount,
      },
    };
  }

  async stats(eventId: string): Promise<CheckInStats> {
    const event = await this.events.getById(eventId);
    if (!event) throw new NotFoundError('Event');
    return {
      eventId,
      checkedInCount: await this.checkIns.countByEvent(eventId),
      attendeeCount: await this.countActiveMembers(),
    };
  }

  private async countActiveMembers(): Promise<number> {
    const result = await this.users.list({
      page: 1,
      perPage: 1,
      role: 'member',
      status: 'active',
    });
    return result.total;
  }
}
