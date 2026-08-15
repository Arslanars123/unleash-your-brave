import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../core/errors/app-error.js';
import { buildPaginationMeta, sendPaginated, sendSuccess } from '../../core/http/response.js';
import type { CheckoutService } from '../checkout/checkout.service.js';
import type { UserService } from './user.service.js';
import type { CreateUserInput, ListUsersQuery, UpdateUserInput } from './user.types.js';

export class UserController {
  constructor(
    private readonly service: UserService,
    private readonly checkout: CheckoutService,
  ) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as ListUsersQuery;
    const { items, total } = await this.service.list(query);
    sendPaginated(res, items, buildPaginationMeta(query.page, query.perPage, total));
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.getById(req.params.id as string));
  };

  listPurchases = async (req: Request, res: Response): Promise<void> => {
    const userId = req.params.id as string;
    await this.service.getById(userId);
    sendSuccess(res, await this.checkout.getAttendeePurchaseSummary(userId));
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
}
