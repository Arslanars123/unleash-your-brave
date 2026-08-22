import { Router } from 'express';
import { asyncHandler } from '../../core/http/async-handler.js';
import { authenticate, authorize } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import type { StoreController } from './store.controller.js';
import {
  createStoreCategorySchema,
  createStoreProductSchema,
  listStoreCategoriesQuerySchema,
  listStoreProductsQuerySchema,
  storeCategoryIdParamSchema,
  storeProductIdParamSchema,
  updateStoreCategorySchema,
  updateStoreProductSchema,
} from './store.schema.js';

export function createStoreRouter(controller: StoreController): Router {
  const router = Router();

  router.get(
    '/categories',
    validate({ query: listStoreCategoriesQuerySchema }),
    asyncHandler(controller.listCategories),
  );
  router.get(
    '/categories/:id',
    validate({ params: storeCategoryIdParamSchema }),
    asyncHandler(controller.getCategoryById),
  );
  router.post(
    '/categories',
    authenticate,
    authorize('admin'),
    validate({ body: createStoreCategorySchema }),
    asyncHandler(controller.createCategory),
  );
  router.patch(
    '/categories/:id',
    authenticate,
    authorize('admin'),
    validate({ params: storeCategoryIdParamSchema, body: updateStoreCategorySchema }),
    asyncHandler(controller.updateCategory),
  );
  router.delete(
    '/categories/:id',
    authenticate,
    authorize('admin'),
    validate({ params: storeCategoryIdParamSchema }),
    asyncHandler(controller.removeCategory),
  );

  router.get(
    '/products',
    validate({ query: listStoreProductsQuerySchema }),
    asyncHandler(controller.listProducts),
  );
  router.get(
    '/products/:id',
    validate({ params: storeProductIdParamSchema }),
    asyncHandler(controller.getProductById),
  );
  router.post(
    '/products',
    authenticate,
    authorize('admin'),
    validate({ body: createStoreProductSchema }),
    asyncHandler(controller.createProduct),
  );
  router.patch(
    '/products/:id',
    authenticate,
    authorize('admin'),
    validate({ params: storeProductIdParamSchema, body: updateStoreProductSchema }),
    asyncHandler(controller.updateProduct),
  );
  router.delete(
    '/products/:id',
    authenticate,
    authorize('admin'),
    validate({ params: storeProductIdParamSchema }),
    asyncHandler(controller.removeProduct),
  );

  return router;
}
