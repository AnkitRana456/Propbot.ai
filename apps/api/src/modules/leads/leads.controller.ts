import type { Request, Response, NextFunction } from 'express';
import {
  captureLeadInputSchema,
  updateLeadInputSchema,
  updateLeadStatusInputSchema,
  mergeLeadInputSchema,
  scoringConfigSchema,
} from '@propbot/shared';
import { z } from 'zod';
import { leadsService } from './leads.service.js';
import { assignmentService } from '../crm/assignment.service.js';
import { parseCsv } from '../lead-sources/lead-source-mappers.js';

export class LeadsController {
  async cleanupInvalid(req: Request, res: Response, next: NextFunction) {
    try {
      const isCron = (req as Request & { cronRun?: boolean }).cronRun === true;
      // Cron runs are platform-wide; an admin only ever cleans their own company.
      const scope = isCron || req.user?.role === 'ps-owner' ? undefined : req.user!.companyId;
      const result = await leadsService.cleanupInvalidLeadLinks(scope);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

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

      const enriched = {
        ...parsed,
        ipAddress: parsed.ipAddress || (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.ip,
        userAgent: parsed.userAgent || req.headers['user-agent'],
      };
      const result = await leadsService.captureOrUpdateLead(companyId, enriched);

      let finalLead = result.lead;
      if (!result.isDuplicate && !finalLead.assignedAgentId) {
        try {
          finalLead = await assignmentService.roundRobinAssign(companyId, finalLead.id);
        } catch {
          // Graceful fallback if no agent is currently active/eligible
        }
      }

      res.status(result.isDuplicate ? 200 : 201).json({
        data: finalLead,
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

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant?.companyId;
      if (!companyId) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
        return;
      }
      const input = updateLeadInputSchema.parse(req.body);
      const updated = await leadsService.updateLead(companyId, req.params.id as string, input);
      res.json({ data: updated });
    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number; code?: string };
      if (e.message === 'Lead not found') {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Lead not found' } });
        return;
      }
      if (e.statusCode === 400 || e.statusCode === 409) {
        res.status(e.statusCode).json({ error: { code: e.code ?? 'BAD_REQUEST', message: e.message } });
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

  async importCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant?.companyId;
      if (!companyId) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
        return;
      }
      const { csv } = z.object({ csv: z.string().min(1) }).parse(req.body);
      const rows = parseCsv(csv);
      if (rows.length === 0) {
        res.status(400).json({ error: { code: 'CSV_EMPTY', message: 'CSV needs a header row and at least one data row.' } });
        return;
      }
      if (rows.length > 500) {
        res.status(400).json({ error: { code: 'CSV_TOO_LARGE', message: 'Import at most 500 rows at a time.' } });
        return;
      }
      const summary = { total: rows.length, created: 0, duplicate: 0, failed: 0, errors: [] as Array<{ row: number; error: string }> };
      for (const [i, row] of rows.entries()) {
        const name = row['name'] ?? row['Name'] ?? row['full_name'] ?? '';
        const phone = row['phone'] ?? row['Phone'] ?? row['mobile'] ?? row['Mobile'] ?? '';
        const email = row['email'] ?? row['Email'] ?? undefined;
        if (!name || !phone) {
          summary.failed++;
          if (summary.errors.length < 20) summary.errors.push({ row: i + 2, error: 'Missing name or phone' });
          continue;
        }
        try {
          const result = await leadsService.captureOrUpdateLead(companyId, {
            name: name.trim(),
            phone: phone.trim(),
            email: email?.trim() || undefined,
            source: 'csv_import',
          });
          if (result.isDuplicate) summary.duplicate++;
          else {
            summary.created++;
            try { await assignmentService.roundRobinAssign(companyId, result.lead.id); } catch { /* no agents */ }
          }
        } catch (e) {
          summary.failed++;
          if (summary.errors.length < 20) summary.errors.push({ row: i + 2, error: (e as Error).message?.slice(0, 120) ?? 'Failed' });
        }
      }
      res.json({ data: summary });
    } catch (err) {
      next(err);
    }
  }
}

export const leadsController = new LeadsController();
