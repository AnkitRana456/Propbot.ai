import { and, eq, ilike, isNull, lte, gte, sql } from 'drizzle-orm';
import { leadStatusEnum, type ActionDefinitionItem } from '@propbot/shared';
import { db } from '../../db/index.js';
import { projects, units } from '../../db/schema/index.js';
import { leadsService } from '../leads/leads.service.js';
import { voiceService } from '../voice/voice.service.js';
import { ApiError } from '../../utils/api-error.js';

export interface ActionContext {
  companyId: string;
  userId?: string | null;
  leadId?: string | null;
}

interface ActionImpl extends ActionDefinitionItem {
  run: (ctx: ActionContext, input: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
};

interface UnitFilter {
  project?: string;
  tower?: string;
  bhk?: number;
  maxPrice?: number;
  minPrice?: number;
}

/** Available units matching the filters, cheapest first, with project names. */
export async function queryAvailableUnits(companyId: string, f: UnitFilter, limit = 10) {
  const conds = [eq(units.companyId, companyId), isNull(units.deletedAt), isNull(projects.deletedAt), eq(units.status, 'available')];
  if (f.project) conds.push(ilike(projects.name, `%${f.project}%`));
  if (f.tower) conds.push(ilike(units.tower, `%${f.tower}%`));
  if (f.bhk !== undefined) conds.push(eq(units.bhk, f.bhk));
  if (f.maxPrice !== undefined) conds.push(lte(units.price, String(f.maxPrice)));
  if (f.minPrice !== undefined) conds.push(gte(units.price, String(f.minPrice)));
  const rows = await db
    .select({
      project: projects.name,
      location: projects.location,
      tower: units.tower,
      floor: units.floor,
      unitNumber: units.unitNumber,
      bhk: units.bhk,
      carpetAreaSqft: units.carpetAreaSqft,
      price: units.price,
      facing: units.facing,
    })
    .from(units)
    .innerJoin(projects, eq(projects.id, units.projectId))
    .where(and(...conds))
    .orderBy(units.price)
    .limit(limit);
  return rows.map(r => ({ ...r, price: Number(r.price), carpetAreaSqft: Number(r.carpetAreaSqft) }));
}

const ACTIONS: ActionImpl[] = [
  {
    id: 'search_inventory',
    name: 'Search inventory',
    category: 'property',
    description: 'Find available units by project, tower, BHK and budget, live from your inventory.',
    inputs: [
      { key: 'project', type: 'string', description: 'Project name (partial match)', required: false },
      { key: 'tower', type: 'string', description: 'Tower or wing', required: false },
      { key: 'bhk', type: 'number', description: 'Bedrooms', required: false },
      { key: 'maxPrice', type: 'number', description: 'Maximum price in rupees', required: false },
      { key: 'minPrice', type: 'number', description: 'Minimum price in rupees', required: false },
    ],
    outputs: ['count', 'units'],
    requiresApproval: false,
    async run(ctx, input) {
      const found = await queryAvailableUnits(ctx.companyId, {
        project: str(input.project),
        tower: str(input.tower),
        bhk: num(input.bhk),
        maxPrice: num(input.maxPrice),
        minPrice: num(input.minPrice),
      });
      return { count: found.length, units: found };
    },
  },
  {
    id: 'check_unit_availability',
    name: 'Check unit availability',
    category: 'property',
    description: 'Is a specific unit, or a 3BHK in Tower B under a budget, available right now and at what price?',
    inputs: [
      { key: 'project', type: 'string', description: 'Project name', required: false },
      { key: 'tower', type: 'string', description: 'Tower or wing', required: false },
      { key: 'unitNumber', type: 'string', description: 'Exact unit number', required: false },
      { key: 'bhk', type: 'number', description: 'Bedrooms', required: false },
      { key: 'maxPrice', type: 'number', description: 'Maximum price in rupees', required: false },
    ],
    outputs: ['available', 'count', 'cheapestPrice', 'units'],
    requiresApproval: false,
    async run(ctx, input) {
      const unitNumber = str(input.unitNumber);
      if (unitNumber) {
        const project = str(input.project);
        const conds = [eq(units.companyId, ctx.companyId), isNull(units.deletedAt), eq(units.unitNumber, unitNumber)];
        if (project) conds.push(ilike(projects.name, `%${project}%`));
        const rows = await db
          .select({ project: projects.name, tower: units.tower, unitNumber: units.unitNumber, bhk: units.bhk, price: units.price, status: units.status })
          .from(units)
          .innerJoin(projects, eq(projects.id, units.projectId))
          .where(and(...conds))
          .limit(5);
        const mapped = rows.map(r => ({ ...r, price: Number(r.price) }));
        return { available: mapped.some(r => r.status === 'available'), count: mapped.length, cheapestPrice: null, units: mapped };
      }
      const found = await queryAvailableUnits(ctx.companyId, {
        project: str(input.project),
        tower: str(input.tower),
        bhk: num(input.bhk),
        maxPrice: num(input.maxPrice),
      });
      return { available: found.length > 0, count: found.length, cheapestPrice: found[0]?.price ?? null, units: found };
    },
  },
  {
    id: 'update_lead_stage',
    name: 'Set lead stage',
    category: 'lead',
    description: 'Move a lead to a pipeline stage such as contacted, qualified, site_visit_scheduled, negotiation, won or lost.',
    inputs: [
      { key: 'leadId', type: 'string', description: 'Lead id (defaults to the lead in context)', required: false },
      { key: 'status', type: 'string', description: 'Target stage', required: true },
      { key: 'lostReason', type: 'string', description: 'Used when status is lost', required: false },
    ],
    outputs: ['leadId', 'status'],
    requiresApproval: false,
    async run(ctx, input) {
      const leadId = str(input.leadId) ?? ctx.leadId;
      if (!leadId) throw new ApiError(400, 'ACTION_NO_LEAD', 'No lead id was provided and none is in context.');
      const parsed = leadStatusEnum.safeParse(input.status);
      if (!parsed.success) throw new ApiError(400, 'ACTION_BAD_STAGE', `Unknown stage "${String(input.status)}".`);
      await leadsService.updateLeadStatus(ctx.companyId, leadId, parsed.data, str(input.lostReason));
      return { leadId, status: parsed.data };
    },
  },
  {
    id: 'request_voice_call',
    name: 'Call the lead (AI voice)',
    category: 'ops',
    description: 'Place an AI voice call to the lead. Skipped when the lead has not given call consent, is on the DND list, or it is outside calling hours.',
    inputs: [{ key: 'leadId', type: 'string', description: 'Lead id (defaults to the lead in context)', required: false }],
    outputs: ['status', 'reason'],
    requiresApproval: false,
    async run(ctx, input) {
      const leadId = str(input.leadId) ?? ctx.leadId;
      if (!leadId) throw new ApiError(400, 'ACTION_NO_LEAD', 'No lead id was provided and none is in context.');
      const out = await voiceService.initiateCallback(ctx.companyId, leadId);
      return { status: out.status, reason: 'reason' in out ? out.reason : null };
    },
  },
  {
    id: 'get_project_summary',
    name: 'Get project summary',
    category: 'property',
    description: 'Location, status, available unit count and price range of a project by name.',
    inputs: [{ key: 'project', type: 'string', description: 'Project name (partial match)', required: true }],
    outputs: ['found', 'name', 'location', 'status', 'availableUnits', 'minPrice', 'maxPrice'],
    requiresApproval: false,
    async run(ctx, input) {
      const name = str(input.project);
      if (!name) throw new ApiError(400, 'ACTION_BAD_INPUT', 'project is required.');
      const [p] = await db
        .select({ id: projects.id, name: projects.name, location: projects.location, status: projects.status })
        .from(projects)
        .where(and(eq(projects.companyId, ctx.companyId), isNull(projects.deletedAt), ilike(projects.name, `%${name}%`)))
        .limit(1);
      if (!p) return { found: false };
      const [agg] = await db
        .select({ n: sql<number>`count(*)::int`, lo: sql<string | null>`min(${units.price})`, hi: sql<string | null>`max(${units.price})` })
        .from(units)
        .where(and(eq(units.projectId, p.id), eq(units.companyId, ctx.companyId), eq(units.status, 'available'), isNull(units.deletedAt)));
      return {
        found: true,
        name: p.name,
        location: p.location,
        status: p.status,
        availableUnits: agg?.n ?? 0,
        minPrice: agg?.lo ? Number(agg.lo) : null,
        maxPrice: agg?.hi ? Number(agg.hi) : null,
      };
    },
  },
];

export function listActions(): ActionDefinitionItem[] {
  return ACTIONS.map(({ run: _run, ...def }) => def);
}

export async function runAction(id: string, ctx: ActionContext, input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = ACTIONS.find(a => a.id === id);
  if (!action) throw new ApiError(404, 'ACTION_NOT_FOUND', `Unknown action "${id}".`);
  return action.run(ctx, input);
}
