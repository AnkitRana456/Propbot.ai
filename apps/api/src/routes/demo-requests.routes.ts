import { Router, type NextFunction, type Request, type Response } from 'express';
import { createDemoRequestSchema } from '@propbot/shared';
import { demoRequestsService } from '../modules/demo-requests/demo-requests.service.js';
import { demoRequestRateLimiter } from '../middlewares/rate-limiter.js';

export const demoRequestsRouter: Router = Router();

demoRequestsRouter.post('/', demoRequestRateLimiter.middleware(), (req: Request, res: Response, next: NextFunction): void => {
  (async () => {
    const input = createDemoRequestSchema.parse(req.body ?? {});
    await demoRequestsService.create(input);
    res.status(201).json({ success: true, data: { received: true } });
  })().catch(next);
});
