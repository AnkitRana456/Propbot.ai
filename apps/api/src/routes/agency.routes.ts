import { Router } from 'express';
import { agencyController } from '../modules/agency/agency.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { tenantGuard } from '../middlewares/tenant-guard.js';
import { requirePermission } from '../middlewares/rbac.js';

export const agencyRouter: Router = Router();

agencyRouter.use(authenticate, tenantGuard);

agencyRouter.get('/clients', requirePermission('manage_company'), (req, res, next) =>
  agencyController.getClients(req, res, next),
);
agencyRouter.post('/clients', requirePermission('manage_company'), (req, res, next) =>
  agencyController.createClient(req, res, next),
);
agencyRouter.put(
  '/clients/:id/delivery-rules',
  requirePermission('manage_company'),
  (req, res, next) => agencyController.updateDeliveryRules(req, res, next),
);
agencyRouter.post(
  '/chatbots/:id/assign',
  requirePermission('manage_chatbots'),
  (req, res, next) => agencyController.assignChatbot(req, res, next),
);
agencyRouter.get('/portal', (req, res, next) =>
  agencyController.getClientPortal(req, res, next),
);
