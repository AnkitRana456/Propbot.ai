import { Router, type NextFunction, type Request, type Response } from 'express';
import {
  GEMINI_MODELS,
  DEFAULT_AGENT_MODEL,
  compareAgentSchema,
  createAgentSchema,
  createFormSchema,
  knowledgeReferenceInputSchema,
  saveDraftSchema,
  testAgentSchema,
  testCaseSchema,
  updateAgentSchema,
  updateFormSchema,
} from '@propbot/shared';
import { z } from 'zod';
import { authenticate } from '../middlewares/authenticate.js';
import { tenantGuard } from '../middlewares/tenant-guard.js';
import { requirePermission } from '../middlewares/rbac.js';
import { aiTestRateLimiter } from '../middlewares/rate-limiter.js';
import { agentsService } from '../modules/agents/agents.service.js';
import { formsService } from '../modules/forms/forms.service.js';

type Handler = (req: Request, res: Response) => Promise<unknown>;
/** Wraps an async handler so rejections reach the central error handler. */
const h =
  (fn: Handler) =>
  (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };

const company = (req: Request) => req.tenant!.companyId;
const user = (req: Request) => req.tenant!.userId ?? null;
const param = (req: Request, name: string) => z.string().uuid().parse(req.params[name]);
const send = (res: Response, data: unknown, status = 200) => res.status(status).json({ success: true, data });

export const agentsRouter: Router = Router();
agentsRouter.use(authenticate, tenantGuard);

// ---------------------------------------------------------------- model registry
agentsRouter.get('/models', requirePermission('train_chatbots'), h(async (_req, res) => send(res, { default: DEFAULT_AGENT_MODEL, models: GEMINI_MODELS })));

// ---------------------------------------------------------------- templates / assignment
agentsRouter.get('/templates', requirePermission('train_chatbots'), h(async (_req, res) => send(res, agentsService.templates())));

agentsRouter.post(
  '/assign',
  requirePermission('manage_chatbots'),
  h(async (req, res) => {
    const body = z.object({ chatbotId: z.string().uuid(), agentId: z.string().uuid().nullable() }).parse(req.body);
    await agentsService.assignToChatbot(company(req), body.chatbotId, body.agentId);
    return send(res, { chatbotId: body.chatbotId, agentId: body.agentId });
  }),
);

// ---------------------------------------------------------------- agents
agentsRouter.get('/', requirePermission('train_chatbots'), h(async (req, res) => send(res, await agentsService.list(company(req)))));
agentsRouter.post(
  '/',
  requirePermission('manage_chatbots'),
  h(async (req, res) => send(res, await agentsService.create(company(req), user(req), createAgentSchema.parse(req.body)), 201)),
);
agentsRouter.get('/:id', requirePermission('train_chatbots'), h(async (req, res) => send(res, await agentsService.get(company(req), param(req, 'id')))));
agentsRouter.patch(
  '/:id',
  requirePermission('manage_chatbots'),
  h(async (req, res) => send(res, await agentsService.updateMeta(company(req), param(req, 'id'), updateAgentSchema.parse(req.body)))),
);
agentsRouter.delete(
  '/:id',
  requirePermission('manage_chatbots'),
  h(async (req, res) => {
    await agentsService.remove(company(req), param(req, 'id'));
    return send(res, { deleted: true });
  }),
);

// ---------------------------------------------------------------- versions
agentsRouter.put(
  '/:id/draft',
  requirePermission('train_chatbots'),
  h(async (req, res) => send(res, await agentsService.saveDraft(company(req), user(req), param(req, 'id'), saveDraftSchema.parse(req.body)))),
);
agentsRouter.get(
  '/:id/versions/:versionId',
  requirePermission('train_chatbots'),
  h(async (req, res) => send(res, await agentsService.getVersion(company(req), param(req, 'id'), param(req, 'versionId')))),
);
agentsRouter.delete(
  '/:id/versions/:versionId',
  requirePermission('train_chatbots'),
  h(async (req, res) => {
    await agentsService.discardDraft(company(req), param(req, 'id'), param(req, 'versionId'));
    return send(res, { deleted: true });
  }),
);
agentsRouter.post(
  '/:id/versions/:versionId/publish',
  requirePermission('manage_chatbots'),
  h(async (req, res) => {
    const body = z.object({ changeNote: z.string().max(500).optional().nullable() }).parse(req.body ?? {});
    return send(res, await agentsService.publish(company(req), param(req, 'id'), param(req, 'versionId'), body.changeNote));
  }),
);
agentsRouter.post(
  '/:id/versions/:versionId/rollback',
  requirePermission('manage_chatbots'),
  h(async (req, res) => send(res, await agentsService.rollback(company(req), user(req), param(req, 'id'), param(req, 'versionId')))),
);

// ---------------------------------------------------------------- test panel & comparison (each call spends Gemini tokens)
agentsRouter.post(
  '/:id/test',
  requirePermission('train_chatbots'),
  aiTestRateLimiter.middleware(),
  h(async (req, res) => send(res, await agentsService.test(company(req), param(req, 'id'), testAgentSchema.parse(req.body)))),
);
agentsRouter.post(
  '/:id/compare',
  requirePermission('train_chatbots'),
  aiTestRateLimiter.middleware(),
  h(async (req, res) => send(res, await agentsService.compare(company(req), param(req, 'id'), compareAgentSchema.parse(req.body)))),
);

agentsRouter.get('/:id/test-cases', requirePermission('train_chatbots'), h(async (req, res) => send(res, await agentsService.listTestCases(company(req), param(req, 'id')))));
agentsRouter.post(
  '/:id/test-cases',
  requirePermission('train_chatbots'),
  h(async (req, res) => send(res, await agentsService.saveTestCase(company(req), param(req, 'id'), testCaseSchema.parse(req.body)), 201)),
);
agentsRouter.put(
  '/:id/test-cases/:caseId',
  requirePermission('train_chatbots'),
  h(async (req, res) => send(res, await agentsService.saveTestCase(company(req), param(req, 'id'), testCaseSchema.parse(req.body), param(req, 'caseId')))),
);
agentsRouter.delete(
  '/:id/test-cases/:caseId',
  requirePermission('train_chatbots'),
  h(async (req, res) => {
    await agentsService.deleteTestCase(company(req), param(req, 'id'), param(req, 'caseId'));
    return send(res, { deleted: true });
  }),
);

// ================================================================ forms
export const formsRouter: Router = Router();
formsRouter.use(authenticate, tenantGuard);
formsRouter.get('/', requirePermission('view_leads'), h(async (req, res) => send(res, await formsService.list(company(req)))));
formsRouter.get('/:id', requirePermission('view_leads'), h(async (req, res) => send(res, await formsService.get(company(req), param(req, 'id')))));
formsRouter.post(
  '/',
  requirePermission('manage_chatbots'),
  h(async (req, res) => send(res, await formsService.create(company(req), user(req), createFormSchema.parse(req.body)), 201)),
);
formsRouter.put(
  '/:id',
  requirePermission('manage_chatbots'),
  h(async (req, res) => send(res, await formsService.update(company(req), param(req, 'id'), updateFormSchema.parse(req.body)))),
);
formsRouter.delete(
  '/:id',
  requirePermission('manage_chatbots'),
  h(async (req, res) => {
    await formsService.remove(company(req), param(req, 'id'));
    return send(res, { deleted: true });
  }),
);

// ================================================================ knowledge references
export const knowledgeReferencesRouter: Router = Router();
knowledgeReferencesRouter.use(authenticate, tenantGuard);
knowledgeReferencesRouter.get('/', requirePermission('train_chatbots'), h(async (req, res) => send(res, await agentsService.listReferences(company(req)))));
knowledgeReferencesRouter.post(
  '/',
  requirePermission('train_chatbots'),
  h(async (req, res) => send(res, await agentsService.saveReference(company(req), knowledgeReferenceInputSchema.parse(req.body)), 201)),
);
knowledgeReferencesRouter.put(
  '/:id',
  requirePermission('train_chatbots'),
  h(async (req, res) => send(res, await agentsService.saveReference(company(req), knowledgeReferenceInputSchema.parse(req.body), param(req, 'id')))),
);
knowledgeReferencesRouter.delete(
  '/:id',
  requirePermission('train_chatbots'),
  h(async (req, res) => {
    await agentsService.deleteReference(company(req), param(req, 'id'));
    return send(res, { deleted: true });
  }),
);
