import type { Request, Response, NextFunction } from 'express';
import {
  checkoutSessionSchema,
  purchaseLeadCreditsSchema,
  subscriptionInvoiceFilterSchema,
} from '@propbot/shared';
import { billingService } from './billing.service.js';

export class BillingController {
  async getOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const data = await billingService.getSubscriptionOverview(companyId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async createCheckout(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const input = checkoutSessionSchema.parse(req.body);

      const session = await billingService.createCheckoutSession(companyId, input);
      res.json({ success: true, data: session });
    } catch (err) {
      next(err);
    }
  }

  async cancelSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const actorId = req.user!.id;

      const result = await billingService.cancelSubscription(companyId, actorId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getInvoices(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const filter = subscriptionInvoiceFilterSchema.parse(req.query);

      const result = await billingService.getInvoices(companyId, filter);
      res.json({ success: true, data: result.invoices, pagination: result.pagination });
    } catch (err) {
      next(err);
    }
  }

  async purchaseLeadCredits(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const actorId = req.user!.id;
      const input = purchaseLeadCreditsSchema.parse(req.body);

      const result = await billingService.purchaseLeadCredits(companyId, input, actorId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getLeadCreditTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const data = await billingService.getLeadCreditTransactions(companyId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async handleWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const provider = (req.params.provider as string) || 'stripe';
      const signature =
        (req.headers['stripe-signature'] as string) ||
        (req.headers['x-razorpay-signature'] as string) ||
        '';

      const result = await billingService.handleWebhook(provider, req.body, signature);
      res.json({ received: true, result });
    } catch (err) {
      next(err);
    }
  }
}

export const billingController = new BillingController();
