import { BadRequestError, ForbiddenError, NotFoundError } from '../../core/errors/app-error.js';
import type { CheckInRepository } from '../../db/repositories/mongo-checkin.repository.js';
import type { CheckInFormService } from '../checkin-forms/checkin-form.service.js';
import type { SubmitCheckInFormInput } from '../checkin-forms/checkin-form.types.js';
import { toPublicCheckInForm } from '../checkin-forms/checkin-form.mapper.js';
import type { EffectiveAccessService, QrDeniedReason } from '../access/access.service.js';
import type { CheckoutService } from '../checkout/checkout.service.js';
import { editionStatus } from '../events/event.mapper.js';
import type { EventService } from '../events/event.service.js';
import type { PublicEvent } from '../events/event.types.js';
import type { MembershipLifecycleService } from '../memberships/membership-lifecycle.service.js';
import type { MembershipRepository } from '../memberships/membership.repository.js';
import { toPublicUser } from '../users/user.mapper.js';
import type { UserRepository } from '../users/user.repository.js';
import { toPublicCheckIn } from './checkin.mapper.js';
import { issueCheckInToken, verifyCheckInToken } from './checkin.token.js';
import type {
  CheckIn,
  CheckInScanResult,
  CheckInStats,
  ListCheckInsQuery,
  MyCheckInQr,
  PublicCheckIn,
} from './checkin.types.js';

function qrDeniedMessage(reason: QrDeniedReason): string {
  switch (reason) {
    case 'renewal_payment_required':
      return 'Your check-in QR will become valid once your membership renewal payment is completed.';
    case 'membership_not_valid_for_qr':
      return 'Your membership does not include a check-in QR for this event. Purchase a pass or contact support.';
    case 'account_inactive':
      return 'Your account is not eligible for a check-in QR.';
    case 'no_membership':
    default:
      return 'Your membership does not include a check-in QR for this event. Purchase a pass or contact support.';
  }
}

/** Check-in is only allowed while the edition is live (on/after start date, before end). */
function assertCheckInWindowOpen(event: PublicEvent): void {
  const status = editionStatus({
    startDate: new Date(event.startDate),
    endDate: new Date(event.endDate),
    paused: Boolean(event.paused),
  });
  if (status === 'upcoming') {
    throw new BadRequestError('Check-in will be available when the event starts.');
  }
  if (status === 'ended') {
    throw new BadRequestError('Check-in is closed for this past event.');
  }
  if (status === 'paused') {
    throw new BadRequestError('Check-in is paused for this event.');
  }
}

export class CheckInService {
  constructor(
    private readonly checkIns: CheckInRepository,
    private readonly users: UserRepository,
    private readonly events: EventService,
    private readonly memberships: MembershipRepository,
    private readonly checkout: CheckoutService,
    private readonly checkInForms?: CheckInFormService,
    private readonly access?: EffectiveAccessService,
    private readonly membershipLifecycle?: MembershipLifecycleService,
  ) {}

  async getMyQr(userId: string, eventId?: string): Promise<MyCheckInQr> {
    const event = eventId
      ? await this.events.getById(eventId)
      : await this.events.getCurrent();
    if (!event) throw new NotFoundError('Event');

    const user = await this.users.findById(userId);
    if (!user || user.status !== 'active') throw new NotFoundError('User');

    if (this.access) {
      const resolved = await this.access.resolveForUser(userId, event.id);
      if (!resolved.qrEntitled) {
        if (
          resolved.qrDeniedReason === 'renewal_payment_required' &&
          this.membershipLifecycle
        ) {
          await this.membershipLifecycle.notifyQrBlockedPendingRenewal(
            userId,
            resolved.sourceMembershipName ?? 'membership',
          );
        }
        throw new ForbiddenError(
          qrDeniedMessage(resolved.qrDeniedReason),
          resolved.qrDeniedReason === 'renewal_payment_required'
            ? 'QR_RENEWAL_PAYMENT_REQUIRED'
            : 'FORBIDDEN',
          {
            qrDeniedReason: resolved.qrDeniedReason,
            paymentPeriodActive: resolved.paymentPeriodActive,
            blockQrWhenRenewalUnpaid: resolved.blockQrWhenRenewalUnpaid,
          },
        );
      }
    }

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

  /** Events the attendee can open + whether QR is available for each. */
  async listMyBookings(userId: string): Promise<
    Array<{
      event: Awaited<ReturnType<EventService['getById']>>;
      entitled: boolean;
      qrEntitled: boolean;
      effectiveMembershipName: string | null;
      checkedIn: boolean;
      checkedInAt: string | null;
      carriedFromPrevious: boolean;
    }>
  > {
    const user = await this.users.findById(userId);
    if (!user || user.status !== 'active') throw new NotFoundError('User');

    const { items: allEvents } = await this.events.list({ page: 1, perPage: 100 });
    const results = [];

    for (const event of allEvents) {
      if (!this.access) continue;
      const access = await this.access.resolveForUser(userId, event.id);
      if (!access.entitled && !access.qrEntitled) continue;
      const checkIn = await this.checkIns.findByEventAndUser(event.id, userId);
      results.push({
        event: await this.events.getById(event.id),
        entitled: access.entitled,
        qrEntitled: access.qrEntitled,
        effectiveMembershipName: access.effectiveMembershipName,
        checkedIn: Boolean(checkIn),
        checkedInAt: checkIn?.checkedInAt.toISOString() ?? null,
        carriedFromPrevious: access.carriedFromPrevious,
      });
    }

    return results.sort(
      (a, b) =>
        new Date(b.event.startDate).getTime() - new Date(a.event.startDate).getTime(),
    );
  }

  async scan(input: {
    token?: string;
    eventId?: string;
    userId?: string;
    expectedEventId?: string;
    adminUserId: string;
  }): Promise<CheckInScanResult> {
    const { eventId, userId } = this.resolveAttendeeIds(input);

    const event = await this.events.getById(eventId);
    if (!event) throw new NotFoundError('Event');

    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('Attendee');
    if (user.role !== 'member' && !user.membershipId) {
      throw new BadRequestError('Only attendees can be checked in');
    }
    if (user.status !== 'active') {
      throw new BadRequestError('Attendee account is not active');
    }

    const existing = await this.checkIns.findByEventAndUser(eventId, userId);
    if (existing) {
      // Allow viewing an existing check-in even outside the open window.
      return this.toScanResult(existing, user, true, eventId);
    }

    assertCheckInWindowOpen(event);

    if (this.checkInForms) {
      const activeForm = await this.checkInForms.findActiveForm(eventId);
      if (activeForm) {
        const submission = await this.checkInForms.findSubmission(eventId, userId);
        if (!submission) {
          return this.toFormRequiredScanResult(user, eventId, activeForm);
        }
        // Submission exists but check-in was never linked (interrupted complete) — finish now.
        if (!submission.checkInId) {
          const created = await this.createCheckInAndResult(eventId, user, input.adminUserId);
          if (created.checkIn) {
            await this.checkInForms.linkSubmissionToCheckIn(submission.id, created.checkIn.id);
          }
          return created;
        }
      }
    }

    return this.createCheckInAndResult(eventId, user, input.adminUserId);
  }

  async completeWithForm(input: {
    token?: string;
    eventId?: string;
    userId?: string;
    expectedEventId?: string;
    adminUserId: string;
    answers: SubmitCheckInFormInput['answers'];
    signatureDataUrl?: string;
    signedName: string;
  }): Promise<CheckInScanResult> {
    if (!this.checkInForms) {
      throw new BadRequestError('Check-in forms are not available');
    }

    const { eventId, userId } = this.resolveAttendeeIds(input);

    const event = await this.events.getById(eventId);
    if (!event) throw new NotFoundError('Event');

    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('Attendee');
    if (user.role !== 'member' && !user.membershipId) {
      throw new BadRequestError('Only attendees can be checked in');
    }
    if (user.status !== 'active') {
      throw new BadRequestError('Attendee account is not active');
    }

    const existing = await this.checkIns.findByEventAndUser(eventId, userId);
    if (existing) {
      return this.toScanResult(existing, user, true, eventId);
    }

    assertCheckInWindowOpen(event);

    const activeForm = await this.checkInForms.findActiveForm(eventId);
    if (!activeForm) {
      throw new BadRequestError('No active check-in form for this event');
    }

    const submission = await this.checkInForms.saveSubmission(activeForm, userId, {
      answers: input.answers,
      signatureDataUrl: input.signatureDataUrl,
      signedName: input.signedName,
    });

    try {
      const created = await this.createCheckInRecord(eventId, user, input.adminUserId);
      await this.checkInForms.linkSubmissionToCheckIn(submission.id, created.id);
      return this.toScanResult(created, user, false, eventId);
    } catch {
      const raced = await this.checkIns.findByEventAndUser(eventId, userId);
      if (raced) {
        await this.checkInForms.linkSubmissionToCheckIn(submission.id, raced.id);
        return this.toScanResult(raced, user, true, eventId);
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
      attendeesOnly: true,
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
        membershipIdAtCheckIn: null,
        membershipNameAtCheckIn: null,
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

  private resolveAttendeeIds(input: {
    token?: string;
    eventId?: string;
    userId?: string;
    expectedEventId?: string;
  }): { eventId: string; userId: string } {
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

    return { eventId, userId };
  }

  private async createCheckInAndResult(
    eventId: string,
    user: NonNullable<Awaited<ReturnType<UserRepository['findById']>>>,
    adminUserId: string,
  ): Promise<CheckInScanResult> {
    try {
      const created = await this.createCheckInRecord(eventId, user, adminUserId);
      return this.toScanResult(created, user, false, eventId);
    } catch {
      const raced = await this.checkIns.findByEventAndUser(eventId, user.id);
      if (raced) {
        return this.toScanResult(raced, user, true, eventId);
      }
      throw new BadRequestError('Unable to complete check-in');
    }
  }

  private async createCheckInRecord(
    eventId: string,
    user: NonNullable<Awaited<ReturnType<UserRepository['findById']>>>,
    adminUserId: string,
  ): Promise<CheckIn> {
    let membershipNameAtCheckIn: string | null = null;
    if (user.membershipId) {
      const membership = await this.memberships.findById(user.membershipId);
      membershipNameAtCheckIn = membership?.name ?? null;
    }

    return this.checkIns.create({
      eventId,
      userId: user.id,
      checkedInAt: new Date(),
      checkedInBy: adminUserId,
      membershipIdAtCheckIn: user.membershipId ?? null,
      membershipNameAtCheckIn,
    });
  }

  private async toFormRequiredScanResult(
    user: NonNullable<Awaited<ReturnType<UserRepository['findById']>>>,
    eventId: string,
    form: Parameters<typeof toPublicCheckInForm>[0],
  ): Promise<CheckInScanResult> {
    const membership = await this.buildMembershipSummary(user, eventId, null);
    return {
      requiresForm: true,
      form: toPublicCheckInForm(form),
      checkIn: null,
      alreadyCheckedIn: false,
      user: toPublicUser(user),
      membership,
    };
  }

  private async toScanResult(
    checkIn: CheckIn,
    user: NonNullable<Awaited<ReturnType<UserRepository['findById']>>>,
    alreadyCheckedIn: boolean,
    eventId: string,
  ): Promise<CheckInScanResult> {
    return {
      requiresForm: false,
      form: null,
      checkIn: toPublicCheckIn(checkIn, toPublicUser(user)),
      alreadyCheckedIn,
      user: toPublicUser(user),
      membership: await this.buildMembershipSummary(user, eventId, checkIn),
    };
  }

  private async buildMembershipSummary(
    user: NonNullable<Awaited<ReturnType<UserRepository['findById']>>>,
    eventId: string,
    checkIn: CheckIn | null,
  ) {
    const summary = await this.checkout.getAttendeePurchaseSummary(user.id, eventId);
    const access = this.access
      ? await this.access.resolveForUser(user.id, eventId)
      : null;

    const qrEntitled = access?.qrEntitled ?? true;
    const qrDeniedReason = access?.qrDeniedReason ?? null;
    const qrStatusLabel = qrEntitled
      ? 'Valid for this event'
      : qrDeniedReason === 'renewal_payment_required'
        ? 'Not updated — renewal payment pending'
        : 'Invalid / not entitled for this event';

    return {
      ...summary,
      membershipIdAtCheckIn: checkIn?.membershipIdAtCheckIn ?? null,
      membershipNameAtCheckIn: checkIn?.membershipNameAtCheckIn ?? null,
      isRecurring: summary.currentBillingKind === 'renewable',
      paymentPeriodActive: access?.paymentPeriodActive ?? summary.currentMembershipStatus !== 'expired',
      qrEntitled,
      qrDeniedReason,
      qrStatusLabel,
      eligibleForEventContent: access?.entitled ?? Boolean(summary.currentMembershipId),
      eligibleForEventQr: qrEntitled,
      blockQrWhenRenewalUnpaid: access?.blockQrWhenRenewalUnpaid ?? true,
      carriedFromPrevious: access?.carriedFromPrevious ?? false,
    };
  }

  private async countActiveMembers(): Promise<number> {
    const result = await this.users.list({
      page: 1,
      perPage: 1,
      attendeesOnly: true,
      status: 'active',
    });
    return result.total;
  }
}
