import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../core/errors/app-error.js';
import { buildPaginationMeta, sendPaginated, sendSuccess } from '../../core/http/response.js';
import type { PostService } from './post.service.js';
import type {
  CreatePostCommentInput,
  CreatePostInput,
  ListPostCommentsQuery,
  ListPostsQuery,
  UpdatePostCommentInput,
  UpdatePostInput,
} from './post.types.js';

export class PostController {
  constructor(private readonly service: PostService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as ListPostsQuery;
    const { items, total } = await this.service.list(query, req.auth?.userId);
    sendPaginated(res, items, buildPaginationMeta(query.page, query.perPage, total));
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      await this.service.getById(req.params.id as string, req.auth?.userId),
    );
  };

  create = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) throw new UnauthorizedError();
    sendSuccess(
      res,
      await this.service.create(req.auth.userId, req.body as CreatePostInput),
      201,
    );
  };

  update = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) throw new UnauthorizedError();
    sendSuccess(
      res,
      await this.service.update(
        req.params.id as string,
        req.body as UpdatePostInput,
        req.auth.userId,
      ),
    );
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    await this.service.delete(req.params.id as string);
    res.status(204).send();
  };

  like = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) throw new UnauthorizedError();
    sendSuccess(res, await this.service.like(req.params.id as string, req.auth.userId));
  };

  unlike = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) throw new UnauthorizedError();
    sendSuccess(res, await this.service.unlike(req.params.id as string, req.auth.userId));
  };

  listComments = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as ListPostCommentsQuery;
    const { items, total } = await this.service.listComments(req.params.id as string, query);
    sendPaginated(res, items, buildPaginationMeta(query.page, query.perPage, total));
  };

  addComment = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) throw new UnauthorizedError();
    sendSuccess(
      res,
      await this.service.addComment(
        req.params.id as string,
        req.auth.userId,
        req.body as CreatePostCommentInput,
      ),
      201,
    );
  };

  updateComment = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) throw new UnauthorizedError();
    sendSuccess(
      res,
      await this.service.updateComment(
        req.params.id as string,
        req.params.commentId as string,
        { userId: req.auth.userId, role: req.auth.role },
        req.body as UpdatePostCommentInput,
      ),
    );
  };

  removeComment = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) throw new UnauthorizedError();
    await this.service.deleteComment(req.params.id as string, req.params.commentId as string, {
      userId: req.auth.userId,
      role: req.auth.role,
    });
    res.status(204).send();
  };
}
