import { Router } from 'express';
import { asyncHandler } from '../../core/http/async-handler.js';
import { authenticate, authorize } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import type { ClientTestingController } from './client-testing.controller.js';
import { updateClientTestingSchema } from './client-testing.schema.js';

export function createClientTestingRouter(controller: ClientTestingController): Router {
  const router = Router();

  // Admin-only: temporary client testing toggle.
  router.get('/', authenticate, authorize('admin'), asyncHandler(controller.get));
  router.patch(
    '/',
    authenticate,
    authorize('admin'),
    validate({ body: updateClientTestingSchema }),
    asyncHandler(controller.update),
  );

  return router;
}
