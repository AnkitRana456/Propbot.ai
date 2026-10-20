import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { createFlowSchema, saveFlowDraftSchema, testFlowSchema, triggerFlowSchema, updateFlowSchema } from '@propbot/shared';
import { authenticate } from '../middlewares/authenticate.js';
import { tenantGuard } from '../middlewares/tenant-guard.js';
import { requirePermission } from '../middlewares/rbac.js';
import { aiTestRateLimiter } from '../middlewares/rate-limiter.js';
import { flowsService } from '../modules/flows/flows.service.js';

type Handler = (req: Request, res: Response) => Promise<unknown>;
const h =
  (fn: Handler) =>
  (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };
const company = (req: Request) => req.tenant!.companyId;
const user = (req: Request) => req.tenant!.userId ?? null;
const param = (req: Request, name: string) => z.string().uuid().parse(req.params[name]);
const send = (res: Response, data: unknown, status = 200) => res.status(status).json({ success: true, data });
const perm = requirePermission('manage_workflows');

export const flowsRouter: Router = Router();
flowsRouter.use(authenticate, tenantGuard);

flowsRouter.get('/templates', perm, h(async (_req, res) => send(res, flowsService.templates())));
flowsRouter.get('/', perm, h(async (req, res) => send(res, await flowsService.list(company(req)))));
flowsRouter.post('/', perm, h(async (req, res) => send(res, await flowsService.create(company(req), user(req), createFlowSchema.parse(req.body)), 201)));
flowsRouter.get('/:id', perm, h(async (req, res) => send(res, await flowsService.get(company(req), param(req, 'id')))));
flowsRouter.patch('/:id', perm, h(async (req, res) => send(res, await flowsService.updateMeta(company(req), param(req, 'id'), updateFlowSchema.parse(req.body)))));
flowsRouter.delete(
  '/:id',
  perm,
  h(async (req, res) => {
    await flowsService.remove(company(req), param(req, 'id'));
    return send(res, { deleted: true });
  }),
);
flowsRouter.put('/:id/draft', perm, h(async (req, res) => send(res, await flowsService.saveDraft(company(req), user(req), param(req, 'id'), saveFlowDraftSchema.parse(req.body)))));
flowsRouter.delete(
  '/:id/versions/:versionId',
  perm,
  h(async (req, res) => {
    await flowsService.discardDraft(company(req), param(req, 'id'), param(req, 'versionId'));
    return send(res, { deleted: true });
  }),
);
flowsRouter.post('/:id/versions/:versionId/publish', perm, h(async (req, res) => send(res, await flowsService.publish(company(req), param(req, 'id'), param(req, 'versionId')))));
flowsRouter.post('/:id/versions/:versionId/rollback', perm, h(async (req, res) => send(res, await flowsService.rollback(company(req), user(req), param(req, 'id'), param(req, 'versionId')))));
flowsRouter.post('/:id/test', perm, aiTestRateLimiter.middleware(), h(async (req, res) => send(res, await flowsService.test(company(req), param(req, 'id'), testFlowSchema.parse(req.body ?? {})))));
flowsRouter.post('/:id/trigger', perm, aiTestRateLimiter.middleware(), h(async (req, res) => send(res, await flowsService.trigger(company(req), param(req, 'id'), triggerFlowSchema.parse(req.body ?? {})), 202)));

export const executionsRouter: Router = Router();
executionsRouter.use(authenticate, tenantGuard);
executionsRouter.get(
  '/',
  perm,
  h(async (req, res) => {
    const q = z
      .object({
        flowId: z.string().uuid().optional(),
        status: z.enum(['running', 'waiting', 'completed', 'failed', 'cancelled']).optional(),
        includeTests: z.enum(['true', 'false']).optional(),
        limit: z.coerce.number().int().min(1).max(200).optional(),
      })
      .parse(req.query);
    return send(res, await flowsService.listExecutions(company(req), { ...q, includeTests: q.includeTests === 'true' }));
  }),
);
executionsRouter.get('/:id', perm, h(async (req, res) => send(res, await flowsService.getExecution(company(req), param(req, 'id')))));
executionsRouter.post('/:id/cancel', perm, h(async (req, res) => send(res, await flowsService.cancelExecution(company(req), param(req, 'id')))));
