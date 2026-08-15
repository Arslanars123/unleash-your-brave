import { Router } from 'express';
import { asyncHandler } from '../../core/http/async-handler.js';
import { validate } from '../../middleware/validate.js';
import type { CheckoutController } from './checkout.controller.js';
import {
  checkoutCatalogQuerySchema,
  checkoutEligibilityQuerySchema,
  checkoutSessionIdParamSchema,
  createCheckoutSessionSchema,
} from './checkout.schema.js';

export function createCheckoutRouter(controller: CheckoutController): Router {
  const router = Router();

  /** Public catalog for the marketing / membership website. */
  router.get(
    '/catalog',
    validate({ query: checkoutCatalogQuerySchema }),
    asyncHandler(controller.catalog),
  );

  /** Pre-purchase upgrade / duplicate checks. */
  router.get(
    '/eligibility',
    validate({ query: checkoutEligibilityQuerySchema }),
    asyncHandler(controller.eligibility),
  );

  /** Create a Stripe Checkout Session and return the hosted URL. */
  router.post(
    '/sessions',
    validate({ body: createCheckoutSessionSchema }),
    asyncHandler(controller.createSession),
  );

  /** Poll session / fulfillment status after redirect. */
  router.get(
    '/sessions/:id',
    validate({ params: checkoutSessionIdParamSchema }),
    asyncHandler(controller.getSession),
  );

  return router;
}
