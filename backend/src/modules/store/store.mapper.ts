import type {
  PublicStoreCategory,
  PublicStoreProduct,
  StoreCategory,
  StoreProduct,
} from './store.types.js';

export function toPublicStoreCategory(
  category: StoreCategory,
  productCount = 0,
): PublicStoreCategory {
  return {
    id: category.id,
    eventId: category.eventId,
    name: category.name,
    description: category.description,
    image: category.image,
    sortOrder: category.sortOrder,
    isActive: category.isActive !== false,
    productCount,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

export function toPublicStoreProduct(
  product: StoreProduct,
  categoryName: string | null = null,
): PublicStoreProduct {
  const stockQty = product.stockQty ?? 0;
  const lowStockThreshold = product.lowStockThreshold ?? 5;
  const inStock = stockQty > 0;
  const isLowStock = stockQty > 0 && stockQty <= lowStockThreshold;

  return {
    id: product.id,
    eventId: product.eventId,
    categoryId: product.categoryId ?? null,
    categoryName,
    name: product.name,
    description: product.description,
    sku: product.sku ?? '',
    price: product.price,
    compareAtPrice: product.compareAtPrice ?? null,
    currency: (product.currency || 'USD').toUpperCase(),
    images: [...(product.images ?? [])],
    trackInventory: true,
    stockQty,
    lowStockThreshold,
    inStock,
    isLowStock,
    isActive: product.isActive !== false,
    featured: Boolean(product.featured),
    sortOrder: product.sortOrder ?? 0,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}
