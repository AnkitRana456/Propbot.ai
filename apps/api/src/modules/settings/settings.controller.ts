import type { Request, Response, NextFunction } from 'express';
import {
  updateCompanyProfileSchema,
  operationsSettingsSchema,
  aiControlsSettingsSchema,
  createApiKeySchema,
  setupTwoFactorVerifySchema,
  ipAllowlistSchema,
} from '@propbot/shared';
import { settingsService } from './settings.service.js';

export class SettingsController {
  async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const data = await settingsService.getSettings(companyId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const actorId = req.user!.id;
      const input = updateCompanyProfileSchema.parse(req.body);

      const data = await settingsService.updateCompanyProfile(companyId, input, actorId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async updateOperations(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const actorId = req.user!.id;
      const input = operationsSettingsSchema.parse(req.body);

      const data = await settingsService.updateOperationsSettings(companyId, input, actorId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async updateAiControls(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const actorId = req.user!.id;
      const input = aiControlsSettingsSchema.parse(req.body);

      const data = await settingsService.updateAiControls(companyId, input, actorId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getApiKeys(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const data = await settingsService.getApiKeys(companyId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async createApiKey(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const actorId = req.user!.id;
      const input = createApiKeySchema.parse(req.body);

      const data = await settingsService.createApiKey(companyId, input, actorId);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async revokeApiKey(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const actorId = req.user!.id;
      const keyId = req.params.id!;

      const result = await settingsService.revokeApiKey(companyId, keyId, actorId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async setupTwoFactor(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const data = await settingsService.setupTwoFactor(userId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async verifyTwoFactor(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const actorId = req.user!.id;
      const input = setupTwoFactorVerifySchema.parse(req.body);

      const result = await settingsService.verifyAndEnableTwoFactor(userId, input.token, actorId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async disableTwoFactor(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const actorId = req.user!.id;

      const result = await settingsService.disableTwoFactor(userId, actorId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async updateIpAllowlist(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const actorId = req.user!.id;
      const input = ipAllowlistSchema.parse(req.body);

      const result = await settingsService.updateIpAllowlist(companyId, input.ips, actorId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async exportData(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const actorId = req.user!.id;

      const data = await settingsService.exportTenantData(companyId, actorId);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="propbot-tenant-export-${Date.now()}.json"`,
      );
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
}

export const settingsController = new SettingsController();
