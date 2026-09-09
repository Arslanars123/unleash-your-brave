import { Router } from 'express';
import { asyncHandler } from '../../core/http/async-handler.js';
import { authenticate, authorize } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import type { CheckInController } from './checkin.controller.js';
import {
  checkInStatsQuerySchema,
  cancelMyPendingFormSchema,
  completeCheckInWithFormSchema,
  completeMyCheckInFormSchema,
  listCheckInsQuerySchema,
  myPendingFormQuerySchema,
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

  // Attendee: all event bookings with QR entitlement flags
  router.get(
    '/my-bookings',
    authenticate,
    asyncHandler(controller.myBookings),
  );

  // Attendee: after staff QR scan, poll for door waiver prompt
  router.get(
    '/my-pending-form',
    authenticate,
    validate({ query: myPendingFormQuerySchema }),
    asyncHandler(controller.myPendingForm),
  );

  // Attendee: discard unfinished door scan (show QR again)
  router.post(
    '/cancel-my-pending-form',
    authenticate,
    validate({ body: cancelMyPendingFormSchema }),
    asyncHandler(controller.cancelMyPendingForm),
  );

  // Attendee: submit waiver on phone → creates check-in
  router.post(
    '/complete-my-form',
    authenticate,
    validate({ body: completeMyCheckInFormSchema }),
    asyncHandler(controller.completeMyForm),
  );

  // Admin + desk: scan QR or manual check-in
  router.post(
    '/scan',
    authenticate,
    authorize('admin', 'desk'),
    validate({ body: scanCheckInSchema }),
    asyncHandler(controller.scan),
  );

  // Admin + desk: submit check-in form then complete check-in
  router.post(
    '/complete-with-form',
    authenticate,
    authorize('admin', 'desk'),
    validate({ body: completeCheckInWithFormSchema }),
    asyncHandler(controller.completeWithForm),
  );

  // Admin + desk: event-wise list (desk is locked to current event in service)
  router.get(
    '/',
    authenticate,
    authorize('admin', 'desk'),
    validate({ query: listCheckInsQuerySchema }),
    asyncHandler(controller.list),
  );

  router.get(
    '/stats',
    authenticate,
    authorize('admin', 'desk'),
    validate({ query: checkInStatsQuerySchema }),
    asyncHandler(controller.stats),
  );

  return router;
}
