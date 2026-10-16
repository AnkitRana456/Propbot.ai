import type { Request, Response, NextFunction } from 'express';
import {
  captureLeadInputSchema,
  updateLeadStatusInputSchema,
  mergeLeadInputSchema,
  scoringConfigSchema,
} from '@propbot/shared';
import { leadsService } from './leads.service.js';

export class LeadsController {
  async capture(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = captureLeadInputSchema.parse(req.body);
      const companyId = req.tenant?.companyId || req.user?.companyId;

      if (!companyId) {
        res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Tenant company context required' },
        });
        return;
      }

      const result = await leadsService.captureOrUpdateLead(companyId, parsed);
      res.status(result.isDuplicate ? 200 : 201).json({
        data: result.lead,
        isDuplicate: result.isDuplicate,
      });
    } catch (err) {
      next(err);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant?.companyId;
      if (!companyId) {
        res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      const { status, priority, intentLabel, search, page, limit } = req.query;

      const result = await leadsService.listLeads(companyId, {
        status: status as string,
        priority: priority as string,
        intentLabel: intentLabel as string,
        search: search as string,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant?.companyId;
      const leadId = req.params.id as string;

      if (!companyId) {
        res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      if (!leadId) {
        res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Lead ID is required' } });
        return;
      }

      const lead = await leadsService.getLeadById(companyId, leadId);
      res.json({ data: lead });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'Lead not found') {
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Lead not found' },
        });
        return;
      }
      next(err);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant?.companyId;
      const leadId = req.params.id as string;

      if (!companyId) {
        res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      if (!leadId) {
        res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Lead ID is required' } });
        return;
      }

      const { status, lostReason } = updateLeadStatusInputSchema.parse(req.body);
      const updated = await leadsService.updateLeadStatus(companyId, leadId, status, lostReason);
      res.json({ data: updated });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'Lead not found') {
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Lead not found' },
        });
        return;
      }
      next(err);
    }
  }

  async merge(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant?.companyId;
      const targetLeadId = req.params.id as string;

      if (!companyId) {
        res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      if (!targetLeadId) {
        res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Target Lead ID is required' } });
        return;
      }

      const { sourceLeadId } = mergeLeadInputSchema.parse({
        sourceLeadId: req.body.sourceLeadId,
        targetLeadId,
      });

      const merged = await leadsService.mergeLeads(companyId, sourceLeadId, targetLeadId);
      res.json({ data: merged });
    } catch (err) {
      next(err);
    }
  }

  async getScoringConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant?.companyId;
      if (!companyId) {
        res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      const config = await leadsService.getScoringConfig(companyId);
      res.json({ data: config });
    } catch (err) {
      next(err);
    }
  }

  async updateScoringConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant?.companyId;
      if (!companyId) {
        res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      const parsed = scoringConfigSchema.parse(req.body);
      const updated = await leadsService.updateScoringConfig(companyId, parsed);
      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  }

  async getConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant?.companyId;
      const leadId = req.params.id as string;

      if (!companyId) {
        res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      if (!leadId) {
        res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Lead ID is required' } });
        return;
      }

      const conversation = await leadsService.getLeadConversation(companyId, leadId);
      res.json({ data: conversation });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'Lead not found') {
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Lead not found' },
        });
        return;
      }
      next(err);
    }
  }
}

export const leadsController = new LeadsController();
