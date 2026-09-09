import { Router } from 'express';
import { asyncHandler } from '../../core/http/async-handler.js';
import { authenticate, authorize } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import type { TeamMemberController } from './team-member.controller.js';
import {
  createTeamMemberSchema,
  listTeamMembersQuerySchema,
  teamMemberIdParamSchema,
  updateTeamMemberSchema,
} from './team-member.schema.js';

export function createTeamMemberRouter(controller: TeamMemberController): Router {
  const router = Router();

  router.use(authenticate, authorize('admin'));

  router.get(
    '/',
    validate({ query: listTeamMembersQuerySchema }),
    asyncHandler(controller.list),
  );

  router.post(
    '/',
    validate({ body: createTeamMemberSchema }),
    asyncHandler(controller.create),
  );

  router.get(
    '/:id',
    validate({ params: teamMemberIdParamSchema }),
    asyncHandler(controller.getById),
  );

  router.patch(
    '/:id',
    validate({ params: teamMemberIdParamSchema, body: updateTeamMemberSchema }),
    asyncHandler(controller.update),
  );

  router.delete(
    '/:id',
    validate({ params: teamMemberIdParamSchema }),
    asyncHandler(controller.remove),
  );

  router.post(
    '/:id/reinvite',
    validate({ params: teamMemberIdParamSchema }),
    asyncHandler(controller.reinvite),
  );

  return router;
}
