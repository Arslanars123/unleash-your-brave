import { z } from 'zod';
import { isValidMediaUrl } from '../uploads/media-url.js';

const optionalMedia = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .default('')
  .refine((value) => isValidMediaUrl(value), {
    message: 'Must be a valid URL or uploaded file path',
  });

const mediaListSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1)
      .max(2000)
      .refine((value) => isValidMediaUrl(value), {
        message: 'Must be a valid URL or uploaded file path',
      }),
  )
  .max(12);

export const storeCategoryIdParamSchema = z.object({
  id: z.string().uuid('Expected a valid category id'),
});

export const storeProductIdParamSchema = z.object({
  id: z.string().uuid('Expected a valid product id'),
});

export const listStoreCategoriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().min(1).optional(),
  eventId: z.string().uuid().optional(),
  activeOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
});

export const listStoreProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  eventId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  featured: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  activeOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  inStockOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
});

export const createStoreCategorySchema = z.object({
  eventId: z.string().uuid('Event is required'),
  name: z.string().trim().min(2, 'Category name is required').max(120),
  description: z.string().trim().max(2000).optional().default(''),
  image: optionalMedia,
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const updateStoreCategorySchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(2000).optional(),
    image: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .refine((value) => value === undefined || isValidMediaUrl(value), {
        message: 'Must be a valid URL or uploaded file path',
      }),
    sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  });

export const createStoreProductSchema = z.object({
  eventId: z.string().uuid('Event is required'),
  categoryId: z.string().uuid().nullable().optional().default(null),
  name: z.string().trim().min(2, 'Product name is required').max(160),
  description: z.string().trim().max(8000).optional().default(''),
  sku: z.string().trim().max(80).optional().default(''),
  price: z.coerce.number().min(0, 'Price must be 0 or greater').max(1_000_000),
  compareAtPrice: z.coerce.number().min(0).max(1_000_000).nullable().optional().default(null),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .length(3)
    .optional()
    .default('USD'),
  images: mediaListSchema.min(1, 'Add at least one product image'),
  stockQty: z.coerce.number().int().min(0).max(1_000_000).optional().default(0),
  lowStockThreshold: z.coerce.number().int().min(0).max(1_000_000).optional().default(5),
  isActive: z.boolean().optional().default(true),
  featured: z.boolean().optional().default(false),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
});

export const updateStoreProductSchema = z
  .object({
    categoryId: z.string().uuid().nullable().optional(),
    name: z.string().trim().min(2).max(160).optional(),
    description: z.string().trim().max(8000).optional(),
    sku: z.string().trim().max(80).optional(),
    price: z.coerce.number().min(0).max(1_000_000).optional(),
    compareAtPrice: z.coerce.number().min(0).max(1_000_000).nullable().optional(),
    currency: z.string().trim().toUpperCase().length(3).optional(),
    images: mediaListSchema.min(1, 'Add at least one product image').optional(),
    stockQty: z.coerce.number().int().min(0).max(1_000_000).optional(),
    lowStockThreshold: z.coerce.number().int().min(0).max(1_000_000).optional(),
    isActive: z.boolean().optional(),
    featured: z.boolean().optional(),
    sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  });

export const createStoreCheckoutSessionSchema = z.object({
  productId: z.string().uuid('Product is required'),
  quantity: z.coerce.number().int().min(1).max(100).optional().default(1),
  deliveryAddress: z
    .string()
    .trim()
    .min(5, 'Delivery address is required')
    .max(500, 'Delivery address is too long'),
  contactPhone: z
    .string()
    .trim()
    .min(6, 'Contact phone is required')
    .max(30, 'Contact phone is too long'),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  expectedPrice: z.number().finite().min(0).optional(),
});

export const storeOrderIdParamSchema = z.object({
  id: z.string().uuid('Expected a valid order id'),
});

export const updateStoreOrderSchema = z
  .object({
    fulfillmentStatus: z.enum(['completed']),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  });

export const storeCheckoutSessionIdParamSchema = z.object({
  id: z.string().min(1),
});

export const listStoreOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  eventId: z.string().uuid().optional(),
  search: z.string().trim().min(1).optional(),
  fulfillmentStatus: z.enum(['pending', 'completed']).optional(),
});
