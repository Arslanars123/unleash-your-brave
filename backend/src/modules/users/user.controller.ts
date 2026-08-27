import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../core/errors/app-error.js';
import { buildPaginationMeta, sendPaginated, sendSuccess } from '../../core/http/response.js';
import type { CheckoutService } from '../checkout/checkout.service.js';
import type { StoreCheckoutService } from '../store/store-checkout.service.js';
import type { UserService } from './user.service.js';
import type { CreateUserInput, ListUsersQuery, UpdateUserInput } from './user.types.js';

export class UserController {
  constructor(
    private readonly service: UserService,
    private readonly checkout: CheckoutService,
    private readonly storeCheckout: StoreCheckoutService,
  ) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const query = { ...(req.query as unknown as ListUsersQuery) };
    if (query.eventId) {
      const filter = query.eventPurchaseFilter ?? 'purchasers';
      if (filter === 'purchasers') {
        query.userIds = await this.resolveAttendeeIdsForEvent(query.eventId);
      } else if (filter === 'without_purchase') {
        // Membership purchasers only — coupons target people who have not bought a pass yet.
        query.excludeUserIds = await this.checkout.listPaidPurchaserIdsForEvent(query.eventId);
      }
      // filter === 'all': no purchase-based id filtering
    }
    const { items, total } = await this.service.list(query);
    sendPaginated(res, items, buildPaginationMeta(query.page, query.perPage, total));
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.getById(req.params.id as string));
  };

  listPurchases = async (req: Request, res: Response): Promise<void> => {
    const userId = req.params.id as string;
    await this.service.getById(userId);
    const eventId =
      typeof req.query.eventId === 'string' && req.query.eventId.trim()
        ? req.query.eventId.trim()
        : undefined;
    sendSuccess(res, await this.checkout.getAttendeePurchaseSummary(userId, eventId));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.create(req.body as CreateUserInput), 201);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.update(req.params.id as string, req.body as UpdateUserInput));
  };

  updateMe = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth?.userId) {
      throw new UnauthorizedError('Authentication required');
    }
    sendSuccess(res, await this.service.update(req.auth.userId, req.body as UpdateUserInput));
  };

  upgradeMyMembership = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth?.userId) {
      throw new UnauthorizedError('Authentication required');
    }
    const body = req.body as { membershipId: string };
    sendSuccess(res, await this.service.upgradeMyMembership(req.auth.userId, body.membershipId));
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    await this.service.delete(req.params.id as string);
    res.status(204).send();
  };

  stats = async (_req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.getStats());
  };

  /**
   * Attendees for an edition = paid membership purchasers + paid store buyers
   * for that edition only. Do not include “current plan holders” — shared
   * membership tiers are linked to multiple editions, so that incorrectly
   * pulls in purchasers from other events.
   */
  private async resolveAttendeeIdsForEvent(eventId: string): Promise<string[]> {
    const [purchasers, buyers] = await Promise.all([
      this.checkout.listPaidPurchaserIdsForEvent(eventId),
      this.storeCheckout.listPaidBuyerIdsForEvent(eventId),
    ]);
    return [...new Set([...purchasers, ...buyers])];
  }
}
