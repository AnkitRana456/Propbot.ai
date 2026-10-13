import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { tenantGuard } from '../middlewares/tenant-guard.js';
import { requirePermission } from '../middlewares/rbac.js';
import { webhooksController } from '../modules/webhooks/webhooks.controller.js';

export const webhooksManageRouter: Router = Router();

// Protect all management endpoints with authentication and tenant isolation
webhooksManageRouter.use(authenticate, tenantGuard);

// ---------------------------------------------------------------------------
// Webhook Endpoints Management
// ---------------------------------------------------------------------------
webhooksManageRouter.get(
  '/endpoints',
  requirePermission('view_webhooks'),
  (req, res, next) => {
    webhooksController.listEndpoints(req, res, next);
  },
);

webhooksManageRouter.post(
  '/endpoints',
  requirePermission('manage_webhooks'),
  (req, res, next) => {
    webhooksController.createEndpoint(req, res, next);
  },
);

webhooksManageRouter.get(
  '/endpoints/:id',
  requirePermission('view_webhooks'),
  (req, res, next) => {
    webhooksController.getEndpoint(req, res, next);
  },
);

webhooksManageRouter.put(
  '/endpoints/:id',
  requirePermission('manage_webhooks'),
  (req, res, next) => {
    webhooksController.updateEndpoint(req, res, next);
  },
);

webhooksManageRouter.delete(
  '/endpoints/:id',
  requirePermission('manage_webhooks'),
  (req, res, next) => {
    webhooksController.deleteEndpoint(req, res, next);
  },
);

webhooksManageRouter.post(
  '/endpoints/:id/test',
  requirePermission('manage_webhooks'),
  (req, res, next) => {
    webhooksController.sendTestEvent(req, res, next);
  },
);

// ---------------------------------------------------------------------------
// Webhook Delivery Logs & Observability
// ---------------------------------------------------------------------------
webhooksManageRouter.get(
  '/logs/kpis',
  requirePermission('view_webhooks'),
  (req, res, next) => {
    webhooksController.getKpis(req, res, next);
  },
);

webhooksManageRouter.get(
  '/logs',
  requirePermission('view_webhooks'),
  (req, res, next) => {
    webhooksController.getLogs(req, res, next);
  },
);

webhooksManageRouter.get(
  '/logs/:id',
  requirePermission('view_webhooks'),
  (req, res, next) => {
    webhooksController.getLogById(req, res, next);
  },
);

webhooksManageRouter.post(
  '/logs/:id/replay',
  requirePermission('manage_webhooks'),
  (req, res, next) => {
    webhooksController.replayWebhook(req, res, next);
  },
);
