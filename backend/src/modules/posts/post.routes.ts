import { Router } from 'express';
import { asyncHandler } from '../../core/http/async-handler.js';
import { authenticate, authorize, optionalAuthenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import type { PostController } from './post.controller.js';
import {
  createPostCommentSchema,
  createPostSchema,
  listPostCommentsQuerySchema,
  listPostsQuerySchema,
  postCommentParamSchema,
  postIdParamSchema,
  updatePostCommentSchema,
  updatePostSchema,
} from './post.schema.js';

export function createPostRouter(controller: PostController): Router {
  const router = Router();

  router.get(
    '/',
    optionalAuthenticate,
    validate({ query: listPostsQuerySchema }),
    asyncHandler(controller.list),
  );

  router.get(
    '/:id/comments',
    validate({ params: postIdParamSchema, query: listPostCommentsQuerySchema }),
    asyncHandler(controller.listComments),
  );

  router.get(
    '/:id',
    optionalAuthenticate,
    validate({ params: postIdParamSchema }),
    asyncHandler(controller.getById),
  );

  router.post(
    '/',
    authenticate,
    authorize('admin'),
    validate({ body: createPostSchema }),
    asyncHandler(controller.create),
  );

  router.patch(
    '/:id',
    authenticate,
    authorize('admin'),
    validate({ params: postIdParamSchema, body: updatePostSchema }),
    asyncHandler(controller.update),
  );

  router.delete(
    '/:id',
    authenticate,
    authorize('admin'),
    validate({ params: postIdParamSchema }),
    asyncHandler(controller.remove),
  );

  router.post(
    '/:id/likes',
    authenticate,
    authorize('member', 'admin', 'speaker', 'sponsor'),
    validate({ params: postIdParamSchema }),
    asyncHandler(controller.like),
  );

  router.delete(
    '/:id/likes',
    authenticate,
    authorize('member', 'admin', 'speaker', 'sponsor'),
    validate({ params: postIdParamSchema }),
    asyncHandler(controller.unlike),
  );

  router.post(
    '/:id/comments',
    authenticate,
    authorize('member', 'admin', 'speaker', 'sponsor'),
    validate({ params: postIdParamSchema, body: createPostCommentSchema }),
    asyncHandler(controller.addComment),
  );

  router.patch(
    '/:id/comments/:commentId',
    authenticate,
    authorize('member', 'admin', 'speaker', 'sponsor'),
    validate({ params: postCommentParamSchema, body: updatePostCommentSchema }),
    asyncHandler(controller.updateComment),
  );

  router.delete(
    '/:id/comments/:commentId',
    authenticate,
    authorize('member', 'admin', 'speaker', 'sponsor'),
    validate({ params: postCommentParamSchema }),
    asyncHandler(controller.removeComment),
  );

  return router;
}
