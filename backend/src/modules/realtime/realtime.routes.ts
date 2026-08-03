import { Router } from 'express';
import { asyncHandler } from '../../core/http/async-handler.js';
import type { RealtimeController } from './realtime.controller.js';

export function createRealtimeRouter(controller: RealtimeController): Router {
  const router = Router();
  router.get('/stream', asyncHandler(controller.stream));
  return router;
}
