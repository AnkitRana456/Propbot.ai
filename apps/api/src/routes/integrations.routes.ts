import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { tenantGuard } from '../middlewares/tenant-guard.js';
import { requirePermission } from '../middlewares/rbac.js';
import { integrationsController } from '../modules/integrations/integrations.controller.js';

export const integrationsRouter: Router = Router();

integrationsRouter.use(authenticate, tenantGuard);

integrationsRouter.get(
  '/',
  requirePermission('view_webhooks'),
  (req, res, next) => {
    integrationsController.listIntegrations(req, res, next);
  },
);

integrationsRouter.put(
  '/:provider',
  requirePermission('manage_webhooks'),
  (req, res, next) => {
    integrationsController.updateIntegration(req, res, next);
  },
);

integrationsRouter.post(
  '/:provider/test',
  requirePermission('manage_webhooks'),
  (req, res, next) => {
    integrationsController.testSync(req, res, next);
  },
);

integrationsRouter.post(
  '/pixel/track',
  (req, res, next) => {
    integrationsController.trackConversion(req, res, next);
  },
);
