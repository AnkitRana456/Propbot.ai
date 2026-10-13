import type { Request, Response, NextFunction } from 'express';
import { outboxDispatcherService } from './outbox-dispatcher.service.js';

export class EventsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const type = req.query.type as string | undefined;
      const status = req.query.status as 'all' | 'pending' | 'processed' | 'dead' | undefined;

      const result = await outboxDispatcherService.listEvents(companyId, {
        page,
        limit,
        type,
        status,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async replay(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const { id: eventId } = req.params;

      await outboxDispatcherService.replayEvent(companyId, eventId!);

      res.json({ success: true, message: 'Event scheduled for replay' });
    } catch (err) {
      next(err);
    }
  }
}

export const eventsController = new EventsController();
