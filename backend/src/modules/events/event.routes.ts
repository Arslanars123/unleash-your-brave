import { Router } from 'express';
import { asyncHandler } from '../../core/http/async-handler.js';
import { authenticate, authorize } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { eventAssociationsBodySchema } from '../event-associations/event-association.schema.js';
import type { EventController } from './event.controller.js';
import {
  createEventSchema,
  eventIdParamSchema,
  listEventsQuerySchema,
  scheduleEventSchema,
  updateEventSchema,
} from './event.schema.js';

export function createEventRouter(controller: EventController): Router {
  const router = Router();

  router.get('/', validate({ query: listEventsQuerySchema }), asyncHandler(controller.list));
  router.get('/workspace', asyncHandler(controller.getWorkspace));
  router.get('/current', asyncHandler(controller.getCurrent));
  router.get('/available', asyncHandler(controller.listAvailable));
  router.get('/:id', validate({ params: eventIdParamSchema }), asyncHandler(controller.getById));
  router.get(
    '/:id/associations',
    authenticate,
    authorize('admin'),
    validate({ params: eventIdParamSchema }),
    asyncHandler(controller.getAssociations),
  );

  router.post(
    '/',
    authenticate,
    authorize('admin'),
    validate({ body: createEventSchema }),
    asyncHandler(controller.create),
  );

  router.post(
    '/schedule',
    authenticate,
    authorize('admin'),
    validate({ body: scheduleEventSchema }),
    asyncHandler(controller.schedule),
  );

  router.patch(
    '/:id',
    authenticate,
    authorize('admin'),
    validate({ params: eventIdParamSchema, body: updateEventSchema }),
    asyncHandler(controller.update),
  );

  router.put(
    '/:id/associations',
    authenticate,
    authorize('admin'),
    validate({ params: eventIdParamSchema, body: eventAssociationsBodySchema }),
    asyncHandler(controller.setAssociations),
  );

  router.delete(
    '/:id',
    authenticate,
    authorize('admin'),
    validate({ params: eventIdParamSchema }),
    asyncHandler(controller.remove),
  );

  return router;
}
