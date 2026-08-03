import type { Request, Response } from 'express';
import { sendSuccess } from '../../core/http/response.js';
import type { GhlWebhookService } from './ghl-webhook.service.js';

export class GhlWebhookController {
  constructor(private readonly service: GhlWebhookService) {}

  purchase = async (req: Request, res: Response): Promise<void> => {
    const secret =
      (req.headers['x-webhook-secret'] as string | undefined) ??
      (typeof req.query.secret === 'string' ? req.query.secret : undefined);

    this.service.assertSecret(secret);

    const body =
      req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? (req.body as Record<string, unknown>)
        : {};

    sendSuccess(res, await this.service.handlePurchase(body));
  };
}
