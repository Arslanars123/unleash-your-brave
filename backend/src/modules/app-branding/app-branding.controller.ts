import type { Request, Response } from 'express';
import { sendSuccess } from '../../core/http/response.js';
import type { AppBrandingService } from './app-branding.service.js';
import type { UpdateAppBrandingInput } from './app-branding.types.js';

export class AppBrandingController {
  constructor(private readonly service: AppBrandingService) {}

  get = async (_req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.get());
  };

  update = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.update(req.body as UpdateAppBrandingInput));
  };
}
