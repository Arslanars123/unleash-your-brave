import type { Response } from 'express';

/**
 * All endpoints answer with the same envelope so the Flutter app and the
 * dashboard can share one deserialization path.
 */
export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  unreadCount?: number;
  stats?: {
    eventId: string;
    checkedInCount: number;
    attendeeCount: number;
  };
}

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): Response {
  const body: SuccessEnvelope<T> = { success: true, data };
  return res.status(statusCode).json(body);
}

export function sendPaginated<T>(
  res: Response,
  items: T[],
  meta: PaginationMeta,
  statusCode = 200,
): Response {
  const body: SuccessEnvelope<T[]> = { success: true, data: items, meta };
  return res.status(statusCode).json(body);
}

export function buildPaginationMeta(page: number, perPage: number, total: number): PaginationMeta {
  return {
    page,
    perPage,
    total,
    totalPages: perPage > 0 ? Math.ceil(total / perPage) : 0,
  };
}
