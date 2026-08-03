import { Router } from 'express';
import { asyncHandler } from '../../core/http/async-handler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authRateLimiter } from '../../middleware/rate-limit.js';
import { validate } from '../../middleware/validate.js';
import type { AuthController } from './auth.controller.js';
import {
  changePasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
} from './auth.schema.js';

export function createAuthRouter(controller: AuthController): Router {
  const router = Router();

  router.post(
    '/register',
    authRateLimiter,
    validate({ body: registerSchema }),
    asyncHandler(controller.register),
  );

  router.post('/login', authRateLimiter, validate({ body: loginSchema }), asyncHandler(controller.login));

  router.post('/refresh', validate({ body: refreshSchema }), asyncHandler(controller.refresh));

  router.get('/me', authenticate, asyncHandler(controller.me));

  router.post(
    '/change-password',
    authenticate,
    authRateLimiter,
    validate({ body: changePasswordSchema }),
    asyncHandler(controller.changePassword),
  );

  return router;
}
