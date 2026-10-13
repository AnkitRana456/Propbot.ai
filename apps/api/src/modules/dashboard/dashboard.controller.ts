import type { Request, Response, NextFunction } from 'express';
import { dashboardService } from './dashboard.service.js';

export class DashboardController {
  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const stats = await dashboardService.getDashboardStats(companyId);
      res.status(200).json({
        data: stats,
      });
    } catch (err) {
      next(err);
    }
  }

  async getRecentLeads(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const limit = req.query.limit ? Number(req.query.limit) : 5;
      const leads = await dashboardService.getRecentLeads(companyId, limit);
      res.status(200).json({
        data: leads,
      });
    } catch (err) {
      next(err);
    }
  }

  async getNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const userId = req.user!.id;
      const result = await dashboardService.getNotifications(companyId, userId);
      res.status(200).json({
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const dashboardController = new DashboardController();
