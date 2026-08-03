import { Router } from 'express';
import { asyncHandler } from '../../core/http/async-handler.js';
import { authenticate, authorize } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import type { SessionFeedbackController } from './feedback/session-feedback.controller.js';
import {
  listSessionFeedbackQuerySchema,
  sessionFeedbackItemParamSchema,
  sessionFeedbackParamSchema,
  updateSessionFeedbackSchema,
  upsertSessionFeedbackSchema,
} from './feedback/session-feedback.schema.js';
import type { SessionController } from './session.controller.js';
import {
  createSessionSchema,
  listSessionsQuerySchema,
  sessionIdParamSchema,
  speakerUpdateSessionSchema,
  updateSessionSchema,
} from './session.schema.js';

export function createSessionRouter(
  controller: SessionController,
  feedbackController: SessionFeedbackController,
): Router {
  const router = Router();

  router.get('/', validate({ query: listSessionsQuerySchema }), asyncHandler(controller.list));

  router.get(
    '/:id/feedback/summary',
    validate({ params: sessionFeedbackParamSchema }),
    asyncHandler(feedbackController.summary),
  );

  router.get(
    '/:id/feedback/me',
    authenticate,
    validate({ params: sessionFeedbackParamSchema }),
    asyncHandler(feedbackController.mine),
  );

  router.get(
    '/:id/feedback',
    authenticate,
    authorize('admin', 'speaker'),
    validate({ params: sessionFeedbackParamSchema, query: listSessionFeedbackQuerySchema }),
    asyncHandler(feedbackController.list),
  );

  router.post(
    '/:id/feedback',
    authenticate,
    authorize('member', 'admin'),
    validate({ params: sessionFeedbackParamSchema, body: upsertSessionFeedbackSchema }),
    asyncHandler(feedbackController.upsert),
  );

  router.delete(
    '/:id/feedback/me',
    authenticate,
    validate({ params: sessionFeedbackParamSchema }),
    asyncHandler(feedbackController.removeMine),
  );

  router.patch(
    '/:id/feedback/:feedbackId',
    authenticate,
    authorize('admin'),
    validate({ params: sessionFeedbackItemParamSchema, body: updateSessionFeedbackSchema }),
    asyncHandler(feedbackController.updateById),
  );

  router.delete(
    '/:id/feedback/:feedbackId',
    authenticate,
    authorize('admin'),
    validate({ params: sessionFeedbackItemParamSchema }),
    asyncHandler(feedbackController.removeById),
  );

  router.get('/:id', validate({ params: sessionIdParamSchema }), asyncHandler(controller.getById));

  router.post(
    '/',
    authenticate,
    authorize('admin'),
    validate({ body: createSessionSchema }),
    asyncHandler(controller.create),
  );

  router.patch(
    '/:id',
    authenticate,
    authorize('admin', 'speaker'),
    (req, res, next) => {
      const bodySchema =
        req.auth?.role === 'speaker' ? speakerUpdateSessionSchema : updateSessionSchema;
      return validate({ params: sessionIdParamSchema, body: bodySchema })(req, res, next);
    },
    asyncHandler(controller.update),
  );

  router.delete(
    '/:id',
    authenticate,
    authorize('admin'),
    validate({ params: sessionIdParamSchema }),
    asyncHandler(controller.remove),
  );

  return router;
}
