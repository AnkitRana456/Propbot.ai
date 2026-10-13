import { Router } from 'express';
import { settingsController } from '../modules/settings/settings.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { tenantGuard } from '../middlewares/tenant-guard.js';
import { requirePermission } from '../middlewares/rbac.js';

export const settingsRouter: Router = Router();

settingsRouter.use(authenticate, tenantGuard);

// Personal 2FA setup & verification (any active authenticated user)
settingsRouter.post('/security/2fa/setup', (req, res, next) =>
  settingsController.setupTwoFactor(req, res, next),
);
settingsRouter.post('/security/2fa/verify', (req, res, next) =>
  settingsController.verifyTwoFactor(req, res, next),
);
settingsRouter.post('/security/2fa/disable', (req, res, next) =>
  settingsController.disableTwoFactor(req, res, next),
);

// Company & tenant settings (require manage_settings)
settingsRouter.use(requirePermission('manage_settings'));

settingsRouter.get('/', (req, res, next) => settingsController.getSettings(req, res, next));
settingsRouter.put('/profile', (req, res, next) => settingsController.updateProfile(req, res, next));
settingsRouter.put('/operations', (req, res, next) =>
  settingsController.updateOperations(req, res, next),
);
settingsRouter.put('/ai-controls', (req, res, next) =>
  settingsController.updateAiControls(req, res, next),
);
settingsRouter.get('/api-keys', (req, res, next) => settingsController.getApiKeys(req, res, next));
settingsRouter.post('/api-keys', (req, res, next) =>
  settingsController.createApiKey(req, res, next),
);
settingsRouter.delete('/api-keys/:id', (req, res, next) =>
  settingsController.revokeApiKey(req, res, next),
);
settingsRouter.put('/security/ip-allowlist', (req, res, next) =>
  settingsController.updateIpAllowlist(req, res, next),
);
settingsRouter.get('/data/export', (req, res, next) =>
  settingsController.exportData(req, res, next),
);
