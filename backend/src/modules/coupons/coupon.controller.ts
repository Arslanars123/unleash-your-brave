import type { Request, Response } from 'express';
import { buildPaginationMeta, sendPaginated, sendSuccess } from '../../core/http/response.js';
import type { CouponService } from './coupon.service.js';
import type {
  CreateCouponInput,
  ListCouponsQuery,
  UpdateCouponInput,
} from './coupon.types.js';

export class CouponController {
  constructor(private readonly service: CouponService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as ListCouponsQuery;
    const { items, total } = await this.service.list(query);
    sendPaginated(res, items, buildPaginationMeta(query.page, query.perPage, total));
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.getById(req.params.id as string));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.create(req.body as CreateCouponInput), 201);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      await this.service.update(req.params.id as string, req.body as UpdateCouponInput),
    );
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    await this.service.delete(req.params.id as string);
    res.status(204).send();
  };

  preview = async (req: Request, res: Response): Promise<void> => {
    const { code, membershipId } = req.body as { code: string; membershipId: string };
    sendSuccess(res, await this.service.preview(code, membershipId));
  };

  send = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      await this.service.sendAsAnnouncement(req.params.id as string, req.body ?? {}),
    );
  };
}
