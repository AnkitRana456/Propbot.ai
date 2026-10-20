import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { createToolSchema, runToolSchema, updateToolSchema } from '@propbot/shared';
import { authenticate } from '../middlewares/authenticate.js';
import { tenantGuard } from '../middlewares/tenant-guard.js';
import { requirePermission } from '../middlewares/rbac.js';
import { aiTestRateLimiter } from '../middlewares/rate-limiter.js';
import { toolsService } from '../modules/tools/tools.service.js';
import { listActions, runAction } from '../modules/tools/actions.js';

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

export const toolsRouter: Router = Router();
toolsRouter.use(authenticate, tenantGuard);

toolsRouter.get('/', requirePermission('manage_chatbots'), h(async (req, res) => send(res, await toolsService.list(company(req)))));
toolsRouter.post(
  '/',
  requirePermission('manage_chatbots'),
  h(async (req, res) => send(res, await toolsService.create(company(req), user(req), createToolSchema.parse(req.body)), 201)),
);
toolsRouter.get('/:id', requirePermission('manage_chatbots'), h(async (req, res) => send(res, await toolsService.get(company(req), param(req, 'id')))));
toolsRouter.put(
  '/:id',
  requirePermission('manage_chatbots'),
  h(async (req, res) => send(res, await toolsService.update(company(req), param(req, 'id'), updateToolSchema.parse(req.body)))),
);
toolsRouter.delete('/:id', requirePermission('manage_chatbots'), h(async (req, res) => send(res, await toolsService.remove(company(req), param(req, 'id')))));
toolsRouter.get('/:id/runs', requirePermission('manage_chatbots'), h(async (req, res) => send(res, await toolsService.runs(company(req), param(req, 'id')))));
toolsRouter.post(
  '/:id/run',
  requirePermission('manage_chatbots'),
  aiTestRateLimiter.middleware(),
  h(async (req, res) => {
    const { input } = runToolSchema.parse(req.body ?? {});
    return send(res, await toolsService.execute(company(req), param(req, 'id'), input, { userId: user(req), source: 'test' }));
  }),
);

export const actionsRouter: Router = Router();
actionsRouter.use(authenticate, tenantGuard);
actionsRouter.get('/', requirePermission('manage_chatbots'), h(async (_req, res) => send(res, listActions())));
actionsRouter.post(
  '/:id/run',
  requirePermission('manage_chatbots'),
  aiTestRateLimiter.middleware(),
  h(async (req, res) => {
    const { input } = runToolSchema.parse(req.body ?? {});
    const id = z.string().min(1).max(60).parse(req.params.id);
    return send(res, await runAction(id, { companyId: company(req), userId: user(req) }, input));
  }),
);
