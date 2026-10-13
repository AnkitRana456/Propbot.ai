import { Router } from 'express';
import { dashboardController } from '../modules/dashboard/dashboard.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { tenantGuard } from '../middlewares/tenant-guard.js';
import { requirePermission } from '../middlewares/rbac.js';

export const dashboardRouter: Router = Router();

dashboardRouter.get(
  '/stats',
  authenticate,
  tenantGuard,
  requirePermission('view_leads'),
  (req, res, next) => {
    dashboardController.getStats(req, res, next);
  },
);

dashboardRouter.get(
  '/recent-leads',
  authenticate,
  tenantGuard,
  requirePermission('view_leads'),
  (req, res, next) => {
    dashboardController.getRecentLeads(req, res, next);
  },
);

dashboardRouter.get('/notifications', authenticate, tenantGuard, (req, res, next) => {
  dashboardController.getNotifications(req, res, next);
});
