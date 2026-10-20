import type { NextFunction, Request, Response } from 'express';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import {
  policyRuleSchema,
  type AssignPolicyInput,
  type CreatePolicyInput,
  type CreateTeamInput,
  type PolicyAction,
  type PolicyChangeItem,
  type PolicyDecision,
  type PolicyItem,
  type PolicyModule,
  type PolicyRule,
  type TeamItem,
} from '@propbot/shared';
import { db } from '../../db/index.js';
import { apiKeys, policies, policyAssignments, policyChanges, teamMembers, teams, users } from '../../db/schema/index.js';
import { badRequest, conflict, notFound } from '../../utils/api-error.js';
import { inCallingWindow } from '../voice/call-signals.js';

const isUnique = (e: unknown) => /duplicate key|unique/i.test(String((e as Error)?.message ?? '') + String((e as { cause?: Error })?.cause?.message ?? ''));

// ---------------------------------------------------------------- teams
class TeamsService {
  private async members(teamIds: string[]) {
    if (teamIds.length === 0) return [];
    return db
      .select({ teamId: teamMembers.teamId, id: users.id, name: users.name, role: users.role })
      .from(teamMembers)
      .innerJoin(users, eq(users.id, teamMembers.userId))
      .where(inArray(teamMembers.teamId, teamIds));
  }

  private async assertUsers(companyId: string, ids: string[]) {
    if (ids.length === 0) return;
    const found = await db.select({ id: users.id }).from(users).where(and(eq(users.companyId, companyId), inArray(users.id, ids)));
    if (found.length !== new Set(ids).size) throw badRequest('TEAM_MEMBER_INVALID', 'Some people are not part of your company.');
  }

  async list(companyId: string): Promise<TeamItem[]> {
    const rows = await db.select().from(teams).where(eq(teams.companyId, companyId)).orderBy(teams.name);
    const m = await this.members(rows.map(r => r.id));
    return rows.map(r => ({ id: r.id, name: r.name, description: r.description, leadUserId: r.leadUserId, members: m.filter(x => x.teamId === r.id).map(({ teamId: _t, ...rest }) => rest) }));
  }

  async create(companyId: string, input: CreateTeamInput): Promise<TeamItem> {
    await this.assertUsers(companyId, [...input.memberIds, ...(input.leadUserId ? [input.leadUserId] : [])]);
    try {
      const [t] = await db.insert(teams).values({ companyId, name: input.name, description: input.description ?? null, leadUserId: input.leadUserId ?? null }).returning();
      if (input.memberIds.length) await db.insert(teamMembers).values([...new Set(input.memberIds)].map(userId => ({ teamId: t!.id, userId, companyId })));
      return (await this.list(companyId)).find(x => x.id === t!.id)!;
    } catch (e) {
      if (isUnique(e)) throw conflict('TEAM_EXISTS', `A team named "${input.name}" already exists.`);
      throw e;
    }
  }

  async update(companyId: string, id: string, input: Partial<CreateTeamInput>): Promise<TeamItem> {
    const [cur] = await db.select().from(teams).where(and(eq(teams.id, id), eq(teams.companyId, companyId)));
    if (!cur) throw notFound('Team');
    await this.assertUsers(companyId, [...(input.memberIds ?? []), ...(input.leadUserId ? [input.leadUserId] : [])]);
    try {
      const patch = { ...(input.name ? { name: input.name } : {}), ...(input.description !== undefined ? { description: input.description } : {}), ...(input.leadUserId !== undefined ? { leadUserId: input.leadUserId } : {}) };
      if (Object.keys(patch).length) await db.update(teams).set(patch).where(eq(teams.id, id));
    } catch (e) {
      if (isUnique(e)) throw conflict('TEAM_EXISTS', 'A team with that name already exists.');
      throw e;
    }
    if (input.memberIds) {
      await db.delete(teamMembers).where(eq(teamMembers.teamId, id));
      if (input.memberIds.length) await db.insert(teamMembers).values([...new Set(input.memberIds)].map(userId => ({ teamId: id, userId, companyId })));
    }
    return (await this.list(companyId)).find(x => x.id === id)!;
  }

  async remove(companyId: string, id: string): Promise<void> {
    const res = await db.delete(teams).where(and(eq(teams.id, id), eq(teams.companyId, companyId))).returning({ id: teams.id });
    if (res.length === 0) throw notFound('Team');
    await db.delete(policyAssignments).where(and(eq(policyAssignments.companyId, companyId), eq(policyAssignments.subjectType, 'team'), eq(policyAssignments.subjectId, id)));
  }

  async teamIdsOf(companyId: string, userId: string): Promise<string[]> {
    const rows = await db.select({ id: teamMembers.teamId }).from(teamMembers).where(and(eq(teamMembers.companyId, companyId), eq(teamMembers.userId, userId)));
    return rows.map(r => r.id);
  }
}

// ---------------------------------------------------------------- policies
type PolicyRow = typeof policies.$inferSelect;
export interface Subject {
  userId?: string;
  role?: string;
  apiKeyId?: string;
}

class PoliciesService {
  private async mustGet(companyId: string, id: string): Promise<PolicyRow> {
    const [p] = await db.select().from(policies).where(and(eq(policies.id, id), eq(policies.companyId, companyId), isNull(policies.deletedAt)));
    if (!p) throw notFound('Policy');
    return p;
  }

  private async log(companyId: string, policyId: string | null, actorId: string | null, action: string, change: Record<string, unknown>) {
    await db.insert(policyChanges).values({ companyId, policyId, actorId, action, change });
  }

  private async labelFor(companyId: string, type: string, id: string): Promise<string> {
    if (type === 'role') return id;
    if (type === 'user') return (await db.select({ n: users.name }).from(users).where(and(eq(users.id, id), eq(users.companyId, companyId))))[0]?.n ?? id;
    if (type === 'team') return (await db.select({ n: teams.name }).from(teams).where(and(eq(teams.id, id), eq(teams.companyId, companyId))))[0]?.n ?? id;
    return (await db.select({ n: apiKeys.name }).from(apiKeys).where(and(eq(apiKeys.id, id), eq(apiKeys.companyId, companyId))))[0]?.n ?? id;
  }

  private async toItem(p: PolicyRow): Promise<PolicyItem> {
    const as = await db.select().from(policyAssignments).where(eq(policyAssignments.policyId, p.id));
    const assignments = await Promise.all(as.map(async a => ({ id: a.id, subjectType: a.subjectType, subjectId: a.subjectId, label: await this.labelFor(p.companyId, a.subjectType, a.subjectId) })));
    return { id: p.id, name: p.name, description: p.description, rules: p.rules as PolicyRule[], assignments, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString() };
  }

  async list(companyId: string): Promise<PolicyItem[]> {
    const rows = await db.select().from(policies).where(and(eq(policies.companyId, companyId), isNull(policies.deletedAt))).orderBy(policies.name);
    return Promise.all(rows.map(p => this.toItem(p)));
  }

  async create(companyId: string, actorId: string | null, input: CreatePolicyInput): Promise<PolicyItem> {
    try {
      const [p] = await db.insert(policies).values({ companyId, name: input.name, description: input.description ?? null, rules: input.rules, createdBy: actorId }).returning();
      await this.log(companyId, p!.id, actorId, 'created', { name: input.name, rules: input.rules });
      return this.toItem(p!);
    } catch (e) {
      if (isUnique(e)) throw conflict('POLICY_EXISTS', `A policy named "${input.name}" already exists.`);
      throw e;
    }
  }

  async update(companyId: string, actorId: string | null, id: string, input: Partial<CreatePolicyInput>): Promise<PolicyItem> {
    const cur = await this.mustGet(companyId, id);
    if (cur.isSystem) throw conflict('POLICY_SYSTEM', 'System policies cannot be edited.');
    try {
      const [p] = await db.update(policies).set({ ...(input.name ? { name: input.name } : {}), ...(input.description !== undefined ? { description: input.description } : {}), ...(input.rules ? { rules: input.rules } : {}), updatedAt: new Date() }).where(eq(policies.id, id)).returning();
      await this.log(companyId, id, actorId, 'updated', { before: { name: cur.name, rules: cur.rules }, after: { name: p!.name, rules: p!.rules } });
      return this.toItem(p!);
    } catch (e) {
      if (isUnique(e)) throw conflict('POLICY_EXISTS', 'A policy with that name already exists.');
      throw e;
    }
  }

  async remove(companyId: string, actorId: string | null, id: string): Promise<void> {
    const cur = await this.mustGet(companyId, id);
    if (cur.isSystem) throw conflict('POLICY_SYSTEM', 'System policies cannot be deleted.');
    await db.update(policies).set({ deletedAt: new Date() }).where(eq(policies.id, id));
    await db.delete(policyAssignments).where(eq(policyAssignments.policyId, id));
    await this.log(companyId, id, actorId, 'deleted', { name: cur.name });
  }

  async assign(companyId: string, actorId: string | null, id: string, input: AssignPolicyInput): Promise<PolicyItem> {
    const p = await this.mustGet(companyId, id);
    if (input.subjectType === 'role' && !['company_admin', 'sales_manager', 'agent', 'viewer'].includes(input.subjectId)) throw badRequest('POLICY_SUBJECT_INVALID', 'Unknown role.');
    if (input.subjectType !== 'role') {
      const label = await this.labelFor(companyId, input.subjectType, input.subjectId);
      if (label === input.subjectId) throw badRequest('POLICY_SUBJECT_INVALID', `That ${input.subjectType.replace('_', ' ')} does not exist in your company.`);
    }
    await db.insert(policyAssignments).values({ companyId, policyId: id, subjectType: input.subjectType, subjectId: input.subjectId }).onConflictDoNothing();
    await this.log(companyId, id, actorId, 'assigned', { ...input });
    return this.toItem(p);
  }

  async unassign(companyId: string, actorId: string | null, id: string, assignmentId: string): Promise<PolicyItem> {
    const p = await this.mustGet(companyId, id);
    const res = await db.delete(policyAssignments).where(and(eq(policyAssignments.id, assignmentId), eq(policyAssignments.policyId, id))).returning();
    if (res.length === 0) throw notFound('Assignment');
    await this.log(companyId, id, actorId, 'unassigned', { subjectType: res[0]!.subjectType, subjectId: res[0]!.subjectId });
    return this.toItem(p);
  }

  async changes(companyId: string, limit = 100): Promise<PolicyChangeItem[]> {
    const rows = await db.select({ c: policyChanges, name: users.name }).from(policyChanges).leftJoin(users, eq(users.id, policyChanges.actorId)).where(eq(policyChanges.companyId, companyId)).orderBy(desc(policyChanges.createdAt)).limit(Math.min(limit, 300));
    return rows.map(r => ({ id: r.c.id, policyId: r.c.policyId, action: r.c.action, actorName: r.name, change: r.c.change, createdAt: r.c.createdAt.toISOString() }));
  }

  /**
   * Decides whether the subject may perform `action` on `module`.
   * Roles stay the baseline: a subject with NO policies is not governed (allowed here, RBAC decides).
   * Once any policy is assigned to the person, their role, one of their teams or their API key, only what
   * those policies grant is allowed, and every condition on the granting rule must hold.
   */
  async evaluate(companyId: string, subject: Subject, module: PolicyModule, action: PolicyAction, now = new Date()): Promise<PolicyDecision> {
    const teamIds = subject.userId ? await teamsService.teamIdsOf(companyId, subject.userId) : [];
    const keys: Array<[string, string]> = [
      ...(subject.userId ? [['user', subject.userId] as [string, string]] : []),
      ...(subject.role ? [['role', subject.role] as [string, string]] : []),
      ...(subject.apiKeyId ? [['api_key', subject.apiKeyId] as [string, string]] : []),
      ...teamIds.map(t => ['team', t] as [string, string]),
    ];
    if (keys.length === 0) return { governed: false, allowed: true, reason: 'no subject' };

    const assigned = await db.select({ p: policies, type: policyAssignments.subjectType, subjectId: policyAssignments.subjectId }).from(policyAssignments).innerJoin(policies, eq(policies.id, policyAssignments.policyId)).where(and(eq(policyAssignments.companyId, companyId), isNull(policies.deletedAt)));
    const mine = assigned.filter(a => keys.some(([t, id]) => t === a.type && id === a.subjectId));
    if (mine.length === 0) return { governed: false, allowed: true, reason: 'no policy assigned' };

    for (const { p } of mine) {
      for (const raw of p.rules as unknown[]) {
        const rule = policyRuleSchema.safeParse(raw);
        if (!rule.success) continue;
        const r = rule.data;
        if (r.module !== '*' && r.module !== module) continue;
        if (!r.actions.includes(action)) continue;
        const c = r.conditions;
        if (c.businessHours && !inCallingWindow({ days: c.businessHours.days, startHour: c.businessHours.startHour, endHour: c.businessHours.endHour, timezone: c.businessHours.timezone }, now)) continue;
        if (c.teamIds && c.teamIds.length > 0 && !c.teamIds.some(t => teamIds.includes(t))) continue;
        return { governed: true, allowed: true, reason: `allowed by "${p.name}"` };
      }
    }
    return { governed: true, allowed: false, reason: `${action} on ${module} is not granted by your policies` };
  }
}

export const teamsService = new TeamsService();
export const policiesService = new PoliciesService();

/** Route guard: enforces policies for the signed-in person (or API key) on top of the role check. */
export function enforcePolicy(module: PolicyModule, action: PolicyAction) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const t = req.tenant;
    if (!t) {
      next();
      return;
    }
    policiesService
      .evaluate(t.companyId, { userId: t.userId, role: t.role }, module, action)
      .then(d => {
        if (d.allowed) return next();
        res.status(403).json({ success: false, error: { code: 'POLICY_DENIED', message: d.reason } });
        return undefined;
      })
      .catch(next);
  };
}
