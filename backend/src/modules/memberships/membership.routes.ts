import { Router } from 'express';
import { asyncHandler } from '../../core/http/async-handler.js';
import { authenticate, authorize } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import type { MembershipController } from './membership.controller.js';
import {
  createMembershipSchema,
  listMembershipsQuerySchema,
  membershipIdParamSchema,
  updateMembershipSchema,
} from './membership.schema.js';

export function createMembershipRouter(controller: MembershipController): Router {
  const router = Router();

  router.get(
    '/',
    validate({ query: listMembershipsQuerySchema }),
    asyncHandler(controller.list),
  );

  router.get(
    '/:id',
    validate({ params: membershipIdParamSchema }),
    asyncHandler(controller.getById),
  );

  router.post(
    '/',
    authenticate,
    authorize('admin'),
    validate({ body: createMembershipSchema }),
    asyncHandler(controller.create),
  );

  router.patch(
    '/:id',
    authenticate,
    authorize('admin'),
    validate({ params: membershipIdParamSchema, body: updateMembershipSchema }),
    asyncHandler(controller.update),
  );

  router.delete(
    '/:id',
    authenticate,
    authorize('admin'),
    validate({ params: membershipIdParamSchema }),
    asyncHandler(controller.remove),
  );

  return router;
}
