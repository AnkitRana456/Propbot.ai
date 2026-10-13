import type { Request, Response, NextFunction } from 'express';
import { guardedActionsService } from './guarded-actions.service.js';
import { approveActionRequestSchema, rejectActionRequestSchema } from '@propbot/shared';

export class ApprovalsController {
  async listPending(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const status = (req.query.status as string) || 'proposed';

      const result = await guardedActionsService.listPendingApprovals(companyId, {
        page,
        limit,
        status,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const count = await guardedActionsService.getPendingCount(companyId);
      res.json({ success: true, count });
    } catch (err) {
      next(err);
    }
  }

  async approve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const userId = req.user?.id || '';
      const { id: actionId } = req.params;

      const body = approveActionRequestSchema.parse(req.body || {});

      const result = await guardedActionsService.approveAction(
        companyId,
        actionId!,
        userId,
        async (args) => {
          // Standard executor for approved actions
          return {
            executedAt: new Date().toISOString(),
            status: 'success',
            appliedArgs: args,
          };
        },
        body.editedArgs,
      );

      res.json({ success: true, data: result });
    } catch (err: unknown) {
      if (err instanceof Error && (err.message.includes('Cannot approve') || err.message.includes('not found'))) {
        (err as { statusCode?: number }).statusCode = 400;
      }
      next(err);
    }
  }

  async reject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const userId = req.user?.id || '';
      const { id: actionId } = req.params;

      const body = rejectActionRequestSchema.parse(req.body);

      await guardedActionsService.rejectAction(companyId, actionId!, userId, body.reason);

      res.json({ success: true, message: 'Action successfully rejected' });
    } catch (err: unknown) {
      if (err instanceof Error && (err.message.includes('Cannot reject') || err.message.includes('not found'))) {
        (err as { statusCode?: number }).statusCode = 400;
      }
      next(err);
    }
  }

  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const tier = req.query.tier as string | undefined;

      const result = await guardedActionsService.getActionHistory(companyId, {
        page,
        limit,
        tier,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const approvalsController = new ApprovalsController();
