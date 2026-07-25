import { Router } from 'express';
import { asyncHandler } from '../../core/http/async-handler.js';
import { authenticate, authorize } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import type { UserController } from './user.controller.js';
import {
  createUserSchema,
  listUsersQuerySchema,
  updateUserSchema,
  userIdParamSchema,
} from './user.schema.js';

export function createUserRouter(controller: UserController): Router {
  const router = Router();

  router.use(authenticate, authorize('admin'));

  router.get('/stats', asyncHandler(controller.stats));

  router.get('/', validate({ query: listUsersQuerySchema }), asyncHandler(controller.list));

  router.post('/', validate({ body: createUserSchema }), asyncHandler(controller.create));

  router.get('/:id', validate({ params: userIdParamSchema }), asyncHandler(controller.getById));

  router.patch(
    '/:id',
    validate({ params: userIdParamSchema, body: updateUserSchema }),
    asyncHandler(controller.update),
  );

  router.delete('/:id', validate({ params: userIdParamSchema }), asyncHandler(controller.remove));

  return router;
}
