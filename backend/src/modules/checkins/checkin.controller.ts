import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../core/errors/app-error.js';
import { buildPaginationMeta, sendPaginated, sendSuccess } from '../../core/http/response.js';
import type { CheckInService } from './checkin.service.js';
import type { ListCheckInsQuery } from './checkin.types.js';

export class CheckInController {
  constructor(private readonly service: CheckInService) {}

  myQr = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) throw new UnauthorizedError();
    const eventId =
      typeof req.query.eventId === 'string' ? req.query.eventId : undefined;
    sendSuccess(res, await this.service.getMyQr(req.auth.userId, eventId));
  };

  scan = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) throw new UnauthorizedError();
    const body = req.body as {
      token?: string;
      eventId?: string;
      userId?: string;
      expectedEventId?: string;
    };
    sendSuccess(
      res,
      await this.service.scan({
        token: body.token,
        eventId: body.eventId,
        userId: body.userId,
        expectedEventId: body.expectedEventId,
        adminUserId: req.auth.userId,
      }),
    );
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as ListCheckInsQuery;
    const result = await this.service.list(query);
    sendPaginated(res, result.items, {
      ...buildPaginationMeta(query.page, query.perPage, result.total),
      stats: result.stats,
    });
  };

  stats = async (req: Request, res: Response): Promise<void> => {
    const eventId = String(req.query.eventId ?? '');
    sendSuccess(res, await this.service.stats(eventId));
  };
}
