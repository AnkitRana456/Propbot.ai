import { Router } from 'express';
import { whatsappController } from '../modules/whatsapp/whatsapp.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { tenantGuard } from '../middlewares/tenant-guard.js';
import { requirePermission } from '../middlewares/rbac.js';

export const whatsappRouter: Router = Router();

// All routes require authentication and tenant context
whatsappRouter.use(authenticate, tenantGuard);

// Configuration & Overview (manage_chatbots)
whatsappRouter.get(
  '/config',
  requirePermission('manage_chatbots'),
  (req, res, next) => whatsappController.getConfig(req, res, next),
);

whatsappRouter.put(
  '/config',
  requirePermission('manage_chatbots'),
  (req, res, next) => whatsappController.updateConfig(req, res, next),
);

whatsappRouter.post(
  '/config/generate-token',
  requirePermission('manage_chatbots'),
  (req, res, next) => whatsappController.generateVerifyToken(req, res, next),
);

whatsappRouter.get('/overview', (req, res, next) => whatsappController.getOverview(req, res, next));

// Shared Inbox (view_leads / edit_leads)
whatsappRouter.get(
  '/conversations',
  requirePermission('view_leads'),
  (req, res, next) => whatsappController.listConversations(req, res, next),
);

whatsappRouter.get(
  '/conversations/:id',
  requirePermission('view_leads'),
  (req, res, next) => whatsappController.getConversationDetail(req, res, next),
);

whatsappRouter.post(
  '/conversations/:id/messages',
  requirePermission('edit_leads'),
  (req, res, next) => whatsappController.sendAgentMessage(req, res, next),
);

whatsappRouter.post(
  '/conversations/:id/takeover',
  requirePermission('edit_leads'),
  (req, res, next) => whatsappController.takeover(req, res, next),
);

whatsappRouter.post(
  '/conversations/:id/resume-ai',
  requirePermission('edit_leads'),
  (req, res, next) => whatsappController.resumeAi(req, res, next),
);

whatsappRouter.post(
  '/conversations/:id/assign',
  requirePermission('edit_leads'),
  (req, res, next) => whatsappController.assign(req, res, next),
);

whatsappRouter.post(
  '/conversations/:id/close',
  requirePermission('edit_leads'),
  (req, res, next) => whatsappController.close(req, res, next),
);

// Broadcast Campaigns (manage_chatbots)
whatsappRouter.post(
  '/campaigns/broadcast',
  requirePermission('manage_chatbots'),
  (req, res, next) => whatsappController.broadcastCampaign(req, res, next),
);
