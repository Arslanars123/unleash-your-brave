import { Router } from 'express';
import { asyncHandler } from '../../core/http/async-handler.js';
import { authenticate, authorize } from '../../middleware/authenticate.js';
import type { UploadController } from './upload.controller.js';
import { imageUpload, materialUpload } from './upload.middleware.js';

export function createUploadRouter(controller: UploadController): Router {
  const router = Router();

  router.post(
    '/images',
    authenticate,
    authorize('admin', 'speaker', 'sponsor', 'member'),
    imageUpload.single('file'),
    asyncHandler(controller.uploadImage),
  );

  router.post(
    '/materials',
    authenticate,
    authorize('admin', 'speaker'),
    materialUpload.single('file'),
    asyncHandler(controller.uploadMaterial),
  );

  return router;
}
