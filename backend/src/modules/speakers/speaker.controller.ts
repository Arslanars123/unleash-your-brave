import type { Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../../core/errors/app-error.js';
import { buildPaginationMeta, sendPaginated, sendSuccess } from '../../core/http/response.js';
import type { SpeakerService } from './speaker.service.js';
import type { CreateSpeakerInput, ListSpeakersQuery, UpdateSpeakerInput } from './speaker.types.js';

export class SpeakerController {
  constructor(private readonly service: SpeakerService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as ListSpeakersQuery;
    const { items, total } = await this.service.list(query);
    sendPaginated(res, items, buildPaginationMeta(query.page, query.perPage, total));
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.getById(req.params.id as string));
  };

  me = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth?.speakerId) throw new ForbiddenError('No speaker profile linked to this account');
    sendSuccess(res, await this.service.getById(req.auth.speakerId));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.create(req.body as CreateSpeakerInput), 201);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) throw new UnauthorizedError();
    const id = req.params.id as string;

    if (req.auth.role === 'speaker') {
      if (!req.auth.speakerId || req.auth.speakerId !== id) {
        throw new ForbiddenError('You can only update your own speaker profile');
      }
    }

    sendSuccess(res, await this.service.update(id, req.body as UpdateSpeakerInput));
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    await this.service.delete(req.params.id as string);
    res.status(204).send();
  };
}
