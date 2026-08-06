import { Router } from 'express';
import { asyncHandler } from '../../core/http/async-handler.js';
import { authenticate, authorize } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import type { AnnouncementController } from './announcement.controller.js';
import {
  announcementIdParamSchema,
  createAnnouncementSchema,
  listAnnouncementsQuerySchema,
  listFeedQuerySchema,
  updateAnnouncementSchema,
  updateCountdownSettingsSchema,
} from './announcement.schema.js';

export function createAnnouncementRouter(controller: AnnouncementController): Router {
  const router = Router();

  // Attendee feed (must be registered before /:id)
  router.get(
    '/feed',
    authenticate,
    validate({ query: listFeedQuerySchema }),
    asyncHandler(controller.feed),
  );
  router.get('/unread-count', authenticate, asyncHandler(controller.unreadCount));
  router.post(
    '/:id/read',
    authenticate,
    validate({ params: announcementIdParamSchema }),
    asyncHandler(controller.markRead),
  );

  // Countdown automation settings (admin)
  router.get(
    '/countdown-settings',
    authenticate,
    authorize('admin'),
    asyncHandler(controller.getCountdownSettings),
  );
  router.patch(
    '/countdown-settings',
    authenticate,
    authorize('admin'),
    validate({ body: updateCountdownSettingsSchema }),
    asyncHandler(controller.updateCountdownSettings),
  );

  router.get(
    '/',
    authenticate,
    authorize('admin'),
    validate({ query: listAnnouncementsQuerySchema }),
    asyncHandler(controller.list),
  );

  router.get(
    '/:id',
    authenticate,
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
