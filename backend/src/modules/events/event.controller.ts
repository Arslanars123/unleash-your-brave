import type { Request, Response } from 'express';
import { buildPaginationMeta, sendPaginated, sendSuccess } from '../../core/http/response.js';
import type { EventAssociationService } from '../event-associations/event-association.service.js';
import type { EventOverviewService } from './event-overview.service.js';
import type { EventService } from './event.service.js';
import type {
  CreateEventInput,
  ListEventsQuery,
  ScheduleEventInput,
  UpdateEventInput,
} from './event.types.js';

export class EventController {
  constructor(
    private readonly service: EventService,
    private readonly associations?: EventAssociationService,
    private readonly overview?: EventOverviewService,
  ) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as ListEventsQuery;
    const { items, total } = await this.service.list(query);
    sendPaginated(res, items, buildPaginationMeta(query.page, query.perPage, total));
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.getById(req.params.id as string));
  };

  getOverview = async (req: Request, res: Response): Promise<void> => {
    if (!this.overview) {
      sendSuccess(res, {
        eventId: req.params.id,
        currency: 'usd',
        memberships: {
          soldCount: 0,
          uniqueBuyers: 0,
          revenue: 0,
          discountTotal: 0,
          couponRedemptions: 0,
          byMembership: [],
          byKind: { purchase: 0, upgrade: 0, renew: 0 },
        },
        store: { orderCount: 0, unitsSold: 0, uniqueBuyers: 0, revenue: 0 },
        checkins: { checkedInCount: 0, attendeeCount: 0 },
        totals: { revenue: 0, discountTotal: 0 },
      });
      return;
    }
    sendSuccess(res, await this.overview.getOverview(req.params.id as string));
  };

  getCurrent = async (_req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.getCurrent());
  };

  getWorkspace = async (_req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.getWorkspace());
  };

  listAvailable = async (_req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.listAvailableForPurchase());
  };

  listPrevious = async (_req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.listPrevious());
  };

  create = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.create(req.body as CreateEventInput), 201);
  };

  schedule = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.scheduleNew(req.body as ScheduleEventInput), 201);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      await this.service.update(req.params.id as string, req.body as UpdateEventInput),
    );
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    await this.service.delete(req.params.id as string);
    res.status(204).send();
  };

  getAssociations = async (req: Request, res: Response): Promise<void> => {
    if (!this.associations) {
      sendSuccess(res, {
        eventId: req.params.id,
        speakerIds: [],
        sponsorIds: [],
        membershipIds: [],
      });
      return;
    }
    sendSuccess(res, await this.associations.getForEvent(req.params.id as string));
  };

  setAssociations = async (req: Request, res: Response): Promise<void> => {
    if (!this.associations) {
      sendSuccess(res, {
        eventId: req.params.id,
        speakerIds: [],
        sponsorIds: [],
        membershipIds: [],
      });
      return;
    }
    sendSuccess(
      res,
      await this.associations.setForEvent(req.params.id as string, req.body),
    );
  };
}
