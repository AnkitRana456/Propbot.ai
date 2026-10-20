import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  createChannelConnectionSchema,
  createLeadSourceSchema,
  createTemplateSchema,
  createWidgetSchema,
  csvImportSchema,
  inboxNoteSchema,
  inboxQuerySchema,
  inboxReplySchema,
  inboxUpdateSchema,
  updateChannelConnectionSchema,
  updateLeadSourceSchema,
  updateTemplateSchema,
  updateWidgetSchema,
} from '@propbot/shared';
import { authenticate } from '../middlewares/authenticate.js';
import { tenantGuard } from '../middlewares/tenant-guard.js';
import { requirePermission } from '../middlewares/rbac.js';
import { publicChatRateLimiter } from '../middlewares/rate-limiter.js';
import { inboxService } from '../modules/inbox/inbox.service.js';
import { channelsService } from '../modules/inbox/channels.service.js';
import { leadSourcesService } from '../modules/lead-sources/lead-sources.service.js';
import { enforcePolicy } from '../modules/controls/policies.service.js';
import { logAccess, maskEmail, maskPhone, privacySettingsService } from '../modules/controls/controls.service.js';
import { handleSocialWebhook, verifySocialChallenge } from '../modules/inbox/social-inbound.js';

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
  if (!id) throw Object.assign(new Error('A signed-in user is required.'), { statusCode: 401 });
  return id;
};
const param = (req: Request, name = 'id') => z.string().uuid().parse(req.params[name]);
const send = (res: Response, data: unknown, status = 200) => res.status(status).json({ success: true, data });

// ---------------------------------------------------------------- inbox
export const inboxRouter: Router = Router();
inboxRouter.use(authenticate, tenantGuard);
const view = requirePermission('view_leads');
const manage = requirePermission('manage_chatbots');

inboxRouter.get('/', view, enforcePolicy('inbox', 'view'), h(async (req, res) => {
  const out = await inboxService.list(company(req), inboxQuerySchema.parse(req.query), user(req));
  if (await privacySettingsService.shouldMask(company(req), req.tenant!.role)) for (const i of out.items) i.contactPhone = maskPhone(i.contactPhone);
  return send(res, out);
}));
inboxRouter.get('/counts', view, h(async (req, res) => send(res, await inboxService.counts(company(req)))));
inboxRouter.get('/:id', view, enforcePolicy('inbox', 'view'), logAccess('conversation', 'view'), h(async (req, res) => {
  const out = await inboxService.get(company(req), param(req));
  if (await privacySettingsService.shouldMask(company(req), req.tenant!.role)) {
    out.contactPhone = maskPhone(out.contactPhone);
    out.contact.email = maskEmail(out.contact.email);
  }
  return send(res, out);
}));
inboxRouter.post('/:id/reply', view, enforcePolicy('inbox', 'add'), h(async (req, res) => send(res, await inboxService.reply(company(req), me(req), param(req), inboxReplySchema.parse(req.body)))));
inboxRouter.post('/:id/take-control', view, h(async (req, res) => send(res, await inboxService.takeControl(company(req), me(req), param(req)))));
inboxRouter.post('/:id/hand-back', view, h(async (req, res) => send(res, await inboxService.handBackToAi(company(req), param(req)))));
inboxRouter.patch('/:id', view, h(async (req, res) => send(res, await inboxService.update(company(req), param(req), inboxUpdateSchema.parse(req.body)))));
inboxRouter.post('/:id/notes', view, h(async (req, res) => send(res, await inboxService.addNote(company(req), me(req), param(req), inboxNoteSchema.parse(req.body)), 201)));

// ---------------------------------------------------------------- lead sources
export const leadSourcesRouter: Router = Router();
leadSourcesRouter.use(authenticate, tenantGuard);
leadSourcesRouter.get('/', manage, h(async (req, res) => send(res, await leadSourcesService.list(company(req)))));
leadSourcesRouter.post('/', manage, h(async (req, res) => send(res, await leadSourcesService.create(company(req), user(req), createLeadSourceSchema.parse(req.body)), 201)));
leadSourcesRouter.put('/:id', manage, h(async (req, res) => send(res, await leadSourcesService.update(company(req), param(req), updateLeadSourceSchema.parse(req.body)))));
leadSourcesRouter.delete(
  '/:id',
  manage,
  h(async (req, res) => {
    await leadSourcesService.remove(company(req), param(req));
    return send(res, { deleted: true });
  }),
);
leadSourcesRouter.post('/:id/rotate-key', manage, h(async (req, res) => send(res, await leadSourcesService.rotateKey(company(req), param(req)))));
leadSourcesRouter.get('/:id/events', manage, h(async (req, res) => send(res, await leadSourcesService.events(company(req), param(req)))));
leadSourcesRouter.post('/:id/import-csv', manage, h(async (req, res) => send(res, await leadSourcesService.importCsv(company(req), param(req), csvImportSchema.parse(req.body).csv))));

// ---------------------------------------------------------------- channels, templates, widgets
export const channelsRouter: Router = Router();
channelsRouter.use(authenticate, tenantGuard);
channelsRouter.get('/connections', manage, h(async (req, res) => send(res, await channelsService.listConnections(company(req)))));
channelsRouter.post('/connections', manage, h(async (req, res) => send(res, await channelsService.createConnection(company(req), createChannelConnectionSchema.parse(req.body)), 201)));
channelsRouter.put('/connections/:id', manage, h(async (req, res) => send(res, await channelsService.updateConnection(company(req), param(req), updateChannelConnectionSchema.parse(req.body)))));
channelsRouter.post('/connections/:id/test', manage, h(async (req, res) => send(res, await channelsService.testConnection(company(req), param(req)))));
channelsRouter.delete(
  '/connections/:id',
  manage,
  h(async (req, res) => {
    await channelsService.removeConnection(company(req), param(req));
    return send(res, { deleted: true });
  }),
);

channelsRouter.get('/templates', view, h(async (req, res) => send(res, await channelsService.listTemplates(company(req)))));
channelsRouter.post('/templates', manage, h(async (req, res) => send(res, await channelsService.createTemplate(company(req), user(req), createTemplateSchema.parse(req.body)), 201)));
channelsRouter.put('/templates/:id', manage, h(async (req, res) => send(res, await channelsService.updateTemplate(company(req), param(req), updateTemplateSchema.parse(req.body)))));
channelsRouter.post('/templates/:id/submit', manage, h(async (req, res) => send(res, await channelsService.submitTemplate(company(req), param(req)))));
channelsRouter.delete(
  '/templates/:id',
  manage,
  h(async (req, res) => {
    await channelsService.removeTemplate(company(req), param(req));
    return send(res, { deleted: true });
  }),
);

channelsRouter.get('/widgets', manage, h(async (req, res) => send(res, await channelsService.listWidgets(company(req)))));
channelsRouter.post('/widgets', manage, h(async (req, res) => send(res, await channelsService.createWidget(company(req), createWidgetSchema.parse(req.body)), 201)));
channelsRouter.put('/widgets/:id', manage, h(async (req, res) => send(res, await channelsService.updateWidget(company(req), param(req), updateWidgetSchema.parse(req.body)))));
channelsRouter.delete(
  '/widgets/:id',
  manage,
  h(async (req, res) => {
    await channelsService.removeWidget(company(req), param(req));
    return send(res, { deleted: true });
  }),
);

// ---------------------------------------------------------------- public (no login)
export const omnichannelPublicRouter: Router = Router();

/** Lead ingestion for ad platforms and portals. Authenticated by the source API key. */
omnichannelPublicRouter.post(
  '/lead-sources/ingest',
  publicChatRateLimiter.middleware(),
  h(async (req, res) => {
    const source = await leadSourcesService.authenticate(String(req.headers['x-api-key'] ?? ''));
    const out = await leadSourcesService.ingest(source, req.body);
    return send(res, out, out.status === 'processed' || out.status === 'duplicate' ? 200 : 422);
  }),
);

omnichannelPublicRouter.get(
  '/widgets/:id',
  h(async (req, res) => send(res, await channelsService.publicWidget(z.string().uuid().parse(req.params.id), req.headers.origin))),
);

omnichannelPublicRouter.get('/webhooks/meta-social', (req, res) => {
  const challenge = verifySocialChallenge(req.query as Record<string, unknown>);
  if (challenge === null) return res.sendStatus(403);
  return res.status(200).send(challenge);
});
omnichannelPublicRouter.post(
  '/webhooks/meta-social',
  h(async (req, res) => {
    const out = await handleSocialWebhook(req.body, (req as Request & { rawBody?: Buffer }).rawBody, req.headers['x-hub-signature-256'] as string | undefined);
    return res.status(200).json({ success: true, data: out });
  }),
);
