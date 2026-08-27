import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../core/errors/app-error.js';
import { buildPaginationMeta, sendPaginated, sendSuccess } from '../../core/http/response.js';
import type { AnnouncementService } from './announcement.service.js';
import type {
  CreateAnnouncementInput,
  ListAnnouncementsQuery,
  ListFeedQuery,
  UpdateAnnouncementInput,
  UpdateCountdownSettingsInput,
} from './announcement.types.js';

export class AnnouncementController {
  constructor(private readonly service: AnnouncementService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as ListAnnouncementsQuery;
    const { items, total } = await this.service.list(query);
    sendPaginated(res, items, buildPaginationMeta(query.page, query.perPage, total));
  };

  feed = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) throw new UnauthorizedError();
    const query = req.query as unknown as ListFeedQuery;
    const result = await this.service.getFeed(
      {
        id: req.auth.userId,
        role: req.auth.role,
        speakerId: req.auth.speakerId,
        sponsorId: req.auth.sponsorId,
      },
      query,
    );
    sendPaginated(res, result.items, {
      ...buildPaginationMeta(query.page, query.perPage, result.total),
      unreadCount: result.unreadCount,
    });
  };

  unreadCount = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) throw new UnauthorizedError();
    sendSuccess(res, {
      count: await this.service.getUnreadCount({
        id: req.auth.userId,
        role: req.auth.role,
        speakerId: req.auth.speakerId,
        sponsorId: req.auth.sponsorId,
      }),
    });
  };

  markRead = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) throw new UnauthorizedError();
    sendSuccess(
      res,
      await this.service.markRead(req.params.id as string, {
        id: req.auth.userId,
        role: req.auth.role,
        speakerId: req.auth.speakerId,
        sponsorId: req.auth.sponsorId,
      }),
    );
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

  getCountdownSettings = async (_req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.getCountdownSettings());
  };

  updateCountdownSettings = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      await this.service.updateCountdownSettings(req.body as UpdateCountdownSettingsInput),
    );
  };
}
