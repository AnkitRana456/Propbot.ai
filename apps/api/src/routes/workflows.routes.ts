import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { tenantGuard } from '../middlewares/tenant-guard.js';
import { requirePermission } from '../middlewares/rbac.js';
import { workflowsController } from '../modules/workflows/workflows.controller.js';

export const workflowsRouter: Router = Router();

workflowsRouter.use(authenticate, tenantGuard);

workflowsRouter.get(
  '/',
  requirePermission('manage_chatbots'),
  workflowsController.listWorkflows.bind(workflowsController),
);

workflowsRouter.get(
  '/templates',
  requirePermission('manage_chatbots'),
  workflowsController.getTemplates.bind(workflowsController),
);

workflowsRouter.post(
  '/',
  requirePermission('manage_chatbots'),
  workflowsController.createWorkflow.bind(workflowsController),
);

workflowsRouter.post(
  '/draft-from-prompt',
  requirePermission('manage_chatbots'),
  workflowsController.draftFromPrompt.bind(workflowsController),
);

workflowsRouter.get(
  '/:id',
  requirePermission('manage_chatbots'),
  workflowsController.getWorkflow.bind(workflowsController),
);

workflowsRouter.put(
  '/:id',
  requirePermission('manage_chatbots'),
  workflowsController.updateWorkflow.bind(workflowsController),
);

workflowsRouter.post(
  '/:id/activate',
  requirePermission('manage_chatbots'),
  workflowsController.activateWorkflow.bind(workflowsController),
);

workflowsRouter.post(
  '/:id/pause',
  requirePermission('manage_chatbots'),
  workflowsController.pauseWorkflow.bind(workflowsController),
);

workflowsRouter.post(
  '/:id/test',
  requirePermission('manage_chatbots'),
  workflowsController.testWorkflow.bind(workflowsController),
);

workflowsRouter.get(
  '/:id/runs',
  requirePermission('manage_chatbots'),
  workflowsController.getRuns.bind(workflowsController),
);

workflowsRouter.get(
  '/runs/:runId/steps',
  requirePermission('manage_chatbots'),
  workflowsController.getRunSteps.bind(workflowsController),
);
