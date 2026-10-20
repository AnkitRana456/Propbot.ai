import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  createCallCampaignSchema,
  createPhoneNumberSchema,
  createVoiceAgentSchema,
  dndInputSchema,
  startTestCallSchema,
  testCallTurnSchema,
  updateVoiceAgentSchema,
} from '@propbot/shared';
import { authenticate } from '../middlewares/authenticate.js';
import { tenantGuard } from '../middlewares/tenant-guard.js';
import { requirePermission } from '../middlewares/rbac.js';
import { aiTestRateLimiter } from '../middlewares/rate-limiter.js';
import { voiceStudioService } from '../modules/voice/voice-studio.service.js';
import { callCampaignsService } from '../modules/voice/call-campaigns.service.js';

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
const manage = requirePermission('manage_chatbots');
const view = requirePermission('view_leads');

export const voiceStudioRouter: Router = Router();
voiceStudioRouter.use(authenticate, tenantGuard);

// agents
voiceStudioRouter.get('/agents', manage, h(async (req, res) => send(res, await voiceStudioService.listAgents(company(req)))));
voiceStudioRouter.post('/agents', manage, h(async (req, res) => send(res, await voiceStudioService.createAgent(company(req), createVoiceAgentSchema.parse(req.body)), 201)));
voiceStudioRouter.put('/agents/:id', manage, h(async (req, res) => send(res, await voiceStudioService.updateAgent(company(req), param(req), updateVoiceAgentSchema.parse(req.body)))));
voiceStudioRouter.delete(
  '/agents/:id',
  manage,
  h(async (req, res) => {
    await voiceStudioService.removeAgent(company(req), param(req));
    return send(res, { deleted: true });
  }),
);
voiceStudioRouter.post('/agents/:id/test-call', manage, aiTestRateLimiter.middleware(), h(async (req, res) => send(res, await voiceStudioService.startTestCall(company(req), param(req), startTestCallSchema.parse(req.body ?? {}).leadId), 201)));

// simulated call turns
voiceStudioRouter.post('/calls/:id/turn', manage, aiTestRateLimiter.middleware(), h(async (req, res) => send(res, await voiceStudioService.turn(company(req), param(req), testCallTurnSchema.parse(req.body).utterance))));
voiceStudioRouter.post(
  '/calls/:id/end',
  manage,
  h(async (req, res) => send(res, await voiceStudioService.endCall(company(req), param(req), 'ended_by_user'))),
);

// numbers & DND
voiceStudioRouter.get('/numbers', manage, h(async (req, res) => send(res, await voiceStudioService.listNumbers(company(req)))));
voiceStudioRouter.post('/numbers', manage, h(async (req, res) => send(res, await voiceStudioService.addNumber(company(req), createPhoneNumberSchema.parse(req.body)), 201)));
voiceStudioRouter.put(
  '/numbers/:id',
  manage,
  h(async (req, res) => {
    const body = z.object({ voiceAgentId: z.string().uuid().nullable() }).parse(req.body);
    await voiceStudioService.assignNumber(company(req), param(req), body.voiceAgentId);
    return send(res, { updated: true });
  }),
);
voiceStudioRouter.delete(
  '/numbers/:id',
  manage,
  h(async (req, res) => {
    await voiceStudioService.removeNumber(company(req), param(req));
    return send(res, { deleted: true });
  }),
);
voiceStudioRouter.get('/dnd', manage, h(async (req, res) => send(res, await voiceStudioService.listDnd(company(req)))));
voiceStudioRouter.post('/dnd', manage, h(async (req, res) => send(res, await voiceStudioService.addDndNumbers(company(req), dndInputSchema.parse(req.body)), 201)));
voiceStudioRouter.delete(
  '/dnd/:id',
  manage,
  h(async (req, res) => {
    await voiceStudioService.removeDnd(company(req), param(req));
    return send(res, { deleted: true });
  }),
);

// calls & analytics
voiceStudioRouter.get(
  '/call-log',
  view,
  h(async (req, res) => {
    const q = z.object({ outcome: z.string().max(30).optional(), campaignId: z.string().uuid().optional(), leadId: z.string().uuid().optional(), limit: z.coerce.number().int().min(1).max(200).optional() }).parse(req.query);
    return send(res, await voiceStudioService.listCalls(company(req), q));
  }),
);
voiceStudioRouter.get('/call-log/:id', view, h(async (req, res) => send(res, await voiceStudioService.getCall(company(req), param(req)))));
voiceStudioRouter.get('/analytics', view, h(async (req, res) => send(res, await voiceStudioService.analytics(company(req), z.coerce.number().int().min(1).max(365).default(30).parse(req.query.days)))));

// campaigns
voiceStudioRouter.get('/campaigns', manage, h(async (req, res) => send(res, await callCampaignsService.list(company(req)))));
voiceStudioRouter.post('/campaigns', manage, h(async (req, res) => send(res, await callCampaignsService.create(company(req), user(req), createCallCampaignSchema.parse(req.body)), 201)));
voiceStudioRouter.get('/campaigns/:id', manage, h(async (req, res) => send(res, await callCampaignsService.get(company(req), param(req)))));
voiceStudioRouter.get('/campaigns/:id/targets', manage, h(async (req, res) => send(res, await callCampaignsService.targets(company(req), param(req)))));
voiceStudioRouter.post(
  '/campaigns/:id/status',
  manage,
  h(async (req, res) => send(res, await callCampaignsService.setStatus(company(req), param(req), z.object({ status: z.enum(['running', 'paused', 'cancelled']) }).parse(req.body).status))),
);
