import { eq, and, asc, desc, isNotNull, lte } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { leads, workflows, workflowRuns, workflowRunSteps } from '../../db/schema/index.js';
import { guardedActionsService, type ActionTier } from '../ai/guarded-actions.service.js';
import { WORKFLOW_TEMPLATES } from './workflow-templates.js';
import type {
  WorkflowNode,
  WorkflowEdge,
} from '@propbot/shared';
import { pino } from 'pino';

export const workflowLogger = pino({
  name: 'workflow-engine',
  level: process.env.LOG_LEVEL ?? 'info',
});

export interface RunExecutionResult {
  runId: string;
  status: 'completed' | 'failed' | 'paused' | 'waiting_approval';
  stepsExecuted: number;
  error?: string;
}

type WorkflowGraph = { nodes: WorkflowNode[]; edges: WorkflowEdge[] };

export class WorkflowEngineService {
  /**
   * Processes a domain event from the outbox against all active company workflows.
   */
  async handleTriggerEvent(event: {
    id: string;
    companyId: string;
    type: string;
    payload: Record<string, unknown>;
  }): Promise<{ matchedWorkflows: number; executedRuns: number }> {
    const activeWorkflows = await db
      .select()
      .from(workflows)
      .where(and(eq(workflows.companyId, event.companyId), eq(workflows.status, 'active')));

    let executedRuns = 0;

    for (const wf of activeWorkflows) {
      const def = wf.definition as WorkflowGraph;
      const triggerNode = def.nodes.find(n => n.type === 'trigger');

      if (triggerNode && triggerNode.type === 'trigger' && triggerNode.config.event_type === event.type) {
        try {
          await this.executeWorkflowRun(event.companyId, wf.id, event.id, event.payload);
          executedRuns++;
        } catch (err) {
          workflowLogger.error({ workflowId: wf.id, eventId: event.id, err }, 'Workflow run failed');
        }
      }
    }

    return { matchedWorkflows: activeWorkflows.length, executedRuns };
  }

  /**
   * Executes a specific workflow run step-by-step with loop guards and guarded AI action enforcement.
   */
  async executeWorkflowRun(
    companyId: string,
    workflowId: string,
    eventId: string | null,
    initialPayload: Record<string, unknown> = {},
    options: { dryRun?: boolean } = {},
  ): Promise<RunExecutionResult> {
    const [wf] = await db
      .select()
      .from(workflows)
      .where(and(eq(workflows.id, workflowId), eq(workflows.companyId, companyId)))
      .limit(1);

    if (!wf) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const def = wf.definition as WorkflowGraph;
    const triggerNode = def.nodes.find(n => n.type === 'trigger');
    if (!triggerNode) {
      throw new Error('Workflow has no trigger node');
    }

    // Initialize Run record
    let runId = `run_${Date.now()}`;
    if (!options.dryRun) {
      const [insertedRun] = await db
        .insert(workflowRuns)
        .values({
          companyId,
          workflowId,
          eventId,
          status: 'running',
          currentNodeId: triggerNode.id,
          context: initialPayload,
        })
        .returning();
      runId = insertedRun!.id;
    }

    return this.runNodes(companyId, def, runId, triggerNode, { ...initialPayload }, options);
  }

  /**
   * Continues runs whose wait step has elapsed. A workflow paused or archived during the wait
   * cancels its run, so a manager turning a workflow off also stops the follow-ups already queued.
   */
  async resumeDueRuns(limit = 25): Promise<number> {
    const due = await db
      .select({ id: workflowRuns.id })
      .from(workflowRuns)
      .where(and(eq(workflowRuns.status, 'paused'), isNotNull(workflowRuns.resumeAt), lte(workflowRuns.resumeAt, new Date())))
      .orderBy(asc(workflowRuns.resumeAt))
      .limit(limit);

    let resumed = 0;
    for (const { id } of due) {
      const [run] = await db
        .update(workflowRuns)
        .set({ status: 'running', resumeAt: null, updatedAt: new Date() })
        .where(and(eq(workflowRuns.id, id), eq(workflowRuns.status, 'paused')))
        .returning();
      if (!run) continue;

      const [wf] = await db.select().from(workflows).where(eq(workflows.id, run.workflowId)).limit(1);
      const def = wf?.definition as WorkflowGraph | undefined;
      const node = def?.nodes.find(n => n.id === run.currentNodeId);

      if (wf?.status !== 'active' || !def || !node) {
        await db
          .update(workflowRuns)
          .set({
            status: 'cancelled',
            error: wf?.status !== 'active' ? 'Workflow is no longer active' : 'Next step was removed from the workflow',
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(workflowRuns.id, id));
        continue;
      }

      await this.runNodes(run.companyId, def, id, node, run.context as Record<string, unknown>, {});
      resumed++;
    }
    return resumed;
  }

  private async runNodes(
    companyId: string,
    def: WorkflowGraph,
    runId: string,
    startNode: WorkflowNode,
    context: Record<string, unknown>,
    options: { dryRun?: boolean },
  ): Promise<RunExecutionResult> {
    const nodesMap = new Map<string, WorkflowNode>(def.nodes.map(n => [n.id, n]));
    const edgesBySource = new Map<string, WorkflowEdge[]>();

    for (const edge of def.edges) {
      const list = edgesBySource.get(edge.source) || [];
      list.push(edge);
      edgesBySource.set(edge.source, list);
    }

    let currentNode: WorkflowNode | undefined = startNode;
    let stepsCount = 0;
    const maxSteps = 25; // Loop guard protection

    try {
      while (currentNode) {
        stepsCount++;
        if (stepsCount > maxSteps) {
          throw new Error('Max step execution depth exceeded (loop detected)');
        }

        const startTime = Date.now();
        let stepStatus: 'completed' | 'failed' | 'waiting_approval' | 'skipped' = 'completed';
        let stepOutput: Record<string, unknown> = {};
        let stepError: string | undefined;
        let waitMs = 0;

        // 1. Evaluate Node Type
        if (currentNode.type === 'trigger') {
          stepOutput = { message: 'Trigger matched' };
        } else if (currentNode.type === 'condition') {
          const { field, operator, value } = currentNode.config;
          const leadId = (context.leadId || context.lead_id) as string | undefined;

          // Event payloads only carry ids, and a wait can make them stale, so read the lead as it is now.
          if (leadId && !options.dryRun) {
            const [lead] = await db
              .select({ status: leads.status, intentScore: leads.intentScore })
              .from(leads)
              .where(and(eq(leads.id, leadId), eq(leads.companyId, companyId)))
              .limit(1);
            if (lead) {
              context.status = lead.status;
              context.intent_score = lead.intentScore;
            }
          }

          const actualValue = context[field];
          let conditionPassed = false;

          switch (operator) {
            case 'equals':
              conditionPassed = String(actualValue) === String(value);
              break;
            case 'not_equals':
              conditionPassed = String(actualValue) !== String(value);
              break;
            case 'greater_than':
              conditionPassed = Number(actualValue) > Number(value);
              break;
            case 'less_than':
              conditionPassed = Number(actualValue) < Number(value);
              break;
            case 'contains':
              conditionPassed = String(actualValue).toLowerCase().includes(String(value).toLowerCase());
              break;
            case 'in':
              conditionPassed = Array.isArray(value) && value.includes(actualValue);
              break;
          }

          stepOutput = { conditionPassed, field, actualValue };
          if (!conditionPassed) {
            stepStatus = 'skipped';
          }
        } else if (currentNode.type === 'action') {
          const { action_kind, parameters } = currentNode.config;
          const leadId = (context.leadId || context.lead_id) as string | undefined;

          // Route all actions through Guarded AI Actions framework
          const tier: ActionTier = action_kind === 'send_payment_link' ? 'T2' : 'T1';

          if (action_kind === 'wait') {
            const hours = Number(parameters.hours) || 0;
            waitMs = hours * 3_600_000;
            stepOutput = options.dryRun ? { dryRun: true, wouldWaitHours: hours } : { waitHours: hours };
          } else if (!options.dryRun) {
            const actionResult = await guardedActionsService.executeAgentAction({
              companyId,
              agentName: 'workflow_engine',
              actionType: action_kind,
              tier,
              leadId,
              args: parameters,
              executorFn: async () => {
                return {
                  executedAt: new Date().toISOString(),
                  action_kind,
                  parameters,
                };
              },
            });

            if (actionResult.status === 'proposed') {
              stepStatus = 'waiting_approval';
              stepOutput = { actionId: actionResult.actionId, message: 'Action held in approval queue' };
            } else if (actionResult.status === 'blocked') {
              stepStatus = 'failed';
              stepError = actionResult.message;
            } else {
              stepOutput = actionResult.result || { success: true };
            }
          } else {
            stepOutput = { dryRun: true, plannedTier: tier, action_kind };
          }
        } else if (currentNode.type === 'branch') {
          stepOutput = { branched: true };
        } else if (currentNode.type === 'end') {
          stepOutput = { outcome: currentNode.config.outcome || 'completed' };
        }

        // Record Step Log
        if (!options.dryRun) {
          await db.insert(workflowRunSteps).values({
            companyId,
            runId,
            nodeId: currentNode.id,
            nodeType: currentNode.type,
            actionType: currentNode.type === 'action' ? currentNode.config.action_kind : null,
            status: stepStatus,
            input: currentNode.config as Record<string, unknown>,
            output: stepOutput,
            error: stepError,
            durationMs: Date.now() - startTime,
          });
        }

        // Check if held in approval queue
        if (stepStatus === 'waiting_approval') {
          if (!options.dryRun) {
            await db
              .update(workflowRuns)
              .set({
                status: 'waiting_approval',
                currentNodeId: currentNode.id,
                updatedAt: new Date(),
              })
              .where(eq(workflowRuns.id, runId));
          }
          return {
            runId,
            status: 'waiting_approval',
            stepsExecuted: stepsCount,
          };
        }

        if (stepStatus === 'failed') {
          throw new Error(stepError || 'Step execution failed');
        }

        // A false condition ends the run; so does a terminal node
        if (currentNode.type === 'end' || stepStatus === 'skipped') {
          break;
        }

        // Traverse to next node via edges
        const outgoingEdges: WorkflowEdge[] = edgesBySource.get(currentNode.id) || [];
        if (outgoingEdges.length === 0) {
          break;
        }

        const nextEdge: WorkflowEdge | undefined = outgoingEdges[0];
        const nextNode: WorkflowNode | undefined = nextEdge ? nodesMap.get(nextEdge.target) : undefined;

        if (waitMs > 0 && nextNode && !options.dryRun) {
          await db
            .update(workflowRuns)
            .set({
              status: 'paused',
              currentNodeId: nextNode.id,
              resumeAt: new Date(Date.now() + waitMs),
              context,
              updatedAt: new Date(),
            })
            .where(eq(workflowRuns.id, runId));
          return { runId, status: 'paused', stepsExecuted: stepsCount };
        }

        currentNode = nextNode;
      }

      // Mark Run Complete
      if (!options.dryRun) {
        await db
          .update(workflowRuns)
          .set({
            status: 'completed',
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(workflowRuns.id, runId));
      }

      return {
        runId,
        status: 'completed',
        stepsExecuted: stepsCount,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (!options.dryRun) {
        await db
          .update(workflowRuns)
          .set({
            status: 'failed',
            error: errMsg,
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(workflowRuns.id, runId));
      }
      return {
        runId,
        status: 'failed',
        stepsExecuted: stepsCount,
        error: errMsg,
      };
    }
  }

  /**
   * "Describe in plain English": Synthesizes a valid Workflow JSON from a sentence.
   * Safety Guarantee: The workflow is ALWAYS saved in 'draft' status. AI never activates it.
   */
  draftFromPrompt(prompt: string): {
    name: string;
    description: string;
    definition: { nodes: WorkflowNode[]; edges: WorkflowEdge[] };
  } {
    const lower = prompt.toLowerCase();

    // Match closest workflow structure based on intent
    if (lower.includes('hot') || lower.includes('alert') || lower.includes('callback')) {
      const tpl = WORKFLOW_TEMPLATES[1]!;
      return {
        name: `Automated: ${tpl.name}`,
        description: `Drafted from prompt: "${prompt}"`,
        definition: tpl.definition,
      };
    }

    if (lower.includes('survey') || lower.includes('visit') || lower.includes('walkthrough')) {
      const tpl = WORKFLOW_TEMPLATES[3]!;
      return {
        name: `Automated: ${tpl.name}`,
        description: `Drafted from prompt: "${prompt}"`,
        definition: tpl.definition,
      };
    }

    if (lower.includes('re-engage') || lower.includes('dormant') || lower.includes('quiet')) {
      const tpl = WORKFLOW_TEMPLATES[4]!;
      return {
        name: `Automated: ${tpl.name}`,
        description: `Drafted from prompt: "${prompt}"`,
        definition: tpl.definition,
      };
    }

    if (lower.includes('wait') || lower.includes('reply') || lower.includes('nudge')) {
      const tpl = WORKFLOW_TEMPLATES[2]!;
      return {
        name: `Automated: ${tpl.name}`,
        description: `Drafted from prompt: "${prompt}"`,
        definition: tpl.definition,
      };
    }

    // Default: Welcome + Qualify
    const tpl = WORKFLOW_TEMPLATES[0]!;
    return {
      name: `Automated: ${tpl.name}`,
      description: `Drafted from prompt: "${prompt}"`,
      definition: tpl.definition,
    };
  }

  /**
   * Lists run history for a workflow.
   */
  async listWorkflowRuns(companyId: string, workflowId: string) {
    return await db
      .select()
      .from(workflowRuns)
      .where(and(eq(workflowRuns.companyId, companyId), eq(workflowRuns.workflowId, workflowId)))
      .orderBy(desc(workflowRuns.createdAt))
      .limit(50);
  }

  /**
   * Lists step execution logs for a workflow run.
   */
  async getRunSteps(companyId: string, runId: string) {
    return await db
      .select()
      .from(workflowRunSteps)
      .where(and(eq(workflowRunSteps.companyId, companyId), eq(workflowRunSteps.runId, runId)))
      .orderBy(workflowRunSteps.executedAt);
  }
}

export const workflowEngineService = new WorkflowEngineService();
