import type { Request, Response, NextFunction } from 'express';
import {
  updateIntegrationSchema,
  pixelEventSchema,
  integrationProviderSchema,
} from '@propbot/shared';
import { integrationsService } from './integrations.service.js';

export class IntegrationsController {
  private getCompanyId(req: Request): string {
    const id = req.tenant?.companyId || req.companyId || req.user?.companyId;
    if (!id) {
      const err = new Error('Missing tenant company context');
      Object.assign(err, { statusCode: 401 });
      throw err;
    }
    return id;
  }

  async listIntegrations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = this.getCompanyId(req);
      const data = await integrationsService.listIntegrations(companyId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async updateIntegration(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = this.getCompanyId(req);
      const provider = integrationProviderSchema.parse(req.params.provider);
      const parsed = updateIntegrationSchema.parse(req.body);
      const data = await integrationsService.updateIntegration(companyId, provider, parsed);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async testSync(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = this.getCompanyId(req);
      const provider = integrationProviderSchema.parse(req.params.provider);
      const data = await integrationsService.testSync(companyId, provider);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async trackConversion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = this.getCompanyId(req);
      const parsed = pixelEventSchema.parse(req.body);
      const data = await integrationsService.trackConversion(companyId, parsed);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

export const integrationsController = new IntegrationsController();
