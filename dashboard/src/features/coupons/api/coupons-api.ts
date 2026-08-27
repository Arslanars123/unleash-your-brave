import { apiClient } from '@/shared/api/client';
import type {
  CouponPayload,
  PaginationMeta,
  PublicCoupon,
  SuccessEnvelope,
} from '@/shared/types/api';

export interface ListCouponsParams {
  page?: number;
  perPage?: number;
  search?: string;
  active?: boolean;
}

export interface ListCouponsResult {
  items: PublicCoupon[];
  meta: PaginationMeta;
}

export const couponsApi = {
  async list(params: ListCouponsParams = {}): Promise<ListCouponsResult> {
    const { data } = await apiClient.get<SuccessEnvelope<PublicCoupon[]>>('/coupons', {
      params,
    });
    return {
      items: data.data,
      meta: data.meta ?? { page: 1, perPage: 20, total: data.data.length, totalPages: 1 },
    };
  },

  async create(payload: CouponPayload): Promise<PublicCoupon> {
    const { data } = await apiClient.post<SuccessEnvelope<PublicCoupon>>('/coupons', payload);
    return data.data;
  },

  async update(id: string, payload: Partial<CouponPayload>): Promise<PublicCoupon> {
    const { data } = await apiClient.patch<SuccessEnvelope<PublicCoupon>>(
      `/coupons/${id}`,
      payload,
    );
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/coupons/${id}`);
  },

  async send(
    id: string,
    payload: {
      title?: string;
      message?: string;
      sendPush?: boolean;
      audienceType?: 'all' | 'roles' | 'users';
      audienceRoles?: string[];
      audienceUserIds?: string[];
    } = {},
  ): Promise<{ announcementId: string; code: string }> {
    const { data } = await apiClient.post<
      SuccessEnvelope<{ announcementId: string; code: string }>
    >(`/coupons/${id}/send`, payload);
    return data.data;
  },
};
