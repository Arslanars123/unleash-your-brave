import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../core/errors/app-error.js';
import { buildPaginationMeta, sendPaginated, sendSuccess } from '../../../core/http/response.js';
import type { SessionFeedbackService } from './session-feedback.service.js';
import type {
  ListSessionFeedbackQuery,
  UpdateSessionFeedbackInput,
  UpsertSessionFeedbackInput,
} from './session-feedback.types.js';

export class SessionFeedbackController {
  constructor(private readonly service: SessionFeedbackService) {}

  summary = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.getSummary(req.params.id as string));
  };

  list = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) throw new UnauthorizedError();
    const sessionId = req.params.id as string;

    if (req.auth.speakerId) {
      await this.service.assertSpeakerOwnsSession(sessionId, req.auth.speakerId);
    }

    const query = req.query as unknown as ListSessionFeedbackQuery;
    const { items, total } = await this.service.list(sessionId, query);

    // Attendees can read reviews, but never other people's emails.
    const redactEmail = req.auth.role === 'member';
    const payload = redactEmail
      ? items.map((item) => ({
          ...item,
          user: item.user
            ? { id: item.user.id, name: item.user.name, email: '' }
            : null,
        }))
      : items;

    sendPaginated(res, payload, buildPaginationMeta(query.page, query.perPage, total));
  };

  mine = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) throw new UnauthorizedError();
    sendSuccess(res, await this.service.getMine(req.params.id as string, req.auth.userId));
  };

  upsert = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) throw new UnauthorizedError();
    const created = await this.service.upsert(
      req.params.id as string,
      req.auth.userId,
      req.body as UpsertSessionFeedbackInput,
    );
    sendSuccess(res, created, 200);
  };

  removeMine = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) throw new UnauthorizedError();
    await this.service.deleteMine(req.params.id as string, req.auth.userId);
    res.status(204).send();
  };

  updateById = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      await this.service.updateById(
        req.params.id as string,
        req.params.feedbackId as string,
        req.body as UpdateSessionFeedbackInput,
      ),
    );
  };

  removeById = async (req: Request, res: Response): Promise<void> => {
    await this.service.deleteById(req.params.id as string, req.params.feedbackId as string);
    res.status(204).send();
  };
}
