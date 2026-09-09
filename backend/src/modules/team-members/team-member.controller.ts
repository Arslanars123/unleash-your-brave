import type { Request, Response } from 'express';
import { buildPaginationMeta, sendPaginated, sendSuccess } from '../../core/http/response.js';
import type { TeamMemberService } from './team-member.service.js';
import type {
  CreateTeamMemberInput,
  ListTeamMembersQuery,
  UpdateTeamMemberInput,
} from './team-member.types.js';

export class TeamMemberController {
  constructor(private readonly service: TeamMemberService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as ListTeamMembersQuery;
    const { items, total } = await this.service.list(query);
    sendPaginated(res, items, buildPaginationMeta(query.page, query.perPage, total));
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.getById(req.params.id as string));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.create(req.body as CreateTeamMemberInput), 201);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      await this.service.update(req.params.id as string, req.body as UpdateTeamMemberInput),
    );
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    await this.service.remove(req.params.id as string);
    res.status(204).send();
  };

  reinvite = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.reinvite(req.params.id as string));
  };
}
