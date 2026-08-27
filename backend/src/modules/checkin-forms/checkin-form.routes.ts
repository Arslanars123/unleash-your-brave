import { Router } from 'express';
import { asyncHandler } from '../../core/http/async-handler.js';
import { authenticate, authorize } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import type { CheckInFormController } from './checkin-form.controller.js';
import {
  eventIdParamSchema,
  eventIdQuerySchema,
  memberSubmitCheckInFormSchema,
  upsertCheckInFormSchema,
} from './checkin-form.schema.js';

export function createCheckInFormRouter(controller: CheckInFormController): Router {
  const router = Router();

  // Member / authenticated: active form for an event (or null)
  router.get(
    '/by-event/:eventId',
    authenticate,
    validate({ params: eventIdParamSchema }),
    asyncHandler(controller.getActiveByEvent),
  );

  // Member: my submission for an event
  router.get(
    '/submissions/me',
    authenticate,
    validate({ query: eventIdQuerySchema }),
    asyncHandler(controller.getMySubmission),
  );

  // Member: sign / submit waiver before check-in
  router.post(
    '/submissions',
    authenticate,
    validate({ body: memberSubmitCheckInFormSchema }),
    asyncHandler(controller.submitMyForm),
  );

  // Admin: form for event (active or not)
  router.get(
    '/',
    authenticate,
    authorize('admin'),
    validate({ query: eventIdQuerySchema }),
    asyncHandler(controller.getByEvent),
  );

  // Admin: upsert form for event
  router.put(
    '/by-event/:eventId',
    authenticate,
    authorize('admin'),
    validate({ params: eventIdParamSchema, body: upsertCheckInFormSchema }),
    asyncHandler(controller.upsertByEvent),
  );

  // Admin: delete form for event
  router.delete(
    '/by-event/:eventId',
    authenticate,
    authorize('admin'),
    validate({ params: eventIdParamSchema }),
    asyncHandler(controller.deleteByEvent),
  );

  // Admin: list submissions for event
  router.get(
    '/submissions',
    authenticate,
    authorize('admin'),
    validate({ query: eventIdQuerySchema }),
    asyncHandler(controller.listSubmissions),
  );

  return router;
}
