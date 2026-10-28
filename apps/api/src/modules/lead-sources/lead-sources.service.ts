import crypto from 'node:crypto';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { CreateLeadSourceInput, LeadSourceEventItem, LeadSourceItem, LeadSourceType, UpdateLeadSourceInput } from '@propbot/shared';
import { db } from '../../db/index.js';
import { chatbots, forms, leadSourceEvents, leadSources } from '../../db/schema/index.js';
import { ApiError, badRequest, notFound } from '../../utils/api-error.js';
import { leadsService } from '../leads/leads.service.js';
import { formsService } from '../forms/forms.service.js';
import { mapLead, parseCsv, toCaptureInput } from './lead-source-mappers.js';

type Row = typeof leadSources.$inferSelect;
const MAX_CSV_ROWS = 500;
const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

const toItem = (r: Row): LeadSourceItem => ({
  id: r.id,
  name: r.name,
  sourceType: r.sourceType as LeadSourceType,
  keyPrefix: r.apiKeyPrefix,
  fieldMapping: r.fieldMapping,
  chatbotId: r.chatbotId,
  formId: r.formId,
  attribution: r.attribution,
  isActive: r.isActive,
  totalReceived: r.totalReceived,
  lastReceivedAt: r.lastReceivedAt?.toISOString() ?? null,
  createdAt: r.createdAt.toISOString(),
});

function newKey(): { prefix: string; full: string } {
  const prefix = crypto.randomBytes(4).toString('hex');
  return { prefix, full: `pbls_${prefix}_${crypto.randomBytes(20).toString('hex')}` };
}

export interface IngestOutcome {
  status: 'processed' | 'duplicate' | 'rejected' | 'failed';
  leadId?: string;
  error?: string;
}

class LeadSourcesService {
  private async mustGet(companyId: string, id: string): Promise<Row> {
    const [r] = await db.select().from(leadSources).where(and(eq(leadSources.id, id), eq(leadSources.companyId, companyId), isNull(leadSources.deletedAt)));
    if (!r) throw notFound('Lead source');
    return r;
  }

  private async assertRefs(companyId: string, chatbotId?: string | null, formId?: string | null) {
    if (chatbotId) {
      const [b] = await db.select({ id: chatbots.id }).from(chatbots).where(and(eq(chatbots.id, chatbotId), eq(chatbots.companyId, companyId)));
      if (!b) throw badRequest('CHATBOT_INVALID', 'That chatbot does not exist.');
    }
    if (formId) {
      const [f] = await db.select({ id: forms.id }).from(forms).where(and(eq(forms.id, formId), eq(forms.companyId, companyId), isNull(forms.deletedAt)));
      if (!f) throw badRequest('FORM_INVALID', 'That form does not exist.');
    }
  }

  async list(companyId: string): Promise<LeadSourceItem[]> {
    const rows = await db.select().from(leadSources).where(and(eq(leadSources.companyId, companyId), isNull(leadSources.deletedAt))).orderBy(desc(leadSources.createdAt));
    return rows.map(toItem);
  }

  /** Returns the full API key exactly once. */
  async create(companyId: string, userId: string | null, input: CreateLeadSourceInput): Promise<{ source: LeadSourceItem; apiKey: string }> {
    await this.assertRefs(companyId, input.chatbotId, input.formId);
    const key = newKey();
    const [row] = await db
      .insert(leadSources)
      .values({
        companyId,
        name: input.name,
        sourceType: input.sourceType,
        apiKeyPrefix: key.prefix,
        apiKeyHash: sha256(key.full),
        fieldMapping: input.fieldMapping,
        chatbotId: input.chatbotId ?? null,
        formId: input.formId ?? null,
        attribution: input.attribution,
        createdBy: userId,
      })
      .returning();
    return { source: toItem(row!), apiKey: key.full };
  }

  async update(companyId: string, id: string, input: UpdateLeadSourceInput): Promise<LeadSourceItem> {
    await this.mustGet(companyId, id);
    await this.assertRefs(companyId, input.chatbotId, input.formId);
    const [row] = await db
      .update(leadSources)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(leadSources.id, id), eq(leadSources.companyId, companyId)))
      .returning();
    return toItem(row!);
  }

  async rotateKey(companyId: string, id: string): Promise<{ source: LeadSourceItem; apiKey: string }> {
    await this.mustGet(companyId, id);
    const key = newKey();
    const [row] = await db
      .update(leadSources)
      .set({ apiKeyPrefix: key.prefix, apiKeyHash: sha256(key.full), updatedAt: new Date() })
      .where(and(eq(leadSources.id, id), eq(leadSources.companyId, companyId)))
      .returning();
    return { source: toItem(row!), apiKey: key.full };
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.mustGet(companyId, id);
    await db.update(leadSources).set({ deletedAt: new Date(), isActive: false }).where(eq(leadSources.id, id));
  }

  async events(companyId: string, id: string, limit = 30): Promise<LeadSourceEventItem[]> {
    await this.mustGet(companyId, id);
    const rows = await db.select().from(leadSourceEvents).where(and(eq(leadSourceEvents.leadSourceId, id), eq(leadSourceEvents.companyId, companyId))).orderBy(desc(leadSourceEvents.createdAt)).limit(Math.min(limit, 100));
    return rows.map(e => ({ id: e.id, status: e.status as LeadSourceEventItem['status'], leadId: e.leadId, error: e.error, payload: e.payload, createdAt: e.createdAt.toISOString() }));
  }

  /** Resolves an `x-api-key` to its active source; constant-time hash comparison. */
  async authenticate(apiKey: string | undefined): Promise<Row> {
    const m = /^pbls_([0-9a-f]{8})_([0-9a-f]{40})$/.exec(apiKey ?? '');
    if (!m) throw new ApiError(401, 'LEAD_SOURCE_KEY_INVALID', 'Missing or malformed API key.');
    const [row] = await db.select().from(leadSources).where(and(eq(leadSources.apiKeyPrefix, m[1]!), isNull(leadSources.deletedAt)));
    const expected = row?.apiKeyHash ?? sha256('x');
    const ok = crypto.timingSafeEqual(Buffer.from(sha256(apiKey!)), Buffer.from(expected));
    if (!row || !ok) throw new ApiError(401, 'LEAD_SOURCE_KEY_INVALID', 'Invalid API key.');
    if (!row.isActive) throw new ApiError(403, 'LEAD_SOURCE_DISABLED', 'This lead source is switched off.');
    return row;
  }

  /** Maps one payload to a lead (de-duplicated by the lead engine) and logs the outcome. */
  async ingest(source: Row, payload: unknown): Promise<IngestOutcome> {
    const type = source.sourceType as LeadSourceType;
    const log = async (outcome: IngestOutcome) => {
      await db.insert(leadSourceEvents).values({ companyId: source.companyId, leadSourceId: source.id, payload: payload as never, status: outcome.status, leadId: outcome.leadId ?? null, error: outcome.error ?? null });
      await db
        .update(leadSources)
        .set({ totalReceived: sql`${leadSources.totalReceived} + 1`, lastReceivedAt: new Date() })
        .where(eq(leadSources.id, source.id));
      return outcome;
    };

    const mapped = mapLead(type, source.fieldMapping, payload);
    if (!mapped) return log({ status: 'rejected', error: 'No phone number found in the payload. Check the field mapping.' });

    try {
      const sourceLabel = type === 'generic' ? `api:${source.name}`.slice(0, 100) : type;
      const { lead, isDuplicate } = await leadsService.captureOrUpdateLead(
        source.companyId,
        toCaptureInput(mapped, {
          chatbotId: source.chatbotId ?? undefined,
          source: sourceLabel,
          utmParams: { ...source.attribution, ...mapped.utm, utm_source: mapped.utm.utm_source ?? source.attribution.utm_source ?? sourceLabel },
        }),
      );
      if (source.formId && Object.keys(mapped.attributes).length > 0) {
        await formsService.applyToLead({ companyId: source.companyId, formId: source.formId, leadId: lead.id, values: mapped.attributes, source: 'import' });
      }
      return log({ status: isDuplicate ? 'duplicate' : 'processed', leadId: lead.id });
    } catch (e) {
      const err = e as { code?: string; message?: string };
      return log({ status: err.code === 'INVALID_PHONE' ? 'rejected' : 'failed', error: (err.message ?? 'Could not save the lead.').slice(0, 300) });
    }
  }

  async importCsv(companyId: string, id: string, csv: string) {
    const source = await this.mustGet(companyId, id);
    const rows = parseCsv(csv);
    if (rows.length === 0) throw badRequest('CSV_EMPTY', 'The CSV needs a header row and at least one data row.');
    if (rows.length > MAX_CSV_ROWS) throw badRequest('CSV_TOO_LARGE', `Import at most ${MAX_CSV_ROWS} rows at a time.`);
    const summary = { total: rows.length, processed: 0, duplicate: 0, rejected: 0, failed: 0, errors: [] as Array<{ row: number; error: string }> };
    for (const [i, row] of rows.entries()) {
      const out = await this.ingest(source, row);
      summary[out.status] += 1;
      if (out.error && summary.errors.length < 20) summary.errors.push({ row: i + 2, error: out.error });
    }
    return summary;
  }
}

export const leadSourcesService = new LeadSourcesService();

// ── Walk-in kiosk helpers ────────────────────────────────────────────────

/** Find a lead source by its kiosk token (public, no companyId check). */
export async function findKioskSource(token: string) {
  const [row] = await db.select().from(leadSources).where(and(eq(leadSources.kioskToken, token), eq(leadSources.isActive, true), isNull(leadSources.deletedAt))).limit(1);
  return row;
}

/** Generate (or regenerate) a kiosk token for a lead source. */
export async function generateKioskToken(companyId: string, leadSourceId: string): Promise<string> {
  const token = crypto.randomBytes(24).toString('base64url');
  await db.update(leadSources).set({ kioskToken: token, updatedAt: new Date() }).where(and(eq(leadSources.id, leadSourceId), eq(leadSources.companyId, companyId)));
  return token;
}

/** Accept a walk-in via kiosk token, returns the new lead id. */
export async function acceptWalkIn(
  token: string,
  input: {
    name: string;
    phone: string;
    email?: string;
    projectInterest?: string;
    utmParams?: Record<string, string>;
    referrerUrl?: string;
    landingPage?: string;
    userAgent?: string;
    ipAddress?: string;
  },
) {
  const source = await findKioskSource(token);
  if (!source) throw new ApiError(404, 'KIOSK_NOT_FOUND', 'Kiosk link not found or disabled');

  const { lead, isDuplicate } = await leadsService.captureOrUpdateLead(source.companyId, {
    name: input.name,
    phone: input.phone,
    email: input.email,
    source: 'walk_in',
    utmParams: { utm_source: 'walk_in', ...input.utmParams },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    referrerUrl: input.referrerUrl,
    landingPage: input.landingPage,
    metadata: input.projectInterest ? { projectInterest: input.projectInterest } : undefined,
  });

  return { status: isDuplicate ? 'duplicate' : 'processed', leadId: lead.id };
}
