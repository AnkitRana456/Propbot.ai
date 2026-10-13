import { Router } from 'express';
import { analyticsController } from '../modules/analytics/analytics.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { tenantGuard } from '../middlewares/tenant-guard.js';
import { requirePermission } from '../middlewares/rbac.js';

export const analyticsRouter: Router = Router();

analyticsRouter.use(authenticate, tenantGuard, requirePermission('view_analytics'));

// Overview & Funnels
analyticsRouter.get('/kpis', (req, res, next) => analyticsController.getKpis(req, res, next));
analyticsRouter.get('/cta-funnel', (req, res, next) => analyticsController.getCtaFunnel(req, res, next));
analyticsRouter.get('/real-estate-funnel', (req, res, next) => analyticsController.getRealEstateFunnel(req, res, next));

// Tabs
analyticsRouter.get('/performance', (req, res, next) => analyticsController.getPerformance(req, res, next));
analyticsRouter.get('/engagement', (req, res, next) => analyticsController.getEngagement(req, res, next));
analyticsRouter.get('/top-queries', (req, res, next) => analyticsController.getTopQueries(req, res, next));
analyticsRouter.get('/real-estate-insights', (req, res, next) => analyticsController.getRealEstateInsights(req, res, next));

// AI Quality & Attribution & Forecast
analyticsRouter.get('/ai-quality', (req, res, next) => analyticsController.getAiQuality(req, res, next));
analyticsRouter.get('/attribution', (req, res, next) => analyticsController.getAttribution(req, res, next));
analyticsRouter.get('/forecast', (req, res, next) => analyticsController.getForecast(req, res, next));

// Campaign Spends & Exports
analyticsRouter.get('/spends', (req, res, next) => analyticsController.getSpends(req, res, next));
analyticsRouter.post('/spends', (req, res, next) => analyticsController.createSpend(req, res, next));
analyticsRouter.get('/export/csv', (req, res, next) => analyticsController.exportCsv(req, res, next));

// Super Admin Platform Benchmark
analyticsRouter.get('/admin/overview', (req, res, next) => analyticsController.getSuperAdminOverview(req, res, next));
