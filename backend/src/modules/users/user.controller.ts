import type { Request, Response } from 'express';
import { buildPaginationMeta, sendPaginated, sendSuccess } from '../../core/http/response.js';
import type { UserService } from './user.service.js';
import type { CreateUserInput, ListUsersQuery, UpdateUserInput } from './user.types.js';

export class UserController {
  constructor(private readonly service: UserService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as ListUsersQuery;
    const { items, total } = await this.service.list(query);
    sendPaginated(res, items, buildPaginationMeta(query.page, query.perPage, total));
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.getById(req.params.id as string));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.create(req.body as CreateUserInput), 201);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.update(req.params.id as string, req.body as UpdateUserInput));
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    await this.service.delete(req.params.id as string);
    res.status(204).send();
  };

  stats = async (_req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.getStats());
  };
}
