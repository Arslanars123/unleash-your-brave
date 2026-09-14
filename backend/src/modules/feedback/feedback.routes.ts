import { Router } from 'express';
import { asyncHandler } from '../../core/http/async-handler.js';
import { authenticate, authorize } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { feedbackSubmitRateLimiter } from '../../middleware/rate-limit.js';
import type { FeedbackController } from './feedback.controller.js';
import { createFeedbackSchema, listFeedbackQuerySchema } from './feedback.schema.js';

export function createFeedbackRouter(controller: FeedbackController): Router {
  const router = Router();

  router.get(
    '/',
    authenticate,
    authorize('admin'),
    validate({ query: listFeedbackQuerySchema }),
    asyncHandler(controller.list),
  );

  router.post(
    '/',
    feedbackSubmitRateLimiter,
    validate({ body: createFeedbackSchema }),
    asyncHandler(controller.create),
  );

  return router;
}
