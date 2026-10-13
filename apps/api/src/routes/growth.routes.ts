import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { tenantGuard } from '../middlewares/tenant-guard.js';
import { requirePermission } from '../middlewares/rbac.js';
import { growthController } from '../modules/growth/growth.controller.js';

export const growthRouter: Router = Router();

// Public payment callback endpoint (e.g. from Razorpay/Stripe webhook)
growthRouter.post('/payments/booking/webhook', growthController.handlePaymentWebhook.bind(growthController));

// Tenant-authenticated routes
growthRouter.use(authenticate, tenantGuard);

// 1. Segments
growthRouter.get(
  '/segments',
  requirePermission('view_leads'),
  growthController.listSegments.bind(growthController),
);

growthRouter.post(
  '/segments',
  requirePermission('edit_leads'),
  growthController.createSegment.bind(growthController),
);

growthRouter.post(
  '/segments/preview-count',
  requirePermission('view_leads'),
  growthController.previewSegmentCount.bind(growthController),
);

// 2. Campaigns
growthRouter.get(
  '/campaigns',
  requirePermission('view_leads'),
  growthController.listCampaigns.bind(growthController),
);

growthRouter.post(
  '/campaigns',
  requirePermission('edit_leads'),
  growthController.createCampaign.bind(growthController),
);

growthRouter.post(
  '/campaigns/:id/launch',
  requirePermission('edit_leads'),
  growthController.launchCampaign.bind(growthController),
);

// 3. Ask Your Pipeline
growthRouter.post(
  '/ask-pipeline',
  requirePermission('view_leads'),
  growthController.askPipeline.bind(growthController),
);

// 4. Booking Payments
growthRouter.post(
  '/booking-payments/link',
  requirePermission('edit_leads'),
  growthController.createPaymentLink.bind(growthController),
);

growthRouter.get(
  '/booking-payments',
  requirePermission('view_leads'),
  growthController.listTransactions.bind(growthController),
);

// 5. RERA Marketing Copy
growthRouter.post(
  '/rera-copy/generate',
  requirePermission('view_inventory'),
  growthController.generateReraCopy.bind(growthController),
);
