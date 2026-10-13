import { Router } from 'express';
import { billingController } from '../modules/billing/billing.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { tenantGuard } from '../middlewares/tenant-guard.js';
import { requirePermission } from '../middlewares/rbac.js';

export const subscriptionRouter: Router = Router();

// Public webhook endpoint
subscriptionRouter.post('/webhook/:provider', (req, res, next) =>
  billingController.handleWebhook(req, res, next),
);
subscriptionRouter.post('/webhook', (req, res, next) =>
  billingController.handleWebhook(req, res, next),
);

// Protected routes (require manage_billing)
subscriptionRouter.use(authenticate, tenantGuard, requirePermission('manage_billing'));

subscriptionRouter.get('/', (req, res, next) => billingController.getOverview(req, res, next));
subscriptionRouter.post('/checkout', (req, res, next) =>
  billingController.createCheckout(req, res, next),
);
subscriptionRouter.post('/cancel', (req, res, next) =>
  billingController.cancelSubscription(req, res, next),
);
subscriptionRouter.get('/invoices', (req, res, next) =>
  billingController.getInvoices(req, res, next),
);
subscriptionRouter.post('/lead-credits', (req, res, next) =>
  billingController.purchaseLeadCredits(req, res, next),
);
subscriptionRouter.get('/lead-credits/transactions', (req, res, next) =>
  billingController.getLeadCreditTransactions(req, res, next),
);
