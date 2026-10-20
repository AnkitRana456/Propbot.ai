import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  accessLogQuerySchema,
  assignPolicySchema,
  createDataRequestSchema,
  createNotificationRuleSchema,
  createPolicySchema,
  createTeamSchema,
  evaluatePolicySchema,
  privacySettingsSchema,
  recordConsentSchema,
  updatePolicySchema,
  updateTeamSchema,
} from '@propbot/shared';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema/index.js';
import { authenticate } from '../middlewares/authenticate.js';
import { tenantGuard } from '../middlewares/tenant-guard.js';
import { requirePermission } from '../middlewares/rbac.js';
import { policiesService, teamsService } from '../modules/controls/policies.service.js';
import { accessLogsService, changelogService, notificationsService, privacyService, privacySettingsService, usageService } from '../modules/controls/controls.service.js';
import { ApiError } from '../utils/api-error.js';

type Handler = (req: Request, res: Response) => Promise<unknown>;
const h =
  (fn: Handler) =>
  (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };
const company = (req: Request) => req.tenant!.companyId;
const user = (req: Request) => req.tenant!.userId ?? null;
const me = (req: Request) => {
  const id = user(req);
  if (!id) throw new ApiError(401, 'UNAUTHORIZED', 'A signed-in user is required.');
  return id;
};
const param = (req: Request, name = 'id') => z.string().uuid().parse(req.params[name]);
const send = (res: Response, data: unknown, status = 200) => res.status(status).json({ success: true, data });
const ok = (res: Response) => send(res, { ok: true });
const admin = requirePermission('manage_settings');

export const controlsRouter: Router = Router();
controlsRouter.use(authenticate, tenantGuard);

// teams
controlsRouter.get('/teams', requirePermission('view_leads'), h(async (req, res) => send(res, await teamsService.list(company(req)))));
controlsRouter.post('/teams', requirePermission('manage_users'), h(async (req, res) => send(res, await teamsService.create(company(req), createTeamSchema.parse(req.body)), 201)));
controlsRouter.put('/teams/:id', requirePermission('manage_users'), h(async (req, res) => send(res, await teamsService.update(company(req), param(req), updateTeamSchema.parse(req.body)))));
controlsRouter.delete('/teams/:id', requirePermission('manage_users'), h(async (req, res) => (await teamsService.remove(company(req), param(req)), ok(res))));

// policies (administration is role-gated and never subject to policies, so nobody can lock themselves out)
controlsRouter.get('/policies', admin, h(async (req, res) => send(res, await policiesService.list(company(req)))));
controlsRouter.post('/policies', admin, h(async (req, res) => send(res, await policiesService.create(company(req), user(req), createPolicySchema.parse(req.body)), 201)));
controlsRouter.put('/policies/:id', admin, h(async (req, res) => send(res, await policiesService.update(company(req), user(req), param(req), updatePolicySchema.parse(req.body)))));
controlsRouter.delete('/policies/:id', admin, h(async (req, res) => (await policiesService.remove(company(req), user(req), param(req)), ok(res))));
controlsRouter.post('/policies/:id/assignments', admin, h(async (req, res) => send(res, await policiesService.assign(company(req), user(req), param(req), assignPolicySchema.parse(req.body)), 201)));
controlsRouter.delete('/policies/:id/assignments/:assignmentId', admin, h(async (req, res) => send(res, await policiesService.unassign(company(req), user(req), param(req), param(req, 'assignmentId')))));
controlsRouter.get('/policy-changes', admin, h(async (req, res) => send(res, await policiesService.changes(company(req)))));
controlsRouter.post(
  '/policies/evaluate',
  admin,
  h(async (req, res) => {
    const b = evaluatePolicySchema.parse(req.body);
    const [u] = await db.select({ role: users.role }).from(users).where(and(eq(users.id, b.userId), eq(users.companyId, company(req))));
    if (!u) throw new ApiError(404, 'NOT_FOUND', 'User not found.');
    return send(res, await policiesService.evaluate(company(req), { userId: b.userId, role: u.role }, b.module, b.action));
  }),
);

// access logs
controlsRouter.get('/access-logs', admin, h(async (req, res) => send(res, await accessLogsService.list(company(req), accessLogQuerySchema.parse(req.query)))));
controlsRouter.get(
  '/access-logs/export.csv',
  admin,
  h(async (req, res) => {
    const rows = await accessLogsService.list(company(req), { ...accessLogQuerySchema.parse(req.query), limit: 500 });
    accessLogsService.record({ companyId: company(req), userId: user(req), action: 'export', resourceType: 'access_logs', ip: req.ip, userAgent: req.headers['user-agent'] });
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""').replace(/^([=+\-@])/, "'$1")}"`;
    const csv = ['time,person,action,resource,resource_id,ip', ...rows.map(r => [r.createdAt, r.userName ?? r.userId ?? 'api key', r.action, r.resourceType, r.resourceId, r.ipAddress].map(esc).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8').setHeader('Content-Disposition', 'attachment; filename="access-logs.csv"');
    res.status(200).send(csv);
  }),
);

// privacy
controlsRouter.get('/privacy', admin, h(async (req, res) => send(res, await privacySettingsService.get(company(req)))));
controlsRouter.put('/privacy', admin, h(async (req, res) => send(res, await privacySettingsService.set(company(req), privacySettingsSchema.parse(req.body)))));
controlsRouter.post('/consent', requirePermission('edit_leads'), h(async (req, res) => send(res, await privacyService.recordConsent(company(req), recordConsentSchema.parse(req.body)), 201)));
controlsRouter.get('/consent/:contactId', requirePermission('view_leads'), h(async (req, res) => send(res, await privacyService.consentFor(company(req), param(req, 'contactId')))));
controlsRouter.get('/data-requests', admin, h(async (req, res) => send(res, await privacyService.listRequests(company(req)))));
controlsRouter.post('/data-requests', admin, h(async (req, res) => send(res, await privacyService.createRequest(company(req), user(req), createDataRequestSchema.parse(req.body)), 201)));
controlsRouter.post('/data-requests/:id/decision', admin, h(async (req, res) => send(res, await privacyService.decide(company(req), param(req), z.object({ decision: z.enum(['approve', 'reject']) }).parse(req.body).decision))));
controlsRouter.get(
  '/data-requests/:id/download',
  admin,
  h(async (req, res) => {
    const body = await privacyService.download(company(req), param(req));
    accessLogsService.record({ companyId: company(req), userId: user(req), action: 'download', resourceType: 'data_request', resourceId: param(req), ip: req.ip, userAgent: req.headers['user-agent'] });
    res.setHeader('Content-Type', 'application/json').setHeader('Content-Disposition', 'attachment; filename="personal-data.json"');
    res.status(200).send(body);
  }),
);

// notifications: rules (admin) and the personal centre (everyone)
controlsRouter.get('/notification-rules', admin, h(async (req, res) => send(res, await notificationsService.listRules(company(req)))));
controlsRouter.post('/notification-rules', admin, h(async (req, res) => send(res, await notificationsService.createRule(company(req), createNotificationRuleSchema.parse(req.body)), 201)));
controlsRouter.delete('/notification-rules/:id', admin, h(async (req, res) => (await notificationsService.removeRule(company(req), param(req)), ok(res))));
controlsRouter.get('/notifications', h(async (req, res) => send(res, await notificationsService.list(company(req), me(req), req.query.unread === 'true'))));
controlsRouter.post('/notifications/read', h(async (req, res) => send(res, { updated: await notificationsService.markRead(company(req), me(req), z.object({ ids: z.array(z.string().uuid()).max(200).optional() }).parse(req.body ?? {}).ids) })));

// usage
controlsRouter.get('/usage', requirePermission('view_analytics'), h(async (req, res) => send(res, await usageService.summary(company(req), z.coerce.number().int().min(1).max(365).default(30).parse(req.query.days)))));

// changelog: reading is public (see publicControlsRouter), writing is for the platform owner only
controlsRouter.post(
  '/changelog',
  h(async (req, res) => {
    if (req.tenant!.role !== 'ps-owner') throw new ApiError(403, 'FORBIDDEN', 'Only the platform owner can publish changelog entries.');
    const b = z.object({ title: z.string().min(2).max(200), bodyMd: z.string().min(2).max(10_000), category: z.enum(['feature', 'improvement', 'fix', 'security']).default('feature') }).parse(req.body);
    return send(res, await changelogService.create(b), 201);
  }),
);

export const publicControlsRouter: Router = Router();
publicControlsRouter.get('/changelog', h(async (_req, res) => send(res, await changelogService.list())));
