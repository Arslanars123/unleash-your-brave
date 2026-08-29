export const STORE_PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'] as const;
export type StorePaymentStatus = (typeof STORE_PAYMENT_STATUSES)[number];

export const STORE_FULFILLMENT_STATUSES = ['pending', 'completed'] as const;
export type StoreFulfillmentStatus = (typeof STORE_FULFILLMENT_STATUSES)[number];

export interface StoreOrder {
  id: string;
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
  deliveryAddress: string;
  contactPhone: string;
  paymentStatus: StorePaymentStatus;
  fulfillmentStatus: StoreFulfillmentStatus;
  inventoryAdjusted: boolean;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  stripeCustomerId: string | null;
  purchasedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicStoreOrder {
  id: string;
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
  deliveryAddress: string;
  contactPhone: string;
  paymentStatus: StorePaymentStatus;
  fulfillmentStatus: StoreFulfillmentStatus;
  inventoryAdjusted: boolean;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  purchasedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStoreOrderInput {
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
  deliveryAddress: string;
  contactPhone: string;
  paymentStatus: StorePaymentStatus;
  fulfillmentStatus: StoreFulfillmentStatus;
  inventoryAdjusted: boolean;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  stripeCustomerId: string | null;
  purchasedAt: Date;
  completedAt?: Date | null;
}

export interface CreateStoreCheckoutSessionInput {
  productId: string;
  quantity?: number;
  deliveryAddress: string;
  contactPhone: string;
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
}

export interface ListStoreOrdersQuery {
  page: number;
  perPage: number;
  search?: string;
  fulfillmentStatus?: StoreFulfillmentStatus;
}

export interface UpdateStoreOrderInput {
  fulfillmentStatus?: StoreFulfillmentStatus;
}
