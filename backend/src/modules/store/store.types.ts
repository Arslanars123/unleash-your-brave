export interface StoreCategory {
  id: string;
  name: string;
  description: string;
  image: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicStoreCategory {
  id: string;
  name: string;
  description: string;
  image: string;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStoreCategoryInput {
  name: string;
  description?: string;
  image?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateStoreCategoryInput {
  name?: string;
  description?: string;
  image?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface ListStoreCategoriesQuery {
  page: number;
  perPage: number;
  search?: string;
  /** When true, only active categories (mobile storefront). */
  activeOnly?: boolean;
}

export interface StoreProduct {
  id: string;
  categoryId: string | null;
  name: string;
  description: string;
  sku: string;
  price: number;
  compareAtPrice: number | null;
  currency: string;
  images: string[];
  trackInventory: boolean;
  stockQty: number;
  lowStockThreshold: number;
  isActive: boolean;
  featured: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicStoreProduct {
  id: string;
  categoryId: string | null;
  categoryName: string | null;
  name: string;
  description: string;
  sku: string;
  price: number;
  compareAtPrice: number | null;
  currency: string;
  images: string[];
  trackInventory: boolean;
  stockQty: number;
  lowStockThreshold: number;
  /** Derived from stockQty > 0. */
  inStock: boolean;
  isLowStock: boolean;
  isActive: boolean;
  featured: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStoreProductInput {
  categoryId?: string | null;
  name: string;
  description?: string;
  sku?: string;
  price: number;
  compareAtPrice?: number | null;
  currency?: string;
  images?: string[];
  stockQty?: number;
  lowStockThreshold?: number;
  isActive?: boolean;
  featured?: boolean;
  sortOrder?: number;
}

export interface UpdateStoreProductInput {
  categoryId?: string | null;
  name?: string;
  description?: string;
  sku?: string;
  price?: number;
  compareAtPrice?: number | null;
  currency?: string;
  images?: string[];
  stockQty?: number;
  lowStockThreshold?: number;
  isActive?: boolean;
  featured?: boolean;
  sortOrder?: number;
}

export interface ListStoreProductsQuery {
  page: number;
  perPage: number;
  search?: string;
  categoryId?: string;
  featured?: boolean;
  activeOnly?: boolean;
  inStockOnly?: boolean;
}
