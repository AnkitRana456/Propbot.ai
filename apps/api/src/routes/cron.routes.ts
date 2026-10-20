import { Router, type Request, type Response, type NextFunction } from 'express';
import { requireCronSecret } from '../middlewares/cron-auth.js';
import { scheduledJobsService } from '../jobs/scheduled-jobs.service.js';

/**
 * Endpoints for an external scheduler (Vercel-Cron style: `Authorization: Bearer $CRON_SECRET`).
 * The worker also runs the same jobs on its own timers; both paths are idempotent.
 * GET is accepted because most hosted cron services only issue GET requests.
 */
export const cronRouter: Router = Router();

const archiveChats = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await scheduledJobsService.archiveOldChats();
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

cronRouter.get('/archive-chats', requireCronSecret, archiveChats);
cronRouter.post('/archive-chats', requireCronSecret, archiveChats);
