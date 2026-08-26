import type { Request, Response } from 'express';
import { sendSuccess } from '../../core/http/response.js';
import type { CheckoutService } from './checkout.service.js';
import type { CreateCheckoutSessionInput } from './purchase.types.js';

export class CheckoutController {
  constructor(private readonly service: CheckoutService) {}

  catalog = async (req: Request, res: Response): Promise<void> => {
    const eventId = typeof req.query.eventId === 'string' ? req.query.eventId : undefined;
    sendSuccess(res, await this.service.listCatalog(eventId));
  };

  eligibility = async (req: Request, res: Response): Promise<void> => {
    const email = String(req.query.email ?? '');
    const membershipId = String(req.query.membershipId ?? '');
    const firstName =
      typeof req.query.firstName === 'string' ? req.query.firstName : undefined;
    const lastName =
      typeof req.query.lastName === 'string' ? req.query.lastName : undefined;
    const eventId =
      typeof req.query.eventId === 'string' ? req.query.eventId : undefined;
    sendSuccess(
      res,
      await this.service.checkEligibility(email, membershipId, {
        firstName,
        lastName,
        eventId,
      }),
    );
  };

  createSession = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      await this.service.createCheckoutSession(req.body as CreateCheckoutSessionInput),
      201,
    );
  };

  getSession = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.getSessionStatus(req.params.id as string));
  };

  stripeWebhook = async (req: Request, res: Response): Promise<void> => {
    const signature = req.headers['stripe-signature'];
    const rawBody = req.body as Buffer;
    await this.service.handleStripeWebhook(
      rawBody,
      typeof signature === 'string' ? signature : undefined,
    );
    res.status(200).json({ received: true });
  };
}
