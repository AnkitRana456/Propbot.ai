import { Router } from 'express';
import { leadsController } from '../modules/leads/leads.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { tenantGuard } from '../middlewares/tenant-guard.js';
import { requirePermission } from '../middlewares/rbac.js';

export const leadsRouter: Router = Router();

// All routes require authentication & tenant context
leadsRouter.use(authenticate, tenantGuard);

// Settings routes for scoring configuration
leadsRouter.get('/settings/scoring', requirePermission('view_leads'), (req, res, next) => {
  leadsController.getScoringConfig(req, res, next);
});

leadsRouter.put('/settings/scoring', requirePermission('manage_settings'), (req, res, next) => {
  leadsController.updateScoringConfig(req, res, next);
});

// Capture lead
leadsRouter.post('/capture', requirePermission('edit_leads'), (req, res, next) => {
  leadsController.capture(req, res, next);
});

// List leads
leadsRouter.get('/', requirePermission('view_leads'), (req, res, next) => {
  leadsController.list(req, res, next);
});

// Get lead detail by ID
leadsRouter.get('/:id', requirePermission('view_leads'), (req, res, next) => {
  leadsController.getById(req, res, next);
});

// Update lead status
leadsRouter.patch('/:id', requirePermission('edit_leads'), (req, res, next) => {
  leadsController.update(req, res, next);
});

leadsRouter.patch('/:id/status', requirePermission('edit_leads'), (req, res, next) => {
  leadsController.updateStatus(req, res, next);
});

// Merge duplicate leads
leadsRouter.post('/:id/merge', requirePermission('edit_leads'), (req, res, next) => {
  leadsController.merge(req, res, next);
});

// Get lead conversation transcript
leadsRouter.get('/:id/conversation', requirePermission('view_leads'), (req, res, next) => {
  leadsController.getConversation(req, res, next);
});
