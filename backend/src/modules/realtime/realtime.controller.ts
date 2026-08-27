import type { Request, Response } from 'express';
import { UnauthorizedError, ForbiddenError } from '../../core/errors/app-error.js';
import { verifyAccessToken } from '../auth/token.service.js';
import type { RealtimeHub, RealtimeEvent } from './realtime.hub.js';

export class RealtimeController {
  constructor(private readonly hub: RealtimeHub) {}

  /**
   * Server-Sent Events stream for dashboard live updates.
   * Auth via `?access_token=` because EventSource cannot set headers.
   * Admins receive attendee events; speakers/sponsors receive announcement events.
   */
  stream = async (req: Request, res: Response): Promise<void> => {
    const token =
      (typeof req.query.access_token === 'string' ? req.query.access_token : undefined) ??
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice('Bearer '.length).trim()
        : undefined);

    if (!token) throw new UnauthorizedError('Missing access token');

    let role: string;
    let userId: string;
    let speakerId: string | null = null;
    let sponsorId: string | null = null;
    try {
      const payload = verifyAccessToken(token);
      role = payload.role;
      userId = payload.sub;
      speakerId = payload.speakerId ?? null;
      sponsorId = payload.sponsorId ?? null;
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }

    const isAdmin = role === 'admin';
    const isPortal =
      role === 'speaker' ||
      role === 'sponsor' ||
      Boolean(speakerId) ||
      Boolean(sponsorId);
    if (!isAdmin && !isPortal) {
      throw new ForbiddenError('Dashboard realtime is for admins, speakers, and sponsors');
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);

    const unsubscribe = this.hub.subscribe((event: RealtimeEvent) => {
      if (isAdmin) {
        if (
          event.type === 'attendee.upserted' ||
          event.type === 'attendee.deleted'
        ) {
          res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
        }
        return;
      }

      if (event.type !== 'announcement.published') return;
      const audienceIds = Array.isArray(event.payload?.userIds)
        ? (event.payload.userIds as string[])
        : [];
      if (!audienceIds.includes(userId)) return;
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
