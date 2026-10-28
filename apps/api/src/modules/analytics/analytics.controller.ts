import type { Request, Response, NextFunction } from 'express';
import { analyticsService } from './analytics.service.js';
import {
  analyticsFilterSchema,
  createCampaignSpendSchema,
} from '@propbot/shared';

function getCompanyId(req: Request): string {
  const companyId = req.tenant?.companyId || req.companyId || req.user?.companyId;
  if (!companyId) {
    throw new Error('Tenant context missing: companyId is required');
  }
  return companyId;
}

export class AnalyticsController {
  async getKpis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const filter = analyticsFilterSchema.parse(req.query);
      const result = await analyticsService.getKpis(companyId, filter);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getCtaFunnel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const filter = analyticsFilterSchema.parse(req.query);
      const result = await analyticsService.getCtaFunnel(companyId, filter);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getRealEstateFunnel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const filter = analyticsFilterSchema.parse(req.query);
      const result = await analyticsService.getRealEstateFunnel(companyId, filter);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getPerformance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const filter = analyticsFilterSchema.parse(req.query);
      const result = await analyticsService.getPerformance(companyId, filter);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getEngagement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const filter = analyticsFilterSchema.parse(req.query);
      const result = await analyticsService.getEngagement(companyId, filter);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getTopQueries(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const filter = analyticsFilterSchema.parse(req.query);
      const result = await analyticsService.getTopQueries(companyId, filter);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getRealEstateInsights(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const filter = analyticsFilterSchema.parse(req.query);
      const result = await analyticsService.getRealEstateInsights(companyId, filter);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getAiQuality(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const filter = analyticsFilterSchema.parse(req.query);
      const result = await analyticsService.getAiQuality(companyId, filter);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getAttribution(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const filter = analyticsFilterSchema.parse(req.query);
      const model = (req.query.model as 'first_touch' | 'last_touch' | 'linear') || 'first_touch';
      const result = await analyticsService.getAttribution(companyId, model, filter);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getForecast(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const metric = (req.query.metric as 'conversations' | 'leads') || 'conversations';
      const result = await analyticsService.getForecast(companyId, metric);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getSpends(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const result = await analyticsService.getSpends(companyId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async createSpend(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const input = createCampaignSpendSchema.parse(req.body);
      const result = await analyticsService.createSpend(companyId, input);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async exportCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const filter = analyticsFilterSchema.parse(req.query);
      const perf = await analyticsService.getPerformance(companyId, filter);

      let csv = 'Date,Conversations,Leads,ConversionRatePercent\n';
      for (const pt of perf.points) {
        csv += `${pt.date},${pt.conversations},${pt.leads},${pt.conversionRate}\n`;
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="analytics-report-${Date.now()}.csv"`);
      res.status(200).send(csv);
    } catch (err) {
      next(err);
    }
  }

  async getAdSources(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const filter = analyticsFilterSchema.parse(req.query);
      const result = await analyticsService.getAdSources(companyId, filter);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getSuperAdminOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user?.role !== 'ps-owner') {
        res.status(403).json({ error: { message: 'Access denied: ps-owner required' } });
        return;
      }
      const result = await analyticsService.getSuperAdminOverview();
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const analyticsController = new AnalyticsController();
