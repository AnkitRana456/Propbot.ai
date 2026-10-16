import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { tenantGuard } from '../middlewares/tenant-guard.js';
import { requirePermission, requireRole } from '../middlewares/rbac.js';
import { integrationsController } from '../modules/integrations/integrations.controller.js';

export const integrationsRouter: Router = Router();

integrationsRouter.use(authenticate, tenantGuard);

// Platform integration status (super_admin)
integrationsRouter.get(
  '/platform',
  requireRole('super_admin'),
  (req, res, next) => {
    integrationsController.getPlatformIntegrations(req, res, next);
  },
);

// List company integrations
integrationsRouter.get(
  '/',
  requirePermission('view_webhooks'),
  (req, res, next) => {
    integrationsController.listIntegrations(req, res, next);
  },
);

// Update/create company integration (AES-256 encrypted)
integrationsRouter.put(
  '/:provider',
  requirePermission('manage_webhooks'),
  (req, res, next) => {
    integrationsController.updateIntegration(req, res, next);
  },
);

// Disconnect company integration
integrationsRouter.delete(
  '/:provider',
  requirePermission('manage_webhooks'),
  (req, res, next) => {
    integrationsController.disconnectIntegration(req, res, next);
  },
);

// Test company integration sync
integrationsRouter.post(
  '/:provider/test',
  requirePermission('manage_webhooks'),
  (req, res, next) => {
    integrationsController.testSync(req, res, next);
  },
);

// Track conversion pixel events
integrationsRouter.post(
  '/pixel/track',
  (req, res, next) => {
    integrationsController.trackConversion(req, res, next);
  },
);
