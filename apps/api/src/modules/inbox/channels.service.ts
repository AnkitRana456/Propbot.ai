import { and, desc, eq, isNull } from 'drizzle-orm';
import type {
  ChannelConnectionItem,
  CreateChannelConnectionInput,
  CreateTemplateInput,
  CreateWidgetInput,
  MessageTemplateItem,
  UpdateChannelConnectionInput,
  UpdateTemplateInput,
  UpdateWidgetInput,
  WidgetItem,
} from '@propbot/shared';
import { db } from '../../db/index.js';
import { channelConnections, chatbots, messageTemplates, widgets } from '../../db/schema/index.js';
import { encryptSecret, packEncryptedSecret, unpackEncryptedSecret } from '../../utils/crypto-vault.js';
import { ApiError, badRequest, conflict, notFound } from '../../utils/api-error.js';

const isUnique = (e: unknown) => /duplicate key|unique/i.test(String((e as Error)?.message ?? '') + String((e as { cause?: Error })?.cause?.message ?? ''));
const live = () => process.env.META_LIVE_DISPATCH === 'true';

// ------------------------------------------------------------------ connections
type ConnRow = typeof channelConnections.$inferSelect;
const toConn = (r: ConnRow): ChannelConnectionItem => ({
  id: r.id,
  channel: r.channel,
  name: r.name,
  status: r.status,
  externalAccountId: r.externalAccountId,
  chatbotId: r.chatbotId,
  config: r.config,
  secretKeys: Object.keys(r.secrets),
  lastError: r.lastError,
  lastSyncedAt: r.lastSyncedAt?.toISOString() ?? null,
  createdAt: r.createdAt.toISOString(),
});
const sealAll = (secrets: Record<string, string>) => Object.fromEntries(Object.entries(secrets).filter(([, v]) => v).map(([k, v]) => [k, packEncryptedSecret(encryptSecret(v))]));

// ------------------------------------------------------------------ templates
type TplRow = typeof messageTemplates.$inferSelect;
const VAR_RE = /\{\{\s*(\d+)\s*\}\}/g;

export function templateVariables(content: { header?: string; body: string }): number[] {
  const found = new Set<number>();
  for (const text of [content.header ?? '', content.body]) for (const m of text.matchAll(VAR_RE)) found.add(Number(m[1]));
  return [...found].sort((a, b) => a - b);
}

function toTpl(r: TplRow): MessageTemplateItem {
  const comps = r.components as Array<{ type: string; text?: string; buttons?: unknown[] }>;
  const find = (t: string) => comps.find(c => c.type === t);
  const content = {
    header: find('HEADER')?.text,
    body: find('BODY')?.text ?? '',
    footer: find('FOOTER')?.text,
    buttons: ((find('BUTTONS')?.buttons ?? []) as MessageTemplateItem['content']['buttons']),
  };
  return {
    id: r.id,
    channel: r.channel,
    name: r.name,
    language: r.language,
    category: r.category,
    content,
    sampleValues: r.sampleValues,
    variableCount: templateVariables(content).length,
    status: r.status as MessageTemplateItem['status'],
    rejectionReason: r.rejectionReason,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function buildComponents(content: CreateTemplateInput['content']) {
  return [
    ...(content.header ? [{ type: 'HEADER', format: 'TEXT', text: content.header }] : []),
    { type: 'BODY', text: content.body },
    ...(content.footer ? [{ type: 'FOOTER', text: content.footer }] : []),
    ...(content.buttons.length ? [{ type: 'BUTTONS', buttons: content.buttons }] : []),
  ];
}

function assertVariables(content: CreateTemplateInput['content'], samples: string[], requireSamples: boolean) {
  const vars = templateVariables(content);
  vars.forEach((n, i) => {
    if (n !== i + 1) throw badRequest('TEMPLATE_VARIABLES', 'Variables must be numbered {{1}}, {{2}}, ... without gaps.');
  });
  if (/^\s*\{\{|\}\}\s*$/.test(content.body)) throw badRequest('TEMPLATE_VARIABLES', 'A template body cannot start or end with a variable.');
  if (requireSamples && samples.length < vars.length) throw badRequest('TEMPLATE_SAMPLES', `Provide an example value for each of the ${vars.length} variable(s) before submitting.`);
}

/** Compliance phrases the mock reviewer rejects (mirrors what Meta flags for property marketing). */
const MOCK_REJECT = /guaranteed returns|100% (?:safe|profit)|risk[- ]free/i;

class ChannelsService {
  // ---------------- connections
  async listConnections(companyId: string): Promise<ChannelConnectionItem[]> {
    return (await db.select().from(channelConnections).where(eq(channelConnections.companyId, companyId)).orderBy(desc(channelConnections.createdAt))).map(toConn);
  }

  private async mustConn(companyId: string, id: string): Promise<ConnRow> {
    const [r] = await db.select().from(channelConnections).where(and(eq(channelConnections.id, id), eq(channelConnections.companyId, companyId)));
    if (!r) throw notFound('Channel connection');
    return r;
  }

  private async assertBot(companyId: string, chatbotId?: string | null) {
    if (!chatbotId) return;
    const [b] = await db.select({ id: chatbots.id }).from(chatbots).where(and(eq(chatbots.id, chatbotId), eq(chatbots.companyId, companyId)));
    if (!b) throw badRequest('CHATBOT_INVALID', 'That chatbot does not exist.');
  }

  async createConnection(companyId: string, input: CreateChannelConnectionInput): Promise<ChannelConnectionItem> {
    await this.assertBot(companyId, input.chatbotId);
    try {
      const [r] = await db
        .insert(channelConnections)
        .values({ companyId, channel: input.channel, name: input.name, externalAccountId: input.externalAccountId ?? null, chatbotId: input.chatbotId ?? null, config: input.config, secrets: sealAll(input.secrets) })
        .returning();
      return toConn(r!);
    } catch (e) {
      if (isUnique(e)) throw conflict('CHANNEL_ACCOUNT_TAKEN', 'That account is already connected to a PropBot workspace.');
      throw e;
    }
  }

  async updateConnection(companyId: string, id: string, input: UpdateChannelConnectionInput): Promise<ChannelConnectionItem> {
    const cur = await this.mustConn(companyId, id);
    await this.assertBot(companyId, input.chatbotId);
    const { secrets, ...rest } = input;
    try {
      const [r] = await db
        .update(channelConnections)
        .set({ ...rest, ...(secrets ? { secrets: { ...cur.secrets, ...sealAll(secrets) } } : {}), updatedAt: new Date() })
        .where(eq(channelConnections.id, id))
        .returning();
      return toConn(r!);
    } catch (e) {
      if (isUnique(e)) throw conflict('CHANNEL_ACCOUNT_TAKEN', 'That account is already connected to a PropBot workspace.');
      throw e;
    }
  }

  async removeConnection(companyId: string, id: string): Promise<void> {
    await this.mustConn(companyId, id);
    await db.delete(channelConnections).where(eq(channelConnections.id, id));
  }

  /** Verifies the credentials (Graph API when live, accepted as-is in dev) and updates the status. */
  async testConnection(companyId: string, id: string): Promise<ChannelConnectionItem> {
    const c = await this.mustConn(companyId, id);
    let status = 'connected';
    let lastError: string | null = null;
    if (c.channel === 'api') status = 'connected';
    else if (!c.secrets.accessToken && c.channel !== 'email') {
      status = 'error';
      lastError = 'Add an access token first.';
    } else if (live() && (c.channel === 'instagram' || c.channel === 'messenger')) {
      try {
        const res = await fetch('https://graph.facebook.com/v19.0/me', { headers: { Authorization: `Bearer ${unpackEncryptedSecret(c.secrets.accessToken!)}` }, signal: AbortSignal.timeout(8000) });
        if (!res.ok) {
          status = 'error';
          lastError = `Meta rejected the token (HTTP ${res.status}).`;
        }
      } catch {
        status = 'error';
        lastError = 'Could not reach Meta.';
      }
    }
    const [r] = await db.update(channelConnections).set({ status, lastError, lastSyncedAt: new Date(), updatedAt: new Date() }).where(eq(channelConnections.id, id)).returning();
    return toConn(r!);
  }

  // ---------------- templates
  async listTemplates(companyId: string): Promise<MessageTemplateItem[]> {
    return (await db.select().from(messageTemplates).where(and(eq(messageTemplates.companyId, companyId), isNull(messageTemplates.deletedAt))).orderBy(desc(messageTemplates.updatedAt))).map(toTpl);
  }

  private async mustTpl(companyId: string, id: string): Promise<TplRow> {
    const [r] = await db.select().from(messageTemplates).where(and(eq(messageTemplates.id, id), eq(messageTemplates.companyId, companyId), isNull(messageTemplates.deletedAt)));
    if (!r) throw notFound('Template');
    return r;
  }

  async createTemplate(companyId: string, userId: string | null, input: CreateTemplateInput): Promise<MessageTemplateItem> {
    assertVariables(input.content, input.sampleValues, false);
    try {
      const [r] = await db
        .insert(messageTemplates)
        .values({ companyId, name: input.name, language: input.language, category: input.category, components: buildComponents(input.content), sampleValues: input.sampleValues, createdBy: userId })
        .returning();
      return toTpl(r!);
    } catch (e) {
      if (isUnique(e)) throw conflict('TEMPLATE_NAME_TAKEN', `A template named "${input.name}" (${input.language}) already exists.`);
      throw e;
    }
  }

  async updateTemplate(companyId: string, id: string, input: UpdateTemplateInput): Promise<MessageTemplateItem> {
    const cur = await this.mustTpl(companyId, id);
    if (cur.status === 'pending' || cur.status === 'approved') throw conflict('TEMPLATE_LOCKED', 'Approved or pending templates cannot be edited. Create a new one instead.');
    const existing = toTpl(cur);
    const content = input.content ?? existing.content;
    const samples = input.sampleValues ?? cur.sampleValues;
    assertVariables(content, samples, false);
    const [r] = await db
      .update(messageTemplates)
      .set({ components: buildComponents(content), sampleValues: samples, category: input.category ?? cur.category, status: 'draft', rejectionReason: null, updatedAt: new Date() })
      .where(eq(messageTemplates.id, id))
      .returning();
    return toTpl(r!);
  }

  async removeTemplate(companyId: string, id: string): Promise<void> {
    await this.mustTpl(companyId, id);
    await db.update(messageTemplates).set({ deletedAt: new Date() }).where(eq(messageTemplates.id, id));
  }

  /** Sends the template for approval. Dev/mock review is immediate; live Meta review arrives asynchronously. */
  async submitTemplate(companyId: string, id: string): Promise<MessageTemplateItem> {
    const cur = await this.mustTpl(companyId, id);
    if (cur.status === 'approved' || cur.status === 'pending') throw conflict('TEMPLATE_ALREADY_SUBMITTED', `This template is already ${cur.status}.`);
    const t = toTpl(cur);
    assertVariables(t.content, cur.sampleValues, true);
    if (live()) {
      const [r] = await db.update(messageTemplates).set({ status: 'pending', updatedAt: new Date() }).where(eq(messageTemplates.id, id)).returning();
      return toTpl(r!);
    }
    const rejected = MOCK_REJECT.test(`${t.content.header ?? ''} ${t.content.body}`);
    const [r] = await db
      .update(messageTemplates)
      .set({
        status: rejected ? 'rejected' : 'approved',
        rejectionReason: rejected ? 'Promises guaranteed returns, which is not allowed in property marketing.' : null,
        providerTemplateId: rejected ? null : `mock_tpl_${Date.now()}`,
        updatedAt: new Date(),
      })
      .where(eq(messageTemplates.id, id))
      .returning();
    return toTpl(r!);
  }

  // ---------------- widgets
  private toWidget(r: typeof widgets.$inferSelect): WidgetItem {
    return { id: r.id, name: r.name, chatbotId: r.chatbotId, allowedDomains: r.allowedDomains, styling: r.styling, sections: r.sections, nudges: r.nudges as WidgetItem['nudges'], isActive: r.isActive, createdAt: r.createdAt.toISOString() };
  }

  async listWidgets(companyId: string): Promise<WidgetItem[]> {
    return (await db.select().from(widgets).where(and(eq(widgets.companyId, companyId), isNull(widgets.deletedAt))).orderBy(desc(widgets.createdAt))).map(r => this.toWidget(r));
  }

  private cleanDomains(list: string[]): string[] {
    return [...new Set(list.map(d => d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')).filter(Boolean))].map(d => {
      if (!/^[a-z0-9.-]+\.[a-z]{2,}$|^localhost$/.test(d)) throw badRequest('DOMAIN_INVALID', `"${d}" is not a valid domain.`);
      return d;
    });
  }

  async createWidget(companyId: string, input: CreateWidgetInput): Promise<WidgetItem> {
    await this.assertBot(companyId, input.chatbotId);
    const [r] = await db
      .insert(widgets)
      .values({ companyId, name: input.name, chatbotId: input.chatbotId ?? null, allowedDomains: this.cleanDomains(input.allowedDomains), styling: input.styling, sections: input.sections, nudges: input.nudges })
      .returning();
    return this.toWidget(r!);
  }

  async updateWidget(companyId: string, id: string, input: UpdateWidgetInput): Promise<WidgetItem> {
    const [cur] = await db.select().from(widgets).where(and(eq(widgets.id, id), eq(widgets.companyId, companyId), isNull(widgets.deletedAt)));
    if (!cur) throw notFound('Widget');
    await this.assertBot(companyId, input.chatbotId);
    const { allowedDomains, ...rest } = input;
    const [r] = await db
      .update(widgets)
      .set({ ...rest, ...(allowedDomains ? { allowedDomains: this.cleanDomains(allowedDomains) } : {}), updatedAt: new Date() })
      .where(eq(widgets.id, id))
      .returning();
    return this.toWidget(r!);
  }

  async removeWidget(companyId: string, id: string): Promise<void> {
    const [cur] = await db.select({ id: widgets.id }).from(widgets).where(and(eq(widgets.id, id), eq(widgets.companyId, companyId), isNull(widgets.deletedAt)));
    if (!cur) throw notFound('Widget');
    await db.update(widgets).set({ deletedAt: new Date(), isActive: false }).where(eq(widgets.id, id));
  }

  /** Public widget configuration, only for allowed origins. */
  async publicWidget(id: string, origin: string | undefined) {
    const [w] = await db
      .select({ w: widgets, publicKey: chatbots.publicKey })
      .from(widgets)
      .leftJoin(chatbots, eq(chatbots.id, widgets.chatbotId))
      .where(and(eq(widgets.id, id), isNull(widgets.deletedAt), eq(widgets.isActive, true)));
    if (!w) throw notFound('Widget');
    if (w.w.allowedDomains.length > 0) {
      let host = '';
      try {
        host = new URL(origin ?? '').hostname.toLowerCase();
      } catch {
        /* no or malformed origin */
      }
      const allowed = w.w.allowedDomains.some(d => host === d || host.endsWith(`.${d}`));
      if (!allowed) throw new ApiError(403, 'WIDGET_ORIGIN_FORBIDDEN', 'This widget is not enabled for this website.');
    }
    return { id: w.w.id, publicKey: w.publicKey, styling: w.w.styling, sections: w.w.sections, nudges: w.w.nudges };
  }
}

export const channelsService = new ChannelsService();
