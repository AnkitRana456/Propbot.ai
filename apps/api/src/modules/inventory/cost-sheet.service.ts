import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { costSheets, projects, units } from '../../db/schema/index.js';
import { ApiError } from '../../utils/api-error.js';

export interface CostSheetConfig {
  floorRisePerFloor?: number;
  plcCharges?: { label: string; amountPerSqft: number }[];
  parkingCharge?: number;
  clubhouseCharge?: number;
  maintenanceDeposit?: number;
  gstPercent?: number;
  stampDutyPercent?: number;
  registrationPercent?: number;
}

export interface CostSheetLine {
  label: string;
  amount: number;
  note?: string;
}

export interface CostSheetTotals {
  basePrice: number;
  preGstSubtotal: number;
  gst: number;
  agreementValue: number;
  stampDuty: number;
  registration: number;
  allInCost: number;
  discount: number;
  netPayable: number;
}

export interface ComputedCostSheet {
  lines: CostSheetLine[];
  totals: CostSheetTotals;
}

export function computeCostSheet(
  unit: { price: number; carpetAreaSqft: number; superAreaSqft?: number | null; floor?: number | null; bhk: number },
  config: CostSheetConfig,
  opts: { discount?: number; parkingSlots?: number } = {},
): ComputedCostSheet {
  const area = Number(unit.superAreaSqft ?? unit.carpetAreaSqft);
  const basePrice = Number(unit.price);
  const lines: CostSheetLine[] = [{ label: 'Base price', amount: basePrice }];

  let extras = 0;

  const floor = unit.floor ?? 0;
  if (config.floorRisePerFloor && floor > 0) {
    const rise = config.floorRisePerFloor * floor * area;
    extras += rise;
    lines.push({ label: `Floor rise (floor ${floor})`, amount: rise, note: `₹${config.floorRisePerFloor}/sqft × ${area} sqft × ${floor} floors` });
  }

  for (const plc of config.plcCharges ?? []) {
    const amt = plc.amountPerSqft * area;
    extras += amt;
    lines.push({ label: plc.label, amount: amt, note: `₹${plc.amountPerSqft}/sqft × ${area} sqft` });
  }

  const slots = opts.parkingSlots ?? 1;
  if (config.parkingCharge && slots > 0) {
    const amt = config.parkingCharge * slots;
    extras += amt;
    lines.push({ label: `Parking (${slots} slot${slots > 1 ? 's' : ''})`, amount: amt });
  }

  if (config.clubhouseCharge) {
    extras += config.clubhouseCharge;
    lines.push({ label: 'Clubhouse / amenities', amount: config.clubhouseCharge });
  }

  if (config.maintenanceDeposit) {
    extras += config.maintenanceDeposit;
    lines.push({ label: 'Maintenance deposit', amount: config.maintenanceDeposit });
  }

  const preGstSubtotal = basePrice + extras;
  const gstRate = (config.gstPercent ?? 5) / 100;
  const gst = Math.round(preGstSubtotal * gstRate);
  lines.push({ label: `GST @ ${config.gstPercent ?? 5}%`, amount: gst });

  const agreementValue = preGstSubtotal + gst;
  const sdRate = (config.stampDutyPercent ?? 5) / 100;
  const stampDuty = Math.round(agreementValue * sdRate);
  const regRate = (config.registrationPercent ?? 1) / 100;
  const registration = Math.round(agreementValue * regRate);
  lines.push({ label: `Stamp duty @ ${config.stampDutyPercent ?? 5}%`, amount: stampDuty });
  lines.push({ label: `Registration @ ${config.registrationPercent ?? 1}%`, amount: registration });

  const discount = opts.discount ?? 0;
  if (discount > 0) lines.push({ label: 'Discount', amount: -discount });

  const allInCost = agreementValue + stampDuty + registration;
  const netPayable = allInCost - discount;

  return {
    lines,
    totals: { basePrice, preGstSubtotal, gst, agreementValue, stampDuty, registration, allInCost, discount, netPayable },
  };
}

export class CostSheetService {
  async getConfig(companyId: string, projectId: string): Promise<CostSheetConfig> {
    const [row] = await db
      .select({ costSheetConfig: projects.costSheetConfig })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.companyId, companyId)))
      .limit(1);
    if (!row) throw new ApiError(404, 'PROJECT_NOT_FOUND', 'Project not found');
    return (row.costSheetConfig as CostSheetConfig) ?? {};
  }

  async updateConfig(companyId: string, projectId: string, config: CostSheetConfig): Promise<CostSheetConfig> {
    const [row] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.companyId, companyId)))
      .limit(1);
    if (!row) throw new ApiError(404, 'PROJECT_NOT_FOUND', 'Project not found');
    await db.update(projects).set({ costSheetConfig: config as Record<string, unknown> }).where(eq(projects.id, projectId));
    return config;
  }

  async createSheet(
    companyId: string,
    userId: string,
    input: { projectId: string; unitId: string; leadId?: string; discount?: number; parkingSlots?: number; notes?: string; validDays?: number },
  ) {
    const [unit] = await db
      .select()
      .from(units)
      .where(and(eq(units.id, input.unitId), eq(units.companyId, companyId), eq(units.projectId, input.projectId)))
      .limit(1);
    if (!unit) throw new ApiError(404, 'UNIT_NOT_FOUND', 'Unit not found');

    const config = await this.getConfig(companyId, input.projectId);
    const computed = computeCostSheet(
      { price: Number(unit.price), carpetAreaSqft: Number(unit.carpetAreaSqft), superAreaSqft: unit.superAreaSqft ? Number(unit.superAreaSqft) : null, floor: unit.floor, bhk: unit.bhk },
      config,
      { discount: input.discount, parkingSlots: input.parkingSlots },
    );

    const token = crypto.randomBytes(24).toString('base64url');
    const validUntil = input.validDays ? new Date(Date.now() + input.validDays * 86400_000) : null;

    const [sheet] = await db
      .insert(costSheets)
      .values({
        companyId,
        projectId: input.projectId,
        unitId: input.unitId,
        leadId: input.leadId ?? null,
        token,
        lines: computed.lines as unknown[],
        totals: computed.totals as unknown as Record<string, number>,
        discount: String(computed.totals.discount),
        notes: input.notes ?? null,
        validUntil,
        createdBy: userId,
      })
      .returning();

    return { ...sheet, computed };
  }

  async getSheet(token: string) {
    const [sheet] = await db.select().from(costSheets).where(eq(costSheets.token, token)).limit(1);
    if (!sheet) throw new ApiError(404, 'SHEET_NOT_FOUND', 'Cost sheet not found or expired');
    if (sheet.validUntil && sheet.validUntil < new Date()) throw new ApiError(410, 'SHEET_EXPIRED', 'This cost sheet has expired');
    await db.update(costSheets).set({ viewCount: sheet.viewCount + 1 }).where(eq(costSheets.id, sheet.id));
    return sheet;
  }

  async listSheets(companyId: string, filters: { projectId?: string; unitId?: string; leadId?: string }) {
    const conditions = [eq(costSheets.companyId, companyId)];
    if (filters.projectId) conditions.push(eq(costSheets.projectId, filters.projectId));
    if (filters.unitId) conditions.push(eq(costSheets.unitId, filters.unitId));
    if (filters.leadId) conditions.push(eq(costSheets.leadId, filters.leadId));
    return db.select().from(costSheets).where(and(...conditions)).orderBy(costSheets.createdAt);
  }
}

export const costSheetService = new CostSheetService();
