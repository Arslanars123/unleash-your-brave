import type { Request, Response } from 'express';
import { buildPaginationMeta, sendPaginated, sendSuccess } from '../../core/http/response.js';
import type { FeedbackService } from './feedback.service.js';
import type { CreateFeedbackInput, ListFeedbackQuery } from './feedback.types.js';

export class FeedbackController {
  constructor(private readonly service: FeedbackService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as ListFeedbackQuery;
    const { items, total } = await this.service.list(query);
    sendPaginated(res, items, buildPaginationMeta(query.page, query.perPage, total));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.create(req.body as CreateFeedbackInput), 201);
  };
}
