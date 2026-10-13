import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { tenantGuard } from '../middlewares/tenant-guard.js';
import { requirePermission } from '../middlewares/rbac.js';
import { approvalsController } from '../modules/ai/approvals.controller.js';

export const approvalsRouter: Router = Router();

approvalsRouter.use(authenticate, tenantGuard);

// List pending approvals
approvalsRouter.get('/', (req, res, next) => approvalsController.listPending(req, res, next));

// Get realtime pending count
approvalsRouter.get('/count', (req, res, next) => approvalsController.getCount(req, res, next));

// Get full audit action history
approvalsRouter.get('/history', (req, res, next) => approvalsController.getHistory(req, res, next));

// Approve a sensitive T2 action (manager/admin only)
approvalsRouter.post('/:id/approve', requirePermission('approve_ai_actions'), (req, res, next) =>
  approvalsController.approve(req, res, next),
);

// Reject an action with reason (manager/admin only)
approvalsRouter.post('/:id/reject', requirePermission('approve_ai_actions'), (req, res, next) =>
  approvalsController.reject(req, res, next),
);
