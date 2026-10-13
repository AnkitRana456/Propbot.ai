import { Request, Response, NextFunction } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { workflows } from '../../db/schema/index.js';
import { workflowEngineService } from './workflow-engine.service.js';
import { WORKFLOW_TEMPLATES } from './workflow-templates.js';
import {
  createWorkflowRequestSchema,
  updateWorkflowRequestSchema,
  workflowDraftFromPromptRequestSchema,
  testWorkflowRequestSchema,
} from '@propbot/shared';

export class WorkflowsController {
  async listWorkflows(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const items = await db
        .select()
        .from(workflows)
        .where(eq(workflows.companyId, companyId))
        .orderBy(desc(workflows.createdAt));

      res.json({ success: true, data: items });
    } catch (err) {
      next(err);
    }
  }

  async getTemplates(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json({ success: true, data: WORKFLOW_TEMPLATES });
    } catch (err) {
      next(err);
    }
  }

  async createWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const userId = req.user?.id;
      const body = createWorkflowRequestSchema.parse(req.body);

      const [created] = await db
        .insert(workflows)
        .values({
          companyId,
          name: body.name,
          description: body.description,
          definition: body.definition,
          status: 'draft',
          createdBy: userId,
        })
        .returning();

      res.status(201).json({ success: true, data: created });
    } catch (err) {
      next(err);
    }
  }

  async getWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const { id } = req.params;

      const [wf] = await db
        .select()
        .from(workflows)
        .where(and(eq(workflows.id, id!), eq(workflows.companyId, companyId)))
        .limit(1);

      if (!wf) {
        res.status(404).json({ error: { message: 'Workflow not found' } });
        return;
      }

      res.json({ success: true, data: wf });
    } catch (err) {
      next(err);
    }
  }

  async updateWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const { id } = req.params;
      const body = updateWorkflowRequestSchema.parse(req.body);

      const updatePayload: Record<string, unknown> = { updatedAt: new Date() };
      if (body.name) updatePayload.name = body.name;
      if (body.description !== undefined) updatePayload.description = body.description;
      if (body.definition) updatePayload.definition = body.definition;

      const [updated] = await db
        .update(workflows)
        .set(updatePayload)
        .where(and(eq(workflows.id, id!), eq(workflows.companyId, companyId)))
        .returning();

      if (!updated) {
        res.status(404).json({ error: { message: 'Workflow not found' } });
        return;
      }

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  async activateWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const { id } = req.params;

      const [updated] = await db
        .update(workflows)
        .set({ status: 'active', updatedAt: new Date() })
        .where(and(eq(workflows.id, id!), eq(workflows.companyId, companyId)))
        .returning();

      if (!updated) {
        res.status(404).json({ error: { message: 'Workflow not found' } });
        return;
      }

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  async pauseWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const { id } = req.params;

      const [updated] = await db
        .update(workflows)
        .set({ status: 'paused', updatedAt: new Date() })
        .where(and(eq(workflows.id, id!), eq(workflows.companyId, companyId)))
        .returning();

      if (!updated) {
        res.status(404).json({ error: { message: 'Workflow not found' } });
        return;
      }

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  async draftFromPrompt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = workflowDraftFromPromptRequestSchema.parse(req.body);
      const draft = workflowEngineService.draftFromPrompt(body.prompt);
      res.json({ success: true, data: draft });
    } catch (err) {
      next(err);
    }
  }

  async testWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const { id } = req.params;
      const body = testWorkflowRequestSchema.parse(req.body || {});

      const result = await workflowEngineService.executeWorkflowRun(
        companyId,
        id!,
        null,
        body.payload,
        { dryRun: true },
      );

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getRuns(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const { id } = req.params;

      const runs = await workflowEngineService.listWorkflowRuns(companyId, id!);
      res.json({ success: true, data: runs });
    } catch (err) {
      next(err);
    }
  }

  async getRunSteps(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const { runId } = req.params;

      const steps = await workflowEngineService.getRunSteps(companyId, runId!);
      res.json({ success: true, data: steps });
    } catch (err) {
      next(err);
    }
  }
}

export const workflowsController = new WorkflowsController();
