import type { Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../../core/errors/app-error.js';
import { buildPaginationMeta, sendPaginated, sendSuccess } from '../../core/http/response.js';
import type { SponsorService } from './sponsor.service.js';
import type { CreateSponsorInput, ListSponsorsQuery, UpdateSponsorInput } from './sponsor.types.js';

export class SponsorController {
  constructor(private readonly service: SponsorService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as ListSponsorsQuery;
    const { items, total } = await this.service.list(query);
    sendPaginated(res, items, buildPaginationMeta(query.page, query.perPage, total));
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const eventId =
      typeof req.query.eventId === 'string' && req.query.eventId.trim()
        ? req.query.eventId.trim()
        : undefined;
    sendSuccess(res, await this.service.getById(req.params.id as string, eventId));
  };

  me = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth?.sponsorId) throw new ForbiddenError('No sponsor profile linked to this account');
    const eventId =
      typeof req.query.eventId === 'string' && req.query.eventId.trim()
        ? req.query.eventId.trim()
        : undefined;
    sendSuccess(res, await this.service.getById(req.auth.sponsorId, eventId));
  };

  linkedEvents = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth?.sponsorId) throw new ForbiddenError('No sponsor profile linked to this account');
    sendSuccess(res, await this.service.listLinkedEvents(req.auth.sponsorId));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.create(req.body as CreateSponsorInput), 201);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) throw new UnauthorizedError();
    const id = req.params.id as string;

    if (req.auth.role !== 'admin') {
      if (!req.auth.sponsorId || req.auth.sponsorId !== id) {
        throw new ForbiddenError('You can only update your own sponsor profile');
      }
    }

    sendSuccess(res, await this.service.update(id, req.body as UpdateSponsorInput));
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    await this.service.delete(req.params.id as string);
    res.status(204).send();
  };
}
