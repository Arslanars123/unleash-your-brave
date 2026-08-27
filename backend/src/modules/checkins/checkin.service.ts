import { BadRequestError, ForbiddenError, NotFoundError } from '../../core/errors/app-error.js';
import type { CheckInRepository } from '../../db/repositories/mongo-checkin.repository.js';
import type { CheckInFormService } from '../checkin-forms/checkin-form.service.js';
import type { SubmitCheckInFormInput } from '../checkin-forms/checkin-form.types.js';
import { toPublicCheckInForm, toPublicCheckInFormSubmission } from '../checkin-forms/checkin-form.mapper.js';
import type { EffectiveAccessService, QrDeniedReason } from '../access/access.service.js';
import type { ClientTestingService } from '../client-testing/client-testing.service.js';
import type { CheckoutService } from '../checkout/checkout.service.js';
import { editionStatus } from '../events/event.mapper.js';
import type { EventService } from '../events/event.service.js';
import type { PublicEvent } from '../events/event.types.js';
import type { MembershipLifecycleService } from '../memberships/membership-lifecycle.service.js';
import type { MembershipRepository } from '../memberships/membership.repository.js';
import type { PushNotificationService } from '../chat/push.service.js';
import { toPublicUser } from '../users/user.mapper.js';
import type { UserRepository } from '../users/user.repository.js';
import type { CheckInPendingScanRepository } from './checkin-pending-scan.repository.js';
import { toPublicCheckIn } from './checkin.mapper.js';
import type { CheckInQrTokenRepository } from './checkin-qr-token.repository.js';
import { issueCheckInToken, verifyCheckInToken } from './checkin.token.js';
import type {
  CheckIn,
  CheckInScanResult,
  CheckInStats,
  ListCheckInsQuery,
  MyCheckInQr,
  MyPendingCheckInForm,
  PublicCheckIn,
} from './checkin.types.js';

/** How long a QR scan waits for the attendee to finish the waiver on their phone. */
const PENDING_SCAN_TTL_MS = 15 * 60 * 1000;

function qrDeniedMessage(reason: QrDeniedReason): string {
  switch (reason) {
    case 'renewal_payment_required':
      return 'Your check-in QR will become valid once your membership renewal payment is completed.';
    case 'account_inactive':
      return 'Your account is not eligible for a check-in QR.';
    case 'membership_not_valid_for_qr':
    case 'no_membership':
    default:
      return 'You do not have a membership for this event. Please purchase a membership to receive your check-in QR code.';
  }
}

/**
 * Check-in is only allowed while the edition is live (on/after start date, before end).
 * CLIENT_TESTING_MODE: when enabled, upcoming editions are also allowed (ended/paused still blocked).
 */
async function assertCheckInWindowOpen(
  event: PublicEvent,
  clientTesting?: ClientTestingService,
): Promise<void> {
  const status = editionStatus({
    startDate: new Date(event.startDate),
    endDate: new Date(event.endDate),
    paused: Boolean(event.paused),
  });

  // CLIENT_TESTING_MODE — remove this branch when deleting client-testing module.
  if (status === 'upcoming' && clientTesting && (await clientTesting.isEnabled())) {
    return;
  }

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
    private readonly qrTokens?: CheckInQrTokenRepository,
    private readonly pendingScans?: CheckInPendingScanRepository,
    private readonly push?: PushNotificationService,
    /** CLIENT_TESTING_MODE — remove this constructor arg when deleting client-testing. */
    private readonly clientTesting?: ClientTestingService,
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
      token: await issueCheckInToken(event.id, userId, this.qrTokens),
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
    source?: 'qr' | 'manual';
    /** When true, only report status — do not create/refresh a pending session. */
    poll?: boolean;
    adminUserId: string;
  }): Promise<CheckInScanResult> {
    const { eventId, userId } = await this.resolveAttendeeIds(input);
    const source: 'qr' | 'manual' =
      input.source ?? (input.token ? 'qr' : 'manual');

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
      await this.pendingScans?.deleteByEventAndUser(eventId, userId);
      // Allow viewing an existing check-in even outside the open window.
      return this.toScanResult(existing, user, true, eventId);
    }

    await assertCheckInWindowOpen(event, this.clientTesting);

    if (this.checkInForms) {
      const activeForm = await this.checkInForms.findActiveForm(eventId);
      if (activeForm) {
        if (source === 'qr' && this.pendingScans) {
          // Dashboard wait-loop: report whether the phone session is still open.
          if (input.poll) {
            const pending = await this.pendingScans.findActiveByEventAndUser(
              eventId,
              userId,
            );
            if (pending) {
              return this.toFormRequiredScanResult(user, eventId, activeForm, true);
            }
            // Attendee abandoned / expired without checking in.
            return this.toIdleScanResult(user, eventId);
          }

          await this.pendingScans.upsert({
            eventId,
            userId,
            formId: activeForm.id,
            scannedBy: input.adminUserId,
            expiresAt: new Date(Date.now() + PENDING_SCAN_TTL_MS),
          });
          void this.notifyAttendeeFormRequired(userId, event.name);
          return this.toFormRequiredScanResult(user, eventId, activeForm, true);
        }
        // Manual check-in: admin completes the form on the dashboard.
        await this.pendingScans?.deleteByEventAndUser(eventId, userId);
        return this.toFormRequiredScanResult(user, eventId, activeForm, false);
      }
    }

    return this.createCheckInAndResult(eventId, user, input.adminUserId);
  }

  async getMyPendingForm(
    userId: string,
    eventId?: string,
  ): Promise<MyPendingCheckInForm> {
    if (!this.pendingScans || !this.checkInForms) {
      return {
        pending: false,
        eventId: null,
        scannedAt: null,
        expiresAt: null,
        form: null,
      };
    }

    const pending = await this.pendingScans.findActiveByUser(userId, eventId);
    if (!pending) {
      return {
        pending: false,
        eventId: null,
        scannedAt: null,
        expiresAt: null,
        form: null,
      };
    }

    const existing = await this.checkIns.findByEventAndUser(
      pending.eventId,
      userId,
    );
    if (existing) {
      await this.pendingScans.deleteByEventAndUser(pending.eventId, userId);
      return {
        pending: false,
        eventId: null,
        scannedAt: null,
        expiresAt: null,
        form: null,
      };
    }

    const form = await this.checkInForms.findActiveForm(pending.eventId);
    if (!form || form.id !== pending.formId) {
      await this.pendingScans.deleteById(pending.id);
      return {
        pending: false,
        eventId: null,
        scannedAt: null,
        expiresAt: null,
        form: null,
      };
    }

    return {
      pending: true,
      eventId: pending.eventId,
      scannedAt: pending.updatedAt.toISOString(),
      expiresAt: pending.expiresAt.toISOString(),
      form: toPublicCheckInForm(form),
    };
  }

  /** Clear an unfinished door scan so the attendee can show QR again. */
  async cancelMyPendingForm(
    userId: string,
    eventId?: string,
  ): Promise<{ cleared: boolean }> {
    if (!this.pendingScans) return { cleared: false };

    if (eventId) {
      const pending = await this.pendingScans.findActiveByEventAndUser(
        eventId,
        userId,
      );
      if (!pending) return { cleared: false };
      await this.pendingScans.deleteByEventAndUser(eventId, userId);
      return { cleared: true };
    }

    const pending = await this.pendingScans.findActiveByUser(userId);
    if (!pending) return { cleared: false };
    await this.pendingScans.deleteById(pending.id);
    return { cleared: true };
  }

  async completeMyForm(input: {
    userId: string;
    eventId: string;
    answers: SubmitCheckInFormInput['answers'];
    signatureDataUrl?: string;
    signedName: string;
  }): Promise<MyCheckInQr> {
    if (!this.checkInForms || !this.pendingScans) {
      throw new BadRequestError('Check-in forms are not available');
    }

    const pending = await this.pendingScans.findActiveByEventAndUser(
      input.eventId,
      input.userId,
    );
    if (!pending) {
      throw new BadRequestError(
        'No door scan is waiting for your waiver. Ask staff to scan your QR again.',
      );
    }

    const event = await this.events.getById(input.eventId);
    if (!event) throw new NotFoundError('Event');

    const user = await this.users.findById(input.userId);
    if (!user) throw new NotFoundError('User');
    if (user.status !== 'active') {
      throw new BadRequestError('Attendee account is not active');
    }

    const existing = await this.checkIns.findByEventAndUser(
      input.eventId,
      input.userId,
    );
    if (existing) {
      await this.pendingScans.deleteByEventAndUser(input.eventId, input.userId);
      return this.getMyQr(input.userId, input.eventId);
    }

    await assertCheckInWindowOpen(event, this.clientTesting);

    const activeForm = await this.checkInForms.findActiveForm(input.eventId);
    if (!activeForm || activeForm.id !== pending.formId) {
      throw new BadRequestError('No active check-in form for this event');
    }

    const submission = await this.checkInForms.saveSubmission(
      activeForm,
      input.userId,
      {
        answers: input.answers,
        signatureDataUrl: input.signatureDataUrl,
        signedName: input.signedName,
      },
    );

    try {
      const created = await this.createCheckInRecord(
        input.eventId,
        user,
        pending.scannedBy,
      );
      await this.checkInForms.linkSubmissionToCheckIn(submission.id, created.id);
      await this.pendingScans.deleteByEventAndUser(input.eventId, input.userId);
      return this.getMyQr(input.userId, input.eventId);
    } catch {
      const raced = await this.checkIns.findByEventAndUser(
        input.eventId,
        input.userId,
      );
      if (raced) {
        await this.checkInForms.linkSubmissionToCheckIn(submission.id, raced.id);
        await this.pendingScans.deleteByEventAndUser(input.eventId, input.userId);
        return this.getMyQr(input.userId, input.eventId);
      }
      throw new BadRequestError('Unable to complete check-in');
    }
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

    const { eventId, userId } = await this.resolveAttendeeIds(input);

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
      await this.pendingScans?.deleteByEventAndUser(eventId, userId);
      return this.toScanResult(existing, user, true, eventId);
    }

    await assertCheckInWindowOpen(event, this.clientTesting);

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
      await this.pendingScans?.deleteByEventAndUser(eventId, userId);
      return this.toScanResult(created, user, false, eventId);
    } catch {
      const raced = await this.checkIns.findByEventAndUser(eventId, userId);
      if (raced) {
        await this.checkInForms.linkSubmissionToCheckIn(submission.id, raced.id);
        await this.pendingScans?.deleteByEventAndUser(eventId, userId);
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

  private async resolveAttendeeIds(input: {
    token?: string;
    eventId?: string;
    userId?: string;
    expectedEventId?: string;
  }): Promise<{ eventId: string; userId: string }> {
    let eventId: string;
    let userId: string;

    if (input.token) {
      const decoded = await verifyCheckInToken(input.token, this.qrTokens);
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

  private async toIdleScanResult(
    user: NonNullable<Awaited<ReturnType<UserRepository['findById']>>>,
    eventId: string,
  ): Promise<CheckInScanResult> {
    const membership = await this.buildMembershipSummary(user, eventId, null);
    return {
      eventId,
      requiresForm: false,
      awaitingAttendeeForm: false,
      form: null,
      formSubmission: null,
      checkIn: null,
      alreadyCheckedIn: false,
      user: toPublicUser(user),
      membership,
    };
  }

  private async toFormRequiredScanResult(
    user: NonNullable<Awaited<ReturnType<UserRepository['findById']>>>,
    eventId: string,
    form: Parameters<typeof toPublicCheckInForm>[0],
    awaitingAttendeeForm: boolean,
  ): Promise<CheckInScanResult> {
    const membership = await this.buildMembershipSummary(user, eventId, null);
    return {
      eventId,
      requiresForm: true,
      awaitingAttendeeForm,
      form: toPublicCheckInForm(form),
      formSubmission: null,
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
    let form = null;
    let formSubmission = null;
    if (this.checkInForms) {
      const activeForm = await this.checkInForms.findActiveForm(eventId);
      const submission = await this.checkInForms.findSubmission(eventId, user.id);
      if (activeForm) form = toPublicCheckInForm(activeForm);
      if (submission) formSubmission = toPublicCheckInFormSubmission(submission);
    }

    return {
      eventId,
      requiresForm: false,
      awaitingAttendeeForm: false,
      form,
      formSubmission,
      checkIn: toPublicCheckIn(checkIn, toPublicUser(user)),
      alreadyCheckedIn,
      user: toPublicUser(user),
      membership: await this.buildMembershipSummary(user, eventId, checkIn),
    };
  }

  private async notifyAttendeeFormRequired(
    userId: string,
    eventName: string,
  ): Promise<void> {
    if (!this.push) return;
    try {
      await this.push.notifyUsers({
        userIds: [userId],
        title: 'Complete your check-in waiver',
        body: `Staff scanned your QR for ${eventName}. Open Check-in in the app to finish.`,
        data: {
          type: 'checkin.form_required',
          eventName,
        },
      });
    } catch {
      // Push is best-effort; polling on the QR page is the source of truth.
    }
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
