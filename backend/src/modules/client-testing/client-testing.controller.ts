import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../core/errors/app-error.js';
import { sendSuccess } from '../../core/http/response.js';
import type { ClientTestingService } from './client-testing.service.js';
import type { UpdateClientTestingSettingsInput } from './client-testing.types.js';

export class ClientTestingController {
  constructor(private readonly service: ClientTestingService) {}

  get = async (_req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.get());
  };

  update = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) throw new UnauthorizedError();
    sendSuccess(
      res,
      await this.service.update(
        req.body as UpdateClientTestingSettingsInput,
        req.auth.userId,
      ),
    );
  };
}
