import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  applyTagSchema,
  boardTaskCommentSchema,
  createBoardSchema,
  createBoardTaskSchema,
  createDashboardSchema,
  createGroupSchema,
  createSurveySchema,
  createTagSchema,
  createWidgetDefSchema,
  groupRuleSchema,
  kbTestSchema,
  moveBoardTaskSchema,
  recordSurveyResponseSchema,
  updateBoardSchema,
  updateBoardTaskSchema,
  updateDashboardSchema,
  updateGroupSchema,
  updateSurveySchema,
  updateTagSchema,
} from '@propbot/shared';
import { authenticate } from '../middlewares/authenticate.js';
import { tenantGuard } from '../middlewares/tenant-guard.js';
import { requirePermission } from '../middlewares/rbac.js';
import { aiTestRateLimiter } from '../middlewares/rate-limiter.js';
import { enforcePolicy } from '../modules/controls/policies.service.js';
import { logAccess, maskEmail, maskPhone, privacySettingsService } from '../modules/controls/controls.service.js';
import { groupsService, tagsService } from '../modules/intelligence/tags-groups.service.js';
import { insightsService, surveysService } from '../modules/intelligence/insights.service.js';
import { contact360Service } from '../modules/intelligence/contact360.service.js';
import { dashboardsService } from '../modules/intelligence/dashboards.service.js';
import { boardsService } from '../modules/intelligence/boards.service.js';
import { kbTesterService } from '../modules/intelligence/kb-tester.service.js';

type Handler = (req: Request, res: Response) => Promise<unknown>;
const h =
  (fn: Handler) =>
  (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };
const company = (req: Request) => req.tenant!.companyId;
const user = (req: Request) => req.tenant!.userId ?? null;
const param = (req: Request, name = 'id') => z.string().uuid().parse(req.params[name]);
const send = (res: Response, data: unknown, status = 200) => res.status(status).json({ success: true, data });
const ok = (res: Response) => send(res, { ok: true });
const view = requirePermission('view_leads');
const edit = requirePermission('edit_leads');
const manage = requirePermission('manage_chatbots');
const analytics = requirePermission('view_analytics');

function guarded(): Router {
  const r = Router();
  r.use(authenticate, tenantGuard);
  return r;
}

// ---------------------------------------------------------------- tags
export const tagsRouter: Router = guarded();
tagsRouter.get('/', view, h(async (req, res) => send(res, await tagsService.list(company(req)))));
tagsRouter.post('/', edit, h(async (req, res) => send(res, await tagsService.create(company(req), createTagSchema.parse(req.body)), 201)));
tagsRouter.put('/:id', edit, h(async (req, res) => send(res, await tagsService.update(company(req), param(req), updateTagSchema.parse(req.body)))));
tagsRouter.delete('/:id', edit, h(async (req, res) => (await tagsService.remove(company(req), param(req)), ok(res))));
tagsRouter.post('/:id/apply', edit, h(async (req, res) => send(res, await tagsService.apply(company(req), param(req), applyTagSchema.parse(req.body)))));
tagsRouter.post('/:id/unapply', edit, h(async (req, res) => send(res, await tagsService.unapply(company(req), param(req), applyTagSchema.parse(req.body)))));

// ---------------------------------------------------------------- groups
export const groupsRouter: Router = guarded();
groupsRouter.get('/', view, h(async (req, res) => send(res, await groupsService.list(company(req)))));
groupsRouter.post('/preview', view, h(async (req, res) => send(res, await groupsService.preview(company(req), z.object({ rules: z.array(groupRuleSchema).max(12) }).parse(req.body).rules))));
groupsRouter.post('/', edit, h(async (req, res) => send(res, await groupsService.create(company(req), user(req), createGroupSchema.parse(req.body)), 201)));
groupsRouter.put('/:id', edit, h(async (req, res) => send(res, await groupsService.update(company(req), param(req), updateGroupSchema.parse(req.body)))));
groupsRouter.delete('/:id', edit, h(async (req, res) => (await groupsService.remove(company(req), param(req)), ok(res))));
groupsRouter.post('/:id/refresh', edit, h(async (req, res) => send(res, await groupsService.refresh(company(req), param(req)))));
groupsRouter.get('/:id/members', view, h(async (req, res) => send(res, await groupsService.members(company(req), param(req)))));

// ---------------------------------------------------------------- 360 view & insights
export const customer360Router: Router = guarded();
customer360Router.get('/contacts/:id', view, enforcePolicy('contacts', 'view'), logAccess('contact_360', 'view'), h(async (req, res) => {
  const out = await contact360Service.get(company(req), param(req));
  if (await privacySettingsService.shouldMask(company(req), req.tenant!.role)) {
    out.contact.phone = maskPhone(out.contact.phone);
    out.contact.email = maskEmail(out.contact.email);
  }
  return send(res, out);
}));
customer360Router.get('/conversations/:id/insight', view, h(async (req, res) => send(res, await insightsService.get(company(req), param(req)))));
customer360Router.post('/conversations/:id/insight', view, aiTestRateLimiter.middleware(), h(async (req, res) => send(res, await insightsService.generate(company(req), param(req)))));

// ---------------------------------------------------------------- surveys
export const surveysRouter: Router = guarded();
surveysRouter.get('/', view, h(async (req, res) => send(res, await surveysService.list(company(req)))));
surveysRouter.post('/', manage, h(async (req, res) => send(res, await surveysService.create(company(req), createSurveySchema.parse(req.body)), 201)));
surveysRouter.put('/:id', manage, h(async (req, res) => (await surveysService.update(company(req), param(req), updateSurveySchema.parse(req.body)), ok(res))));
surveysRouter.delete('/:id', manage, h(async (req, res) => (await surveysService.remove(company(req), param(req)), ok(res))));
surveysRouter.post('/:id/responses', edit, h(async (req, res) => send(res, await surveysService.record(company(req), param(req), recordSurveyResponseSchema.parse(req.body)), 201)));
surveysRouter.get('/:id/stats', view, h(async (req, res) => send(res, await surveysService.stats(company(req), param(req)))));

// ---------------------------------------------------------------- dashboards
export const dashboardsRouter: Router = guarded();
dashboardsRouter.get('/', analytics, h(async (req, res) => send(res, await dashboardsService.list(company(req), user(req)))));
dashboardsRouter.post('/', analytics, h(async (req, res) => send(res, await dashboardsService.create(company(req), user(req), createDashboardSchema.parse(req.body)), 201)));
dashboardsRouter.get('/:id', analytics, h(async (req, res) => send(res, await dashboardsService.get(company(req), user(req), param(req)))));
dashboardsRouter.put('/:id', analytics, h(async (req, res) => send(res, await dashboardsService.update(company(req), user(req), param(req), updateDashboardSchema.parse(req.body)))));
dashboardsRouter.delete('/:id', analytics, h(async (req, res) => (await dashboardsService.remove(company(req), user(req), param(req)), ok(res))));
dashboardsRouter.post('/:id/widgets', analytics, h(async (req, res) => send(res, await dashboardsService.addWidget(company(req), user(req), param(req), createWidgetDefSchema.parse(req.body)), 201)));
dashboardsRouter.delete('/:id/widgets/:widgetId', analytics, h(async (req, res) => (await dashboardsService.removeWidget(company(req), user(req), param(req), param(req, 'widgetId')), ok(res))));
dashboardsRouter.get('/:id/widgets/:widgetId/data', analytics, h(async (req, res) => send(res, await dashboardsService.widgetData(company(req), user(req), param(req), param(req, 'widgetId')))));

// ---------------------------------------------------------------- boards
export const boardsRouter: Router = guarded();
boardsRouter.get('/', view, h(async (req, res) => send(res, await boardsService.list(company(req)))));
boardsRouter.post('/', edit, h(async (req, res) => send(res, await boardsService.create(company(req), user(req), createBoardSchema.parse(req.body)), 201)));
boardsRouter.put('/:id', edit, h(async (req, res) => send(res, await boardsService.update(company(req), param(req), updateBoardSchema.parse(req.body)))));
boardsRouter.delete('/:id', edit, h(async (req, res) => (await boardsService.remove(company(req), param(req)), ok(res))));
boardsRouter.get('/:id/tasks', view, h(async (req, res) => send(res, await boardsService.tasks(company(req), param(req)))));
boardsRouter.post('/:id/tasks', edit, h(async (req, res) => send(res, await boardsService.createTask(company(req), user(req), param(req), createBoardTaskSchema.parse(req.body)), 201)));
boardsRouter.put('/:id/tasks/:taskId', edit, h(async (req, res) => send(res, await boardsService.updateTask(company(req), param(req), param(req, 'taskId'), updateBoardTaskSchema.parse(req.body)))));
boardsRouter.post('/:id/tasks/:taskId/move', edit, h(async (req, res) => {
  const b = moveBoardTaskSchema.parse(req.body);
  return send(res, await boardsService.moveTask(company(req), param(req), param(req, 'taskId'), b.columnKey, b.position));
}));
boardsRouter.delete('/:id/tasks/:taskId', edit, h(async (req, res) => (await boardsService.deleteTask(company(req), param(req), param(req, 'taskId')), ok(res))));
boardsRouter.get('/:id/tasks/:taskId/comments', view, h(async (req, res) => send(res, await boardsService.comments(company(req), param(req), param(req, 'taskId')))));
boardsRouter.post('/:id/tasks/:taskId/comments', edit, h(async (req, res) => send(res, await boardsService.addComment(company(req), user(req), param(req), param(req, 'taskId'), boardTaskCommentSchema.parse(req.body).body), 201)));

// ---------------------------------------------------------------- KB tester
export const kbTesterRouter: Router = guarded();
kbTesterRouter.post('/', requirePermission('train_chatbots'), aiTestRateLimiter.middleware(), h(async (req, res) => {
  const b = kbTestSchema.parse(req.body);
  return send(res, await kbTesterService.run(company(req), user(req), b.chatbotId, b.question), 201);
}));
kbTesterRouter.get('/', requirePermission('train_chatbots'), h(async (req, res) => send(res, await kbTesterService.history(company(req), typeof req.query.chatbotId === 'string' ? z.string().uuid().parse(req.query.chatbotId) : undefined))));
