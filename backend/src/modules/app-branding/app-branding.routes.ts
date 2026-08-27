import { Router } from 'express';
import { asyncHandler } from '../../core/http/async-handler.js';
import { authenticate, authorize } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import type { AppBrandingController } from './app-branding.controller.js';
import { updateAppBrandingSchema } from './app-branding.schema.js';

export function createAppBrandingRouter(controller: AppBrandingController): Router {
  const router = Router();

  router.get('/', asyncHandler(controller.get));
  router.patch(
    '/',
    authenticate,
    authorize('admin'),
    validate({ body: updateAppBrandingSchema }),
    asyncHandler(controller.update),
  );

  return router;
}
