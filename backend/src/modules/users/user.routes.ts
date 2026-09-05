import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../core/http/async-handler.js';
import { authenticate, authorize } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import type { UserController } from './user.controller.js';
import {
  createUserSchema,
  deleteUserQuerySchema,
  listUsersQuerySchema,
  updateMyProfileSchema,
  updateUserSchema,
  upgradeMyMembershipSchema,
  userIdParamSchema,
} from './user.schema.js';

export function createUserRouter(controller: UserController): Router {
  const router = Router();

  // Self-service profile update (any authenticated role).
  router.patch(
    '/me',
    authenticate,
    validate({ body: updateMyProfileSchema }),
    asyncHandler(controller.updateMe),
  );

  router.patch(
    '/me/membership',
    authenticate,
    validate({ body: upgradeMyMembershipSchema }),
    asyncHandler(controller.upgradeMyMembership),
  );

  router.post(
    '/me/deactivate',
    authenticate,
    asyncHandler(controller.deactivateMe),
  );

  router.use(authenticate, authorize('admin'));

  router.get('/stats', asyncHandler(controller.stats));

  router.get('/', validate({ query: listUsersQuerySchema }), asyncHandler(controller.list));

  router.post('/', validate({ body: createUserSchema }), asyncHandler(controller.create));

  router.get('/:id', validate({ params: userIdParamSchema }), asyncHandler(controller.getById));

  router.get(
    '/:id/purchases',
    validate({
      params: userIdParamSchema,
      query: z.object({ eventId: z.string().uuid().optional() }),
    }),
    asyncHandler(controller.listPurchases),
  );

  router.get(
    '/:id/event-records',
    validate({ params: userIdParamSchema }),
    asyncHandler(controller.listEventRecords),
  );

  router.patch(
    '/:id',
    validate({ params: userIdParamSchema, body: updateUserSchema }),
    asyncHandler(controller.update),
  );

  router.delete(
    '/:id',
    validate({ params: userIdParamSchema, query: deleteUserQuerySchema }),
    asyncHandler(controller.remove),
  );

  return router;
}
