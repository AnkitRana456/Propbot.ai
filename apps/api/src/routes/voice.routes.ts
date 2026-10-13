import { Router } from 'express';
import { voiceController } from '../modules/voice/voice.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { tenantGuard } from '../middlewares/tenant-guard.js';
import { requirePermission } from '../middlewares/rbac.js';

export const voiceRouter: Router = Router();

// 1. Inbound telephony webhook (public callback from telephony provider)
voiceRouter.post('/webhooks/status', (req, res, next) => {
  voiceController.handleTelephonyWebhook(req, res, next);
});

// 2. Authenticated endpoints with tenant isolation
voiceRouter.post(
  '/callback',
  authenticate,
  tenantGuard,
  requirePermission('edit_leads'),
  (req, res, next) => {
    voiceController.initiateCallback(req, res, next);
  },
);

voiceRouter.post(
  '/manual-log',
  authenticate,
  tenantGuard,
  requirePermission('edit_leads'),
  (req, res, next) => {
    voiceController.logManualCall(req, res, next);
  },
);

voiceRouter.get(
  '/calls',
  authenticate,
  tenantGuard,
  requirePermission('view_leads'),
  (req, res, next) => {
    voiceController.listCalls(req, res, next);
  },
);
