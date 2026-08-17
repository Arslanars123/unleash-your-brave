import type { Coupon, ListCouponsQuery } from './coupon.types.js';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

export interface CouponRepository {
  findById(id: string): Promise<Coupon | null>;
  findByCode(code: string): Promise<Coupon | null>;
  list(query: ListCouponsQuery): Promise<PaginatedResult<Coupon>>;
  create(data: Omit<Coupon, 'id' | 'createdAt' | 'updatedAt'>): Promise<Coupon>;
  update(id: string, data: Partial<Omit<Coupon, 'id' | 'createdAt'>>): Promise<Coupon | null>;
  delete(id: string): Promise<boolean>;
  incrementRedemption(id: string): Promise<Coupon | null>;
}
