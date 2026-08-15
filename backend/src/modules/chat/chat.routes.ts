import { Router } from 'express';
import { asyncHandler } from '../../core/http/async-handler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import type { ChatController } from './chat.controller.js';
import {
  createMessageSchema,
  listMembersQuerySchema,
  listMessagesQuerySchema,
  messageIdParamSchema,
  reactionSchema,
  receiptSchema,
  registerDeviceSchema,
  syncQuerySchema,
  unregisterDeviceSchema,
} from './chat.schema.js';

export function createChatRouter(controller: ChatController): Router {
  const router = Router();

  router.get('/stream', asyncHandler(controller.stream));

  router.use(authenticate);

  router.get('/group', asyncHandler(controller.getGroup));
  router.get(
    '/members',
    validate({ query: listMembersQuerySchema }),
    asyncHandler(controller.listMembers),
  );
  router.get(
    '/messages',
    validate({ query: listMessagesQuerySchema }),
    asyncHandler(controller.listMessages),
  );
  router.post(
    '/messages',
    validate({ body: createMessageSchema }),
    asyncHandler(controller.sendMessage),
  );
  router.delete(
    '/messages/:id',
    validate({ params: messageIdParamSchema }),
    asyncHandler(controller.deleteMessage),
  );
  router.post(
    '/delivered',
    validate({ body: receiptSchema }),
    asyncHandler(controller.markDelivered),
  );
  router.post('/read', validate({ body: receiptSchema }), asyncHandler(controller.markRead));
  router.post(
    '/messages/:id/reactions',
    validate({ params: messageIdParamSchema, body: reactionSchema }),
    asyncHandler(controller.addReaction),
  );
  router.delete(
    '/messages/:id/reactions',
    validate({ params: messageIdParamSchema }),
    asyncHandler(controller.removeReaction),
  );
  router.get('/sync', validate({ query: syncQuerySchema }), asyncHandler(controller.sync));

  router.post(
    '/devices',
    validate({ body: registerDeviceSchema }),
    asyncHandler(controller.registerDevice),
  );
  router.delete(
    '/devices',
    validate({ body: unregisterDeviceSchema }),
    asyncHandler(controller.unregisterDevice),
  );

  return router;
}
