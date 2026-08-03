import { Router } from 'express';
import { asyncHandler } from '../../core/http/async-handler.js';
import { authenticate, authorize } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import type { SpeakerController } from './speaker.controller.js';
import {
  createSpeakerSchema,
  listSpeakersQuerySchema,
  speakerIdParamSchema,
  updateSpeakerSchema,
} from './speaker.schema.js';

export function createSpeakerRouter(controller: SpeakerController): Router {
  const router = Router();

  router.get('/', validate({ query: listSpeakersQuerySchema }), asyncHandler(controller.list));

  router.get('/me', authenticate, authorize('speaker'), asyncHandler(controller.me));

  router.get('/:id', validate({ params: speakerIdParamSchema }), asyncHandler(controller.getById));

  router.post(
    '/',
    authenticate,
    authorize('admin'),
    validate({ body: createSpeakerSchema }),
    asyncHandler(controller.create),
  );

  router.patch(
    '/:id',
    authenticate,
    authorize('admin', 'speaker'),
    validate({ params: speakerIdParamSchema, body: updateSpeakerSchema }),
    asyncHandler(controller.update),
  );

  router.delete(
    '/:id',
    authenticate,
    authorize('admin'),
    validate({ params: speakerIdParamSchema }),
    asyncHandler(controller.remove),
  );

  return router;
}
