import type { Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../../core/errors/app-error.js';
import { buildPaginationMeta, sendPaginated, sendSuccess } from '../../core/http/response.js';
import type { SessionService, SessionViewerContext } from './session.service.js';
import type { CreateSessionInput, ListSessionsQuery, UpdateSessionInput } from './session.types.js';

function viewerFromRequest(req: Request): SessionViewerContext | undefined {
  if (!req.auth) return undefined;
  return {
    userId: req.auth.userId,
    role: req.auth.role,
    speakerId: req.auth.speakerId ?? null,
  };
}

export class SessionController {
  constructor(private readonly service: SessionService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as ListSessionsQuery;
    const { items, total } = await this.service.list(query, viewerFromRequest(req));
    sendPaginated(res, items, buildPaginationMeta(query.page, query.perPage, total));
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.getById(req.params.id as string, viewerFromRequest(req)));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.create(req.body as CreateSessionInput), 201);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) throw new UnauthorizedError();
    const id = req.params.id as string;
    const input = req.body as UpdateSessionInput;

    if (req.auth.role !== 'admin' && req.auth.speakerId) {
      const session = await this.service.getById(id);
      if (session.speakerId !== req.auth.speakerId) {
        throw new ForbiddenError('You can only update sessions assigned to you');
      }
      sendSuccess(
        res,
        await this.service.update(id, {
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.materials !== undefined ? { materials: input.materials } : {}),
        }),
      );
      return;
    }

    sendSuccess(res, await this.service.update(id, input));
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    await this.service.delete(req.params.id as string);
    res.status(204).send();
  };
}
