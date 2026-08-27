import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../core/errors/app-error.js';
import { sendSuccess } from '../../core/http/response.js';
import type { CheckInFormService } from './checkin-form.service.js';
import type { UpsertCheckInFormInput } from './checkin-form.types.js';

export class CheckInFormController {
  constructor(private readonly service: CheckInFormService) {}

  getActiveByEvent = async (req: Request, res: Response): Promise<void> => {
    const eventId = req.params.eventId as string;
    sendSuccess(res, await this.service.getActiveByEvent(eventId));
  };

  getByEvent = async (req: Request, res: Response): Promise<void> => {
    const eventId = String(req.query.eventId ?? '');
    sendSuccess(res, await this.service.getByEvent(eventId));
  };

  upsertByEvent = async (req: Request, res: Response): Promise<void> => {
    const eventId = req.params.eventId as string;
    sendSuccess(
      res,
      await this.service.upsertByEvent(eventId, req.body as UpsertCheckInFormInput),
    );
  };

  deleteByEvent = async (req: Request, res: Response): Promise<void> => {
    const eventId = req.params.eventId as string;
    await this.service.deleteByEvent(eventId);
    res.status(204).send();
  };

  getMySubmission = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) throw new UnauthorizedError();
    const eventId = String(req.query.eventId ?? '');
    sendSuccess(res, await this.service.getMySubmission(req.auth.userId, eventId));
  };

  submitMyForm = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) throw new UnauthorizedError();
    const { eventId, ...input } = req.body as {
      eventId: string;
      answers: Record<string, string | boolean>;
      signatureDataUrl?: string;
      signedName: string;
    };
    sendSuccess(
      res,
      await this.service.submitForMember(req.auth.userId, eventId, input),
      201,
    );
  };

  listSubmissions = async (req: Request, res: Response): Promise<void> => {
    const eventId = String(req.query.eventId ?? '');
    sendSuccess(res, await this.service.listSubmissions(eventId));
  };
}
