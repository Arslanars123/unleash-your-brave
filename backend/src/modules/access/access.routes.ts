import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import type { AccessController } from './access.controller.js';

export function createAccessRouter(controller: AccessController): Router {
  const router = Router();
  router.get('/me', authenticate, controller.me);
  return router;
}
