import type { Request, Response } from 'express';
import { UnauthorizedError, ForbiddenError } from '../../core/errors/app-error.js';
import { verifyAccessToken } from '../auth/token.service.js';
import type { RealtimeHub } from './realtime.hub.js';

export class RealtimeController {
  constructor(private readonly hub: RealtimeHub) {}

  /**
   * Server-Sent Events stream for admin dashboard live updates.
   * Auth via `?access_token=` because EventSource cannot set headers.
   */
  stream = async (req: Request, res: Response): Promise<void> => {
    const token =
      (typeof req.query.access_token === 'string' ? req.query.access_token : undefined) ??
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice('Bearer '.length).trim()
        : undefined);

    if (!token) throw new UnauthorizedError('Missing access token');

    let role: string;
    try {
      const payload = verifyAccessToken(token);
      role = payload.role;
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }

    if (role !== 'admin') throw new ForbiddenError('Admin only');

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);

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
