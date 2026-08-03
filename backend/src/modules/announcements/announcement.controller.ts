import type { Request, Response } from 'express';
import { buildPaginationMeta, sendPaginated, sendSuccess } from '../../core/http/response.js';
import type { AnnouncementService } from './announcement.service.js';
import type {
  CreateAnnouncementInput,
  ListAnnouncementsQuery,
  UpdateAnnouncementInput,
} from './announcement.types.js';

export class AnnouncementController {
  constructor(private readonly service: AnnouncementService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as ListAnnouncementsQuery;
    const { items, total } = await this.service.list(query);
    sendPaginated(res, items, buildPaginationMeta(query.page, query.perPage, total));
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.getById(req.params.id as string));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.create(req.body as CreateAnnouncementInput), 201);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      await this.service.update(req.params.id as string, req.body as UpdateAnnouncementInput),
    );
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    await this.service.delete(req.params.id as string);
    res.status(204).send();
  };
}
