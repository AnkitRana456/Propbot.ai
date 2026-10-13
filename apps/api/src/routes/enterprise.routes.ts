import { Router } from 'express';
import { enterpriseController } from '../modules/enterprise/enterprise.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { tenantGuard } from '../middlewares/tenant-guard.js';
import { requirePermission } from '../middlewares/rbac.js';
import { ipAllowlistGuard } from '../modules/enterprise/ip-allowlist.middleware.js';

export const enterpriseRouter: Router = Router();
export const statusRouter: Router = Router();

// Public SLA / Uptime endpoints
statusRouter.get('/uptime', (req, res, next) => {
  enterpriseController.getUptimeStatus(req, res, next);
});

// Public SSO login redirect & callback
enterpriseRouter.get('/sso/login', (req, res, next) => {
  enterpriseController.initiateSso(req, res, next);
});

enterpriseRouter.post('/sso/callback', (req, res, next) => {
  enterpriseController.handleSsoCallback(req, res, next);
});

// Public compliance security pack
enterpriseRouter.get('/security-pack', (req, res, next) => {
  enterpriseController.getSecurityPack(req, res, next);
});

// Authenticated enterprise management (with IP allowlist guard)
enterpriseRouter.use(authenticate, tenantGuard, ipAllowlistGuard);

enterpriseRouter.get(
  '/sso',
  requirePermission('manage_settings'),
  (req, res, next) => {
    enterpriseController.getSsoConfig(req, res, next);
  },
);

enterpriseRouter.post(
  '/sso',
  requirePermission('manage_settings'),
  (req, res, next) => {
    enterpriseController.configureSso(req, res, next);
  },
);

enterpriseRouter.post(
  '/api-keys/:id/rotate',
  requirePermission('manage_settings'),
  (req, res, next) => {
    enterpriseController.rotateApiKey(req, res, next);
  },
);

enterpriseRouter.get(
  '/audit-logs/export',
  requirePermission('manage_settings'),
  (req, res, next) => {
    enterpriseController.exportAuditLogs(req, res, next);
  },
);
