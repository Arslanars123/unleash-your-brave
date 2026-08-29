import Stripe from 'stripe';
import { env } from '../../config/env.js';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../core/errors/app-error.js';
import { logger } from '../../core/logger.js';
import type { UserRepository } from '../users/user.repository.js';
import type { StoreOrderRepository } from './store-order.repository.js';
import type {
  CreateStoreCheckoutSessionInput,
  CreateStoreCheckoutSessionResult,
  ListStoreOrdersQuery,
  PublicStoreOrder,
  StoreOrder,
} from './store-order.types.js';
import type { PaginatedResult, StoreProductRepository } from './store.repository.js';
import type { StoreProduct } from './store.types.js';

function moneyLabel(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    return `${amount} ${currency.toUpperCase()}`;
  }
}

function splitDisplayName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Attendee', lastName: 'Attendee' };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: parts[0]! };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(' ') };
}

function toPublicStoreOrder(order: StoreOrder): PublicStoreOrder {
  return {
    id: order.id,
    userId: order.userId,
    email: order.email,
    firstName: order.firstName,
    lastName: order.lastName,
    productId: order.productId,
    productName: order.productName,
    sku: order.sku,
    quantity: order.quantity,
    unitPrice: order.unitPrice,
    totalPrice: order.totalPrice,
    currency: order.currency,
    deliveryAddress: order.deliveryAddress ?? '',
    contactPhone: order.contactPhone ?? '',
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus ?? 'pending',
    inventoryAdjusted: order.inventoryAdjusted,
    stripeCheckoutSessionId: order.stripeCheckoutSessionId,
    stripePaymentIntentId: order.stripePaymentIntentId,
    purchasedAt: order.purchasedAt.toISOString(),
    completedAt: order.completedAt ? order.completedAt.toISOString() : null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

export class StoreCheckoutService {
  private stripe: Stripe | null = null;

  constructor(
    private readonly orders: StoreOrderRepository,
    private readonly products: StoreProductRepository,
    private readonly users: UserRepository,
  ) {}

  private requireStripe(): Stripe {
    if (!env.stripe.secretKey) {
      throw new BadRequestError('Stripe is not configured on the server');
    }
    if (!this.stripe) {
      this.stripe = new Stripe(env.stripe.secretKey, {
        apiVersion: '2025-02-24.acacia',
      });
    }
    return this.stripe;
  }

  async createCheckoutSession(
    userId: string,
    input: CreateStoreCheckoutSessionInput,
  ): Promise<CreateStoreCheckoutSessionResult> {
    const stripe = this.requireStripe();
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('User');

    const product = await this.requireActiveProduct(input.productId);
    const quantity = Math.max(1, Math.floor(input.quantity ?? 1));

    if (quantity > 20) {
      throw new BadRequestError('You can buy at most 20 of this item per checkout');
    }
    if (product.stockQty < quantity) {
      throw new ConflictError(
        product.stockQty <= 0
          ? 'This product is out of stock'
          : `Only ${product.stockQty} left in stock`,
      );
    }
    if (!(product.price > 0)) {
      throw new BadRequestError('Product must have a price greater than zero for Stripe checkout');
    }

    if (input.expectedPrice != null && Number.isFinite(input.expectedPrice)) {
      const liveCents = Math.round(product.price * 100);
      const shownCents = Math.round(input.expectedPrice * 100);
      if (shownCents !== liveCents) {
        throw new ConflictError(
          `This product was updated. The current price is ${moneyLabel(product.price, env.stripe.currency)}. Review before paying.`,
        );
      }
    }

    const currency = env.stripe.currency;
    const unitAmount = Math.round(product.price * 100);
    const totalPrice = Number((product.price * quantity).toFixed(2));
    if (unitAmount < 50) {
      throw new BadRequestError('Product price is below the Stripe minimum charge ($0.50)');
    }

    const successUrl = this.resolveRedirectUrl(
      input.successUrl,
      env.stripe.successUrl,
      'success URL',
    );
    const cancelUrl = this.resolveRedirectUrl(
      input.cancelUrl,
      env.stripe.cancelUrl,
      'cancel URL',
    );

    const names = splitDisplayName(user.name || user.email);
    const email = user.email.trim().toLowerCase();
    const deliveryAddress = input.deliveryAddress.trim();
    const contactPhone = input.contactPhone.trim();

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      client_reference_id: user.id,
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: [
        {
          quantity,
          price_data: {
            currency,
            unit_amount: unitAmount,
            product_data: {
              name: product.name,
              description: product.description?.trim() || `${env.appName} store`,
              ...(product.images?.[0] ? { images: [product.images[0]] } : {}),
            },
          },
        },
      ],
      metadata: {
        purchaseType: 'store',
        productId: product.id,
        productName: product.name,
        sku: product.sku ?? '',
        quantity: String(quantity),
        unitPrice: String(product.price),
        totalPrice: String(totalPrice),
        userId: user.id,
        email,
        firstName: names.firstName,
        lastName: names.lastName,
        deliveryAddress,
        contactPhone,
      },
    });

    if (!session.url) {
      throw new BadRequestError('Stripe did not return a checkout URL');
    }

    return {
      sessionId: session.id,
      checkoutUrl: session.url,
      productId: product.id,
      productName: product.name,
      quantity,
      unitPrice: product.price,
      totalPrice,
      currency,
    };
  }

  async getSessionStatus(sessionId: string) {
    const stripe = this.requireStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const order = await this.orders.findByStripeCheckoutSessionId(sessionId);

    return {
      sessionId: session.id,
      paymentStatus: session.payment_status,
      status: session.status,
      fulfilled: Boolean(order),
      order: order ? toPublicStoreOrder(order) : null,
    };
  }

  async listOrders(query: ListStoreOrdersQuery): Promise<PaginatedResult<PublicStoreOrder>> {
    const { items, total } = await this.orders.list(query);
    return { items: items.map(toPublicStoreOrder), total };
  }

  async listMyOrders(userId: string): Promise<PublicStoreOrder[]> {
    const items = await this.orders.listByUserId(userId);
    return items.map(toPublicStoreOrder);
  }

  async getOrderById(id: string): Promise<PublicStoreOrder> {
    const order = await this.orders.findById(id);
    if (!order) throw new NotFoundError('Store order');
    return toPublicStoreOrder(order);
  }

  async updateOrder(id: string, input: { fulfillmentStatus?: 'completed' }): Promise<PublicStoreOrder> {
    const existing = await this.orders.findById(id);
    if (!existing) throw new NotFoundError('Store order');

    if (input.fulfillmentStatus === 'completed') {
      if (existing.fulfillmentStatus === 'completed') {
        return toPublicStoreOrder(existing);
      }
      const updated = await this.orders.update(id, {
        fulfillmentStatus: 'completed',
        completedAt: new Date(),
      });
      if (!updated) throw new NotFoundError('Store order');
      return toPublicStoreOrder(updated);
    }

    throw new BadRequestError('Unsupported order update');
  }

  async fulfillCheckoutSession(session: Stripe.Checkout.Session): Promise<void> {
    const existing = await this.orders.findByStripeCheckoutSessionId(session.id);
    if (existing) {
      logger.info({ sessionId: session.id }, 'Store checkout already fulfilled');
      return;
    }

    if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
      logger.info(
        { sessionId: session.id, paymentStatus: session.payment_status },
        'Skipping store fulfill — payment not complete',
      );
      return;
    }

    const metadata = session.metadata ?? {};
    const productId = metadata.productId?.trim();
    const userId = metadata.userId?.trim() || session.client_reference_id?.trim() || '';
    const email = (
      metadata.email ||
      session.customer_email ||
      session.customer_details?.email ||
      ''
    )
      .trim()
      .toLowerCase();
    const quantity = Math.max(1, Number.parseInt(metadata.quantity ?? '1', 10) || 1);
    const unitPrice = Number.parseFloat(metadata.unitPrice ?? '0') || 0;
    const totalPrice =
      Number.parseFloat(metadata.totalPrice ?? '') ||
      Number((unitPrice * quantity).toFixed(2));

    if (!productId || !userId || !email) {
      logger.error({ sessionId: session.id }, 'Store session missing productId, userId, or email');
      throw new BadRequestError('Store checkout session is missing required metadata');
    }

    const product = await this.products.findById(productId);

    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id ?? null;
    const customerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;

    let inventoryAdjusted = false;
    try {
      inventoryAdjusted = await this.products.decrementStock(productId, quantity);
      if (!inventoryAdjusted) {
        logger.error(
          { sessionId: session.id, productId, quantity },
          'Paid store order could not decrement inventory (insufficient stock)',
        );
      }
    } catch (error) {
      logger.error(
        { err: error, sessionId: session.id, productId, quantity },
        'Store inventory decrement failed',
      );
    }

    try {
      await this.orders.create({
        userId,
        email,
        firstName:
          metadata.firstName?.trim() ||
          session.customer_details?.name?.split(/\s+/)[0] ||
          'Attendee',
        lastName:
          metadata.lastName?.trim() ||
          session.customer_details?.name?.split(/\s+/).slice(1).join(' ') ||
          'Attendee',
        productId,
        productName: metadata.productName?.trim() || product?.name || 'Store product',
        sku: metadata.sku?.trim() || product?.sku || '',
        quantity,
        unitPrice: unitPrice || product?.price || 0,
        totalPrice,
        currency: (session.currency || env.stripe.currency).toUpperCase(),
        deliveryAddress: metadata.deliveryAddress?.trim() || '',
        contactPhone: metadata.contactPhone?.trim() || '',
        paymentStatus: 'paid',
        fulfillmentStatus: 'pending',
        inventoryAdjusted,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: paymentIntentId,
        stripeCustomerId: customerId,
        purchasedAt: new Date(),
        completedAt: null,
      });
    } catch (error) {
      const duplicate = await this.orders.findByStripeCheckoutSessionId(session.id);
      if (duplicate) {
        logger.info({ sessionId: session.id }, 'Store checkout fulfill race — already recorded');
        return;
      }
      throw error;
    }

    logger.info(
      { sessionId: session.id, productId, quantity, inventoryAdjusted },
      'Store checkout fulfilled',
    );
  }

  private async requireActiveProduct(id: string): Promise<StoreProduct> {
    const product = await this.products.findById(id);
    if (!product || product.isActive === false) {
      throw new NotFoundError('Store product');
    }
    return {
      ...product,
      categoryId: product.categoryId ?? null,
      description: product.description ?? '',
      sku: product.sku ?? '',
      compareAtPrice: product.compareAtPrice ?? null,
      currency: product.currency || 'USD',
      images: product.images ?? [],
      trackInventory: true,
      stockQty: product.stockQty ?? 0,
      lowStockThreshold: product.lowStockThreshold ?? 5,
      isActive: true,
      featured: Boolean(product.featured),
      sortOrder: product.sortOrder ?? 0,
    };
  }

  private resolveRedirectUrl(
    override: string | undefined,
    fallback: string,
    label: string,
  ): string {
    const url = (override?.trim() || fallback).trim();
    if (!url) {
      throw new BadRequestError(`Stripe ${label} is not configured`);
    }
    try {
      // eslint-disable-next-line no-new
      new URL(url.replace('{CHECKOUT_SESSION_ID}', 'cs_test'));
    } catch {
      throw new BadRequestError(`Invalid Stripe ${label}`);
    }
    return url;
  }
}
