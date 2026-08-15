import type { Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../../core/errors/app-error.js';
import { buildPaginationMeta, sendPaginated, sendSuccess } from '../../core/http/response.js';
import { verifyAccessToken } from '../auth/token.service.js';
import type { ChatHub } from './chat.hub.js';
import type { ChatService } from './chat.service.js';
import type { PushNotificationService } from './push.service.js';
import type { CreateChatMessageInput, DevicePlatform } from './chat.types.js';

export class ChatController {
  constructor(
    private readonly service: ChatService,
    private readonly hub: ChatHub,
    private readonly push: PushNotificationService,
  ) {}

  getGroup = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.getGroupSummary(req.auth!.userId));
  };

  listMembers = async (req: Request, res: Response): Promise<void> => {
    const page = Number(req.query.page ?? 1);
    const perPage = Number(req.query.perPage ?? 50);
    const { items, total } = await this.service.listMembers(req.auth!.userId, page, perPage);
    sendPaginated(res, items, buildPaginationMeta(page, perPage, total));
  };

  listMessages = async (req: Request, res: Response): Promise<void> => {
    const before = typeof req.query.before === 'string' ? req.query.before : undefined;
    const limit = Number(req.query.limit ?? 40);
    sendSuccess(res, await this.service.listMessages(req.auth!.userId, before, limit));
  };

  sendMessage = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      await this.service.sendMessage(req.auth!.userId, req.body as CreateChatMessageInput),
      201,
    );
  };

  deleteMessage = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      await this.service.deleteMessage(req.auth!.userId, req.params.id as string),
    );
  };

  markDelivered = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      await this.service.markDelivered(req.auth!.userId, (req.body as { messageId: string }).messageId),
    );
  };

  markRead = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      await this.service.markRead(req.auth!.userId, (req.body as { messageId: string }).messageId),
    );
  };

  addReaction = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      await this.service.setReaction(
        req.auth!.userId,
        req.params.id as string,
        (req.body as { emoji: string }).emoji,
      ),
    );
  };

  removeReaction = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.removeReaction(req.auth!.userId, req.params.id as string));
  };

  sync = async (req: Request, res: Response): Promise<void> => {
    const since = String(req.query.since ?? '');
    sendSuccess(res, await this.service.sync(req.auth!.userId, since));
  };

  registerDevice = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as { token: string; platform: DevicePlatform };
    sendSuccess(
      res,
      await this.push.registerToken({
        userId: req.auth!.userId,
        token: body.token,
        platform: body.platform,
      }),
    );
  };

  unregisterDevice = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as { token: string };
    await this.push.unregisterToken(req.auth!.userId, body.token);
    sendSuccess(res, { ok: true });
  };

  stream = async (req: Request, res: Response): Promise<void> => {
    const token =
      (typeof req.query.access_token === 'string' ? req.query.access_token : undefined) ??
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice('Bearer '.length).trim()
        : undefined);

    if (!token) throw new UnauthorizedError('Missing access token');

    let userId: string;
    try {
      const payload = verifyAccessToken(token);
      userId = payload.sub;
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }

    // Validate active membership via service summary (throws if suspended/missing).
    try {
      await this.service.getGroupSummary(userId);
    } catch (error) {
      if (error instanceof ForbiddenError) throw error;
      throw new ForbiddenError('Unable to join chat stream');
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true, userId })}\n\n`);

    const unsubscribe = this.hub.subscribe((event) => {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    });

    const heartbeat = setInterval(() => {
      res.write(`: ping ${Date.now()}\n\n`);
    }, 25_000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  };
}
