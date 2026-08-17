import { Router } from 'express';
import { asyncHandler } from '../../core/http/async-handler.js';
import { authenticate, authorize } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import type { CouponController } from './coupon.controller.js';
import {
  couponIdParamSchema,
  createCouponSchema,
  listCouponsQuerySchema,
  sendCouponSchema,
  updateCouponSchema,
  validateCouponSchema,
} from './coupon.schema.js';

export function createCouponRouter(controller: CouponController): Router {
  const router = Router();

  router.get(
    '/',
    authenticate,
    authorize('admin'),
    validate({ query: listCouponsQuerySchema }),
    asyncHandler(controller.list),
  );

  router.post(
    '/preview',
    validate({ body: validateCouponSchema }),
    asyncHandler(controller.preview),
  );

  router.get(
    '/:id',
    authenticate,
    authorize('admin'),
    validate({ params: couponIdParamSchema }),
    asyncHandler(controller.getById),
  );

  router.post(
    '/',
    authenticate,
    authorize('admin'),
    validate({ body: createCouponSchema }),
    asyncHandler(controller.create),
  );

  router.patch(
    '/:id',
    authenticate,
    authorize('admin'),
    validate({ params: couponIdParamSchema, body: updateCouponSchema }),
    asyncHandler(controller.update),
  );

  router.delete(
    '/:id',
    authenticate,
    authorize('admin'),
    validate({ params: couponIdParamSchema }),
    asyncHandler(controller.remove),
  );

  router.post(
    '/:id/send',
    authenticate,
    authorize('admin'),
    validate({ params: couponIdParamSchema, body: sendCouponSchema }),
    asyncHandler(controller.send),
  );

  return router;
}
