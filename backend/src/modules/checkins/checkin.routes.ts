import { Router } from 'express';
import { asyncHandler } from '../../core/http/async-handler.js';
import { authenticate, authorize } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import type { CheckInController } from './checkin.controller.js';
import {
  checkInStatsQuerySchema,
  listCheckInsQuerySchema,
  myQrQuerySchema,
  scanCheckInSchema,
} from './checkin.schema.js';

export function createCheckInRouter(controller: CheckInController): Router {
  const router = Router();

  // Attendee: QR for current (or specified) event
  router.get(
    '/my-qr',
    authenticate,
    validate({ query: myQrQuerySchema }),
    asyncHandler(controller.myQr),
  );

  // Admin: scan QR or manual check-in
  router.post(
    '/scan',
    authenticate,
    authorize('admin'),
    validate({ body: scanCheckInSchema }),
    asyncHandler(controller.scan),
  );

  // Admin: event-wise list (current or past via eventId)
  router.get(
    '/',
    authenticate,
    authorize('admin'),
    validate({ query: listCheckInsQuerySchema }),
    asyncHandler(controller.list),
  );

  router.get(
    '/stats',
    authenticate,
    authorize('admin'),
    validate({ query: checkInStatsQuerySchema }),
    asyncHandler(controller.stats),
  );

  return router;
}
