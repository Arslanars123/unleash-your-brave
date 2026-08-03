import { Router } from 'express';
import { asyncHandler } from '../../core/http/async-handler.js';
import { authenticate, authorize } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import type { SponsorController } from './sponsor.controller.js';
import {
  createSponsorSchema,
  listSponsorsQuerySchema,
  sponsorIdParamSchema,
  updateSponsorSchema,
} from './sponsor.schema.js';

export function createSponsorRouter(controller: SponsorController): Router {
  const router = Router();

  router.get('/', validate({ query: listSponsorsQuerySchema }), asyncHandler(controller.list));

  router.get('/me', authenticate, authorize('sponsor'), asyncHandler(controller.me));

  router.get('/:id', validate({ params: sponsorIdParamSchema }), asyncHandler(controller.getById));

  router.post(
    '/',
    authenticate,
    authorize('admin'),
    validate({ body: createSponsorSchema }),
    asyncHandler(controller.create),
  );

  router.patch(
    '/:id',
    authenticate,
    authorize('admin', 'sponsor'),
    validate({ params: sponsorIdParamSchema, body: updateSponsorSchema }),
    asyncHandler(controller.update),
  );

  router.delete(
    '/:id',
    authenticate,
    authorize('admin'),
    validate({ params: sponsorIdParamSchema }),
    asyncHandler(controller.remove),
  );

  return router;
}
