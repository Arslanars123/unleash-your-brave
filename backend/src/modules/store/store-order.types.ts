export const STORE_PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'] as const;
export type StorePaymentStatus = (typeof STORE_PAYMENT_STATUSES)[number];

export interface StoreOrder {
  id: string;
  eventId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  currency: string;
  paymentStatus: StorePaymentStatus;
  inventoryAdjusted: boolean;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  stripeCustomerId: string | null;
  purchasedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicStoreOrder {
  id: string;
  eventId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  currency: string;
  paymentStatus: StorePaymentStatus;
  inventoryAdjusted: boolean;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  purchasedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStoreOrderInput {
  eventId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  currency: string;
  paymentStatus: StorePaymentStatus;
  inventoryAdjusted: boolean;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  stripeCustomerId: string | null;
  purchasedAt: Date;
}

export interface CreateStoreCheckoutSessionInput {
  productId: string;
  quantity?: number;
  successUrl?: string;
  cancelUrl?: string;
  expectedPrice?: number;
}

export interface CreateStoreCheckoutSessionResult {
  sessionId: string;
  checkoutUrl: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  currency: string;
  eventId: string;
}

export interface ListStoreOrdersQuery {
  page: number;
  perPage: number;
  eventId?: string;
  search?: string;
}
