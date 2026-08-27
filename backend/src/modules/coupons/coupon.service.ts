import { BadRequestError, ConflictError, NotFoundError } from '../../core/errors/app-error.js';
import type { AnnouncementService } from '../announcements/announcement.service.js';
import { editionStatus } from '../events/event.mapper.js';
import type { EventService } from '../events/event.service.js';
import type { MembershipRepository } from '../memberships/membership.repository.js';
import { generateCouponCode, normalizeCouponCode, toPublicCoupon } from './coupon.mapper.js';
import type { CouponRepository, PaginatedResult } from './coupon.repository.js';
import type {
  Coupon,
  CouponPreview,
  CreateCouponInput,
  ListCouponsQuery,
  PublicCoupon,
  UpdateCouponInput,
} from './coupon.types.js';

export class CouponService {
  constructor(
    private readonly coupons: CouponRepository,
    private readonly memberships: MembershipRepository,
    private readonly events: EventService,
    private readonly announcements?: AnnouncementService,
  ) {}

  async list(query: ListCouponsQuery): Promise<PaginatedResult<PublicCoupon>> {
    const { items, total } = await this.coupons.list(query);
    return { items: items.map(toPublicCoupon), total };
  }

  async getById(id: string): Promise<PublicCoupon> {
    return toPublicCoupon(await this.requireCoupon(id));
  }

  async create(input: CreateCouponInput): Promise<PublicCoupon> {
    const eventId = await this.requireNonEndedEventId(input.eventId);
    const discounts = await this.normalizeDiscounts(input.membershipDiscounts, eventId);
    let code = normalizeCouponCode(input.code?.trim() || generateCouponCode());
    if (await this.coupons.findByCode(code)) {
      if (input.code?.trim()) {
        throw new ConflictError('A coupon with this code already exists');
      }
      code = normalizeCouponCode(generateCouponCode(10));
      if (await this.coupons.findByCode(code)) {
        throw new ConflictError('Unable to generate a unique coupon code — try again');
      }
    }

    const created = await this.coupons.create({
      eventId,
      code,
      name: input.name.trim(),
      description: input.description?.trim() ?? '',
      active: input.active ?? true,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      maxRedemptions: input.maxRedemptions ?? 0,
      redemptionCount: 0,
      membershipDiscounts: discounts,
    });
    return toPublicCoupon(created);
  }

  async update(id: string, input: UpdateCouponInput): Promise<PublicCoupon> {
    const existing = await this.requireCoupon(id);

    let code: string | undefined;
    if (input.code !== undefined) {
      code = normalizeCouponCode(input.code);
      const existingByCode = await this.coupons.findByCode(code);
      if (existingByCode && existingByCode.id !== id) {
        throw new ConflictError('A coupon with this code already exists');
      }
    }

    const eventId =
      input.eventId !== undefined
        ? await this.requireNonEndedEventId(input.eventId)
        : await this.requireNonEndedEventId(existing.eventId);

    const membershipDiscounts =
      input.membershipDiscounts !== undefined
        ? await this.normalizeDiscounts(input.membershipDiscounts, eventId)
        : input.eventId !== undefined
          ? await this.normalizeDiscounts(existing.membershipDiscounts ?? [], eventId)
          : undefined;

    const updated = await this.coupons.update(id, {
      ...(input.eventId !== undefined ? { eventId } : {}),
      ...(code !== undefined ? { code } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description.trim() } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.expiresAt !== undefined
        ? { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null }
        : {}),
      ...(input.maxRedemptions !== undefined ? { maxRedemptions: input.maxRedemptions } : {}),
      ...(membershipDiscounts !== undefined ? { membershipDiscounts } : {}),
    });
    if (!updated) throw new NotFoundError('Coupon');
    return toPublicCoupon(updated);
  }

  async delete(id: string): Promise<void> {
    if (!(await this.coupons.delete(id))) {
      throw new NotFoundError('Coupon');
    }
  }

  async preview(code: string, membershipId: string): Promise<CouponPreview> {
    const membership = await this.memberships.findById(membershipId);
    if (!membership) {
      return {
        valid: false,
        reason: 'Membership not found',
        code: normalizeCouponCode(code),
        couponId: null,
        membershipId,
        originalPrice: 0,
        percentOff: 0,
        discountAmount: 0,
        finalPrice: 0,
      };
    }

    try {
      const applied = await this.applyCoupon(code, membership.id, membership.price);
      return {
        valid: true,
        reason: null,
        code: applied.code,
        couponId: applied.couponId,
        membershipId: membership.id,
        originalPrice: applied.originalPrice,
        percentOff: applied.percentOff,
        discountAmount: applied.discountAmount,
        finalPrice: applied.finalPrice,
      };
    } catch (error) {
      const reason =
        error instanceof BadRequestError || error instanceof ConflictError
          ? error.message
          : 'Invalid coupon code';
      return {
        valid: false,
        reason,
        code: normalizeCouponCode(code),
        couponId: null,
        membershipId: membership.id,
        originalPrice: membership.price,
        percentOff: 0,
        discountAmount: 0,
        finalPrice: membership.price,
      };
    }
  }

  async applyCoupon(
    code: string,
    membershipId: string,
    originalPrice: number,
  ): Promise<{
    couponId: string;
    code: string;
    percentOff: number;
    originalPrice: number;
    discountAmount: number;
    finalPrice: number;
  }> {
    const normalized = normalizeCouponCode(code);
    if (!normalized) throw new BadRequestError('Coupon code is required');

    const coupon = await this.coupons.findByCode(normalized);
    if (!coupon || !coupon.active) {
      throw new BadRequestError('This coupon code is not valid');
    }
    if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
      throw new BadRequestError('This coupon code has expired');
    }
    if (coupon.maxRedemptions > 0 && coupon.redemptionCount >= coupon.maxRedemptions) {
      throw new BadRequestError('This coupon code has reached its redemption limit');
    }

    const membership = await this.memberships.findById(membershipId);
    if (!membership) {
      throw new BadRequestError('Membership not found');
    }
    if (coupon.eventId && coupon.eventId !== membership.eventId) {
      throw new BadRequestError('This coupon is not valid for the selected membership');
    }

    const discount = (coupon.membershipDiscounts ?? []).find(
      (item) => item.membershipId === membershipId,
    );
    if (!discount) {
      throw new BadRequestError('This coupon is not valid for the selected membership');
    }

    const percentOff = Math.min(100, Math.max(1, discount.percentOff));
    const discountAmount = Math.round(originalPrice * percentOff) / 100;
    const finalPrice = Math.max(0, Math.round((originalPrice - discountAmount) * 100) / 100);

    return {
      couponId: coupon.id,
      code: coupon.code,
      percentOff,
      originalPrice,
      discountAmount,
      finalPrice,
    };
  }

  async recordRedemption(couponId: string): Promise<void> {
    await this.coupons.incrementRedemption(couponId);
  }

  async sendAsAnnouncement(
    id: string,
    input: {
      title?: string;
      message?: string;
      sendPush?: boolean;
      audienceType?: 'all' | 'roles' | 'users';
      audienceRoles?: Array<'member' | 'speaker' | 'sponsor' | 'admin'>;
      audienceUserIds?: string[];
    },
  ): Promise<{ announcementId: string; code: string }> {
    if (!this.announcements) {
      throw new BadRequestError('Announcements are not available');
    }
    const coupon = await this.requireCoupon(id);
    if (!coupon.active) {
      throw new BadRequestError('Activate the coupon before sending it');
    }

    const remaining =
      coupon.maxRedemptions > 0
        ? Math.max(0, coupon.maxRedemptions - (coupon.redemptionCount ?? 0))
        : null;
    if (remaining === 0) {
      throw new BadRequestError('This coupon has no redemptions left');
    }

    const audienceType = input.audienceType ?? 'all';
    const audienceUserIds = input.audienceUserIds ?? [];

    if (remaining !== null) {
      if (audienceType === 'all') {
        throw new BadRequestError(
          remaining === 1
            ? 'This coupon is for one-time use — select 1 attendee instead of all'
            : `This coupon has ${remaining} uses left — select specific attendees (max ${remaining})`,
        );
      }
      if (audienceType === 'users') {
        if (audienceUserIds.length === 0) {
          throw new BadRequestError('Select at least one attendee');
        }
        if (audienceUserIds.length > remaining) {
          throw new BadRequestError(
            remaining === 1
              ? 'This coupon is for one-time use — 2 attendees cannot use it'
              : `This coupon has ${remaining} uses left — you can notify at most ${remaining} attendees`,
          );
        }
      }
    }

    const title = input.title?.trim() || `Coupon: ${coupon.code}`;
    const message =
      input.message?.trim() ||
      `Use code ${coupon.code} at checkout for a membership discount.${
        coupon.description ? ` ${coupon.description}` : ''
      }`;

    const announcement = await this.announcements.create({
      title,
      description: message,
      delivery: 'immediate',
      audienceType,
      audienceRoles: input.audienceRoles,
      audienceUserIds: audienceType === 'users' ? audienceUserIds : input.audienceUserIds,
      sendPush: input.sendPush ?? true,
    });

    return { announcementId: announcement.id, code: coupon.code };
  }

  private async requireNonEndedEventId(eventId: string | undefined): Promise<string> {
    const id = eventId?.trim() ?? '';
    if (!id) {
      throw new BadRequestError('Event is required');
    }
    const event = await this.events.requireEvent(id);
    if (editionStatus(event) === 'ended') {
      throw new BadRequestError('Coupons cannot be created or updated for past events');
    }
    return event.id;
  }

  private async normalizeDiscounts(
    discounts: Array<{ membershipId: string; percentOff: number }>,
    eventId: string,
  ) {
    if (!discounts.length) {
      throw new BadRequestError('Add at least one membership discount');
    }
    const seen = new Set<string>();
    const normalized = [];
    for (const item of discounts) {
      if (seen.has(item.membershipId)) {
        throw new BadRequestError('Duplicate membership in coupon discounts');
      }
      seen.add(item.membershipId);
      const membership = await this.memberships.findById(item.membershipId);
      if (!membership) {
        throw new BadRequestError('Selected membership was not found');
      }
      if (membership.eventId !== eventId) {
        throw new BadRequestError('Membership does not belong to the selected event');
      }
      const percentOff = Math.round(item.percentOff);
      if (percentOff < 1 || percentOff > 100) {
        throw new BadRequestError('Discount percent must be between 1 and 100');
      }
      normalized.push({ membershipId: item.membershipId, percentOff });
    }
    return normalized;
  }

  private async requireCoupon(id: string): Promise<Coupon> {
    const coupon = await this.coupons.findById(id);
    if (!coupon) throw new NotFoundError('Coupon');
    return coupon;
  }
}
