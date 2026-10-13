import type { Request, Response, NextFunction } from 'express';
import {
  createWebhookEndpointSchema,
  updateWebhookEndpointSchema,
  webhookLogsFilterSchema,
  inboundLeadWebhookSchema,
} from '@propbot/shared';
import { webhooksService } from './webhooks.service.js';

export class WebhooksController {
  private getCompanyId(req: Request): string {
    const id = req.tenant?.companyId || req.companyId || req.user?.companyId;
    if (!id) {
      const err = new Error('Missing tenant company context');
      Object.assign(err, { statusCode: 401 });
      throw err;
    }
    return id;
  }

  async listEndpoints(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = this.getCompanyId(req);
      const data = await webhooksService.listEndpoints(companyId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getEndpoint(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = this.getCompanyId(req);
      const { id } = req.params;
      const data = await webhooksService.getEndpoint(companyId, id!);
      if (!data) {
        res.status(404).json({ success: false, error: 'Webhook endpoint not found' });
        return;
      }
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async createEndpoint(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = this.getCompanyId(req);
      const parsed = createWebhookEndpointSchema.parse(req.body);
      const data = await webhooksService.createEndpoint(companyId, parsed);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async updateEndpoint(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = this.getCompanyId(req);
      const { id } = req.params;
      const parsed = updateWebhookEndpointSchema.parse(req.body);
      const data = await webhooksService.updateEndpoint(companyId, id!, parsed);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async deleteEndpoint(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = this.getCompanyId(req);
      const { id } = req.params;
      const success = await webhooksService.deleteEndpoint(companyId, id!);
      res.json({ success });
    } catch (err) {
      next(err);
    }
  }

  async sendTestEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = this.getCompanyId(req);
      const { id } = req.params;
      const data = await webhooksService.sendTestEvent(companyId, id!);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getKpis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = this.getCompanyId(req);
      const data = await webhooksService.getKpis(companyId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = this.getCompanyId(req);
      const filter = webhookLogsFilterSchema.parse(req.query);
      const data = await webhooksService.getLogs(companyId, filter);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getLogById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = this.getCompanyId(req);
      const { id } = req.params;
      const data = await webhooksService.getLogById(companyId, id!);
      if (!data) {
        res.status(404).json({ success: false, error: 'Webhook log not found' });
        return;
      }
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async replayWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = this.getCompanyId(req);
      const { id } = req.params;
      const data = await webhooksService.replayWebhook(companyId, id!);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async inboundLead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Inbound webhook can resolve companyId via header 'X-PropBot-Company-Id' or query or req.companyId
      const companyId =
        req.companyId ||
        req.tenant?.companyId ||
        (req.headers['x-propbot-company-id'] as string) ||
        (req.query.companyId as string);

      if (!companyId) {
        res.status(400).json({ success: false, error: 'Missing tenant identifier' });
        return;
      }

      const parsed = inboundLeadWebhookSchema.parse(req.body);
      const data = await webhooksService.processInboundLead(companyId, parsed);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

export const webhooksController = new WebhooksController();
