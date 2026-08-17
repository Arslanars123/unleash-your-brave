import type { Request, Response, NextFunction } from 'express';
import type { EffectiveAccessService } from './access.service.js';

export class AccessController {
  constructor(private readonly access: EffectiveAccessService) {}

  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.auth?.userId;
      if (!userId) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
        return;
      }
      const eventId =
        typeof req.query.eventId === 'string' && req.query.eventId.trim()
          ? req.query.eventId.trim()
          : undefined;
      const result = await this.access.resolveForUser(userId, eventId);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  };
}
