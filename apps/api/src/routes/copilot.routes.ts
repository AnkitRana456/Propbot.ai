import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { tenantGuard } from '../middlewares/tenant-guard.js';
import { requirePermission } from '../middlewares/rbac.js';
import { copilotService } from '../modules/crm/copilot.service.js';
import { reEngagementService } from '../modules/crm/re-engagement.service.js';
import {
  copilotSuggestReplyInputSchema,
  copilotObjectionRebuttalInputSchema,
} from '@propbot/shared';

export const copilotRouter: Router = Router();

copilotRouter.use(authenticate, tenantGuard);

// 1. Suggest Reply
copilotRouter.post(
  '/leads/:leadId/copilot/suggest-reply',
  requirePermission('edit_leads'),
  async (req, res, next) => {
    try {
      const companyId = req.companyId!;
      const { leadId } = req.params;
      const validated = copilotSuggestReplyInputSchema.parse(req.body);
      const result = await copilotService.suggestReply(companyId, leadId as string, validated);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// 2. Summarise Lead
copilotRouter.post(
  '/leads/:leadId/copilot/summary',
  requirePermission('view_leads'),
  async (req, res, next) => {
    try {
      const companyId = req.companyId!;
      const { leadId } = req.params;
      const result = await copilotService.summariseLead(companyId, leadId as string);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// 3. Call-Script Generator
copilotRouter.post(
  '/leads/:leadId/copilot/call-script',
  requirePermission('view_leads'),
  async (req, res, next) => {
    try {
      const companyId = req.companyId!;
      const { leadId } = req.params;
      const result = await copilotService.generateCallScript(companyId, leadId as string);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// 4. Objection Rebuttal
copilotRouter.post(
  '/leads/:leadId/copilot/rebuttal',
  requirePermission('view_leads'),
  async (req, res, next) => {
    try {
      const companyId = req.companyId!;
      const validated = copilotObjectionRebuttalInputSchema.parse(req.body);
      const result = await copilotService.getObjectionRebuttal(companyId, validated);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// 5. Re-Engagement Sweep
copilotRouter.post(
  '/re-engagement/sweep',
  requirePermission('manage_chatbots'),
  async (req, res, next) => {
    try {
      const companyId = req.companyId!;
      const forceAll = Boolean(req.body?.forceAll);
      const result = await reEngagementService.runSweep({ companyId, forceAll });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// 6. Lead Re-Engagement History
copilotRouter.get(
  '/leads/:leadId/re-engagement-history',
  requirePermission('view_leads'),
  async (req, res, next) => {
    try {
      const companyId = req.companyId!;
      const { leadId } = req.params;
      const history = await reEngagementService.getLeadHistory(companyId, leadId as string);
      res.json({ success: true, data: history });
    } catch (err) {
      next(err);
    }
  },
);

// 7. Execute Next Best Action (Phase 15A.5)
copilotRouter.post(
  '/leads/:leadId/next-best-action/execute',
  requirePermission('edit_leads'),
  async (req, res, next) => {
    try {
      const companyId = req.companyId!;
      const userId = req.user?.id || '';
      const { leadId } = req.params;

      const { nextBestActionService } = await import('../modules/crm/next-best-action.service.js');
      const result = await nextBestActionService.executeAction(companyId, leadId as string, userId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

