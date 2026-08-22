import { apiClient } from '@/shared/api/client';
import type {
  PaginationMeta,
  PublicStoreCategory,
  PublicStoreProduct,
  StoreCategoryPayload,
  StoreProductPayload,
  SuccessEnvelope,
} from '@/shared/types/api';

export interface ListStoreParams {
  page?: number;
  perPage?: number;
  search?: string;
  eventId?: string;
  categoryId?: string;
  featured?: boolean;
  activeOnly?: boolean;
  inStockOnly?: boolean;
}

export const storeApi = {
  async listCategories(params: ListStoreParams = {}) {
    const { data } = await apiClient.get<SuccessEnvelope<PublicStoreCategory[]>>(
      '/store/categories',
      { params },
    );
    return {
      items: data.data,
      meta: data.meta ?? { page: 1, perPage: 50, total: data.data.length, totalPages: 1 },
    };
  },

  async createCategory(payload: StoreCategoryPayload): Promise<PublicStoreCategory> {
    const { data } = await apiClient.post<SuccessEnvelope<PublicStoreCategory>>(
      '/store/categories',
      payload,
    );
    return data.data;
  },

  async updateCategory(
    id: string,
    payload: Partial<StoreCategoryPayload>,
  ): Promise<PublicStoreCategory> {
    const { data } = await apiClient.patch<SuccessEnvelope<PublicStoreCategory>>(
      `/store/categories/${id}`,
      payload,
    );
    return data.data;
  },

  async removeCategory(id: string): Promise<void> {
    await apiClient.delete(`/store/categories/${id}`);
  },

  async listProducts(params: ListStoreParams = {}) {
    const { data } = await apiClient.get<SuccessEnvelope<PublicStoreProduct[]>>('/store/products', {
      params,
    });
    return {
      items: data.data,
      meta: (data.meta ?? {
        page: 1,
        perPage: 20,
        total: data.data.length,
        totalPages: 1,
      }) as PaginationMeta,
    };
  },

  async createProduct(payload: StoreProductPayload): Promise<PublicStoreProduct> {
    const { data } = await apiClient.post<SuccessEnvelope<PublicStoreProduct>>(
      '/store/products',
      payload,
    );
    return data.data;
  },

  async updateProduct(
    id: string,
    payload: Partial<StoreProductPayload>,
  ): Promise<PublicStoreProduct> {
    const { data } = await apiClient.patch<SuccessEnvelope<PublicStoreProduct>>(
      `/store/products/${id}`,
      payload,
    );
    return data.data;
  },

  async removeProduct(id: string): Promise<void> {
    await apiClient.delete(`/store/products/${id}`);
  },
};
