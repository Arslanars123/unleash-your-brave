import { Router } from 'express';
import { asyncHandler } from '../../core/http/async-handler.js';
import { authenticate, authorize } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import type { AnnouncementController } from './announcement.controller.js';
import {
  announcementIdParamSchema,
  createAnnouncementSchema,
  listAnnouncementsQuerySchema,
  updateAnnouncementSchema,
} from './announcement.schema.js';

export function createAnnouncementRouter(controller: AnnouncementController): Router {
  const router = Router();

  router.get(
    '/',
    validate({ query: listAnnouncementsQuerySchema }),
    asyncHandler(controller.list),
  );

  router.get(
    '/:id',
    validate({ params: announcementIdParamSchema }),
    asyncHandler(controller.getById),
  );

  router.post(
    '/',
    authenticate,
    authorize('admin'),
    validate({ body: createAnnouncementSchema }),
    asyncHandler(controller.create),
  );

  router.patch(
    '/:id',
    authenticate,
    authorize('admin'),
    validate({ params: announcementIdParamSchema, body: updateAnnouncementSchema }),
    asyncHandler(controller.update),
  );

  router.delete(
    '/:id',
    authenticate,
    authorize('admin'),
    validate({ params: announcementIdParamSchema }),
    asyncHandler(controller.remove),
  );

  return router;
}
