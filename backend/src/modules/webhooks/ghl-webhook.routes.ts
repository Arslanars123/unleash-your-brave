import { Router } from 'express';
import { asyncHandler } from '../../core/http/async-handler.js';
import { validate } from '../../middleware/validate.js';
import type { GhlWebhookController } from './ghl-webhook.controller.js';
import { ghlPurchaseWebhookSchema } from './ghl-webhook.schema.js';

export function createGhlWebhookRouter(controller: GhlWebhookController): Router {
  const router = Router();

  router.post(
    '/ghl',
    validate({ body: ghlPurchaseWebhookSchema }),
    asyncHandler(controller.purchase),
  );

  return router;
}
