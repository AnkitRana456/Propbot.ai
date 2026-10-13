import { Request, Response, NextFunction } from 'express';
import { segmentsService } from './segments.service.js';
import { campaignsService } from './campaigns.service.js';
import { askPipelineService } from './ask-pipeline.service.js';
import { bookingPaymentsService } from './booking-payments.service.js';
import { reraCopyService } from './rera-copy.service.js';
import {
  createSegmentRequestSchema,
  previewSegmentCountRequestSchema,
  createCampaignRequestSchema,
  askPipelineRequestSchema,
  createBookingPaymentLinkRequestSchema,
  generateReraCopyRequestSchema,
} from '@propbot/shared';

export class GrowthController {
  // 1. Segments
  async listSegments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const data = await segmentsService.listSegments(companyId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async createSegment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const userId = req.user?.id;
      const body = createSegmentRequestSchema.parse(req.body);
      const data = await segmentsService.createSegment(companyId, userId, body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async previewSegmentCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const body = previewSegmentCountRequestSchema.parse(req.body);
      const count = await segmentsService.evaluateCount(companyId, body.filterCriteria);
      res.json({ success: true, count });
    } catch (err) {
      next(err);
    }
  }

  // 2. Campaigns
  async listCampaigns(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const data = await campaignsService.listCampaigns(companyId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async createCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const body = createCampaignRequestSchema.parse(req.body);
      const data = await campaignsService.createCampaign(companyId, body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async launchCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const { id } = req.params;
      const data = await campaignsService.launchCampaign(companyId, id!);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  // 3. Ask Your Pipeline
  async askPipeline(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const body = askPipelineRequestSchema.parse(req.body);
      const data = await askPipelineService.askPipeline(companyId, body.question);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  // 4. Booking Payments
  async createPaymentLink(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const userId = req.user?.id;
      const body = createBookingPaymentLinkRequestSchema.parse(req.body);
      const isManualAdmin = req.user?.role === 'company_admin';
      const data = await bookingPaymentsService.createPaymentLink(companyId, userId, body, isManualAdmin);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async listTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const leadId = req.query.leadId as string | undefined;
      const data = await bookingPaymentsService.listTransactions(companyId, leadId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async handlePaymentWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { companyId, paymentLinkId, orderId, paymentId, amount, receiptUrl } = req.body;
      const data = await bookingPaymentsService.processPaymentConfirmation(companyId, paymentLinkId, {
        orderId,
        paymentId,
        amount,
        receiptUrl,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  // 5. RERA Marketing Copy
  async generateReraCopy(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const body = generateReraCopyRequestSchema.parse(req.body);
      const data = await reraCopyService.generateCopy(companyId, body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

export const growthController = new GrowthController();
