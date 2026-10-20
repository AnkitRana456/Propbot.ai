import crypto from 'node:crypto';
import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import {
  CREDIT_PACKS,
  INR_PER_USD,
  SUBSCRIPTION_PLANS,
  type AutoTopupInput,
  type BillingProfileInput,
  type BillingProfileItem,
  type CreatePaymentLinkInput,
  type CreditAccountItem,
  type CreditTransactionItem,
  type PaymentOrderItem,
  type RefundOrderInput,
} from '@propbot/shared';
import { db } from '../../db/index.js';
import {
  companies,
  companyBillingProfiles,
  contacts,
  domainEvents,
  leadActivities,
  leads,
  paymentEvents,
  paymentOrders,
  paymentRefunds,
  projects,
  subscriptions,
  units,
  usageCreditAccounts,
  usageCreditTransactions,
} from '../../db/schema/index.js';
import { ApiError, badRequest, conflict, notFound } from '../../utils/api-error.js';
import { stripeConfigured, stripeRequest } from './stripe-api.js';

const appUrl = () => process.env.APP_BASE_URL ?? process.env.WEB_APP_URL ?? 'http://localhost:5173';
const inrToMinor = (inr: number) => inr * 100;
const isProd = () => process.env.NODE_ENV === 'production';
const num = (v: string | number | null | undefined) => Number(v ?? 0);
const isUnique = (e: unknown) => /duplicate key|unique/i.test(String((e as Error)?.message ?? '') + String((e as { cause?: Error })?.cause?.message ?? ''));
export const CALL_MINUTE_CREDITS = 3;
const GRACE_DAYS = 7;

type OrderRow = typeof paymentOrders.$inferSelect;

class PaymentsService {
  // ---------------------------------------------------------------- billing profile (GST)
  async getProfile(companyId: string): Promise<BillingProfileItem> {
    const [p] = await db.select().from(companyBillingProfiles).where(eq(companyBillingProfiles.companyId, companyId));
    return { legalName: p?.legalName ?? null, gstin: p?.gstin ?? null, pan: p?.pan ?? null, stateCode: p?.stateCode ?? null, address: p?.address ?? {}, billingEmail: p?.billingEmail ?? null };
  }

  async setProfile(companyId: string, input: BillingProfileInput): Promise<BillingProfileItem> {
    const gstin = input.gstin || null;
    let stateCode = input.stateCode || null;
    if (gstin) {
      const fromGstin = gstin.slice(0, 2);
      if (stateCode && stateCode !== fromGstin) throw badRequest('GST_STATE_MISMATCH', `The GSTIN starts with state code ${fromGstin}, but you entered ${stateCode}.`);
      stateCode = fromGstin;
      if (input.pan && gstin.slice(2, 12) !== input.pan) throw badRequest('GST_PAN_MISMATCH', 'The PAN does not match the one inside the GSTIN.');
    }
    const values = { legalName: input.legalName, gstin, pan: input.pan || null, stateCode, address: input.address, billingEmail: input.billingEmail || null, updatedAt: new Date() };
    await db.insert(companyBillingProfiles).values({ companyId, ...values }).onConflictDoUpdate({ target: companyBillingProfiles.companyId, set: values });
    return this.getProfile(companyId);
  }

  // ---------------------------------------------------------------- orders
  private async toItem(o: OrderRow): Promise<PaymentOrderItem> {
    const [refunded] = await db
      .select({ n: sql<number>`coalesce(sum(${paymentRefunds.amountMinor}), 0)::bigint` })
      .from(paymentRefunds)
      .where(and(eq(paymentRefunds.orderId, o.id), inArray(paymentRefunds.status, ['processed', 'pending'])));
    const lead = o.leadId ? (await db.select({ f: contacts.firstName, l: contacts.lastName }).from(leads).innerJoin(contacts, eq(contacts.id, leads.contactId)).where(eq(leads.id, o.leadId)))[0] : undefined;
    const project = o.projectId ? (await db.select({ n: projects.name }).from(projects).where(eq(projects.id, o.projectId)))[0] : undefined;
    const unit = o.unitId ? (await db.select({ n: units.unitNumber }).from(units).where(eq(units.id, o.unitId)))[0] : undefined;
    return {
      id: o.id,
      kind: o.kind as PaymentOrderItem['kind'],
      leadId: o.leadId,
      leadName: lead ? `${lead.f} ${lead.l ?? ''}`.trim() : null,
      projectName: project?.n ?? null,
      unitNumber: unit?.n ?? null,
      amountMinor: o.amountMinor,
      refundedMinor: Number(refunded?.n ?? 0),
      currency: o.currency,
      provider: o.provider,
      status: o.status as PaymentOrderItem['status'],
      paymentLinkUrl: o.paymentLinkUrl,
      receiptNo: o.receiptNo,
      expiresAt: o.expiresAt?.toISOString() ?? null,
      paidAt: o.paidAt?.toISOString() ?? null,
      createdAt: o.createdAt.toISOString(),
    };
  }

  private async mustOrder(companyId: string, id: string): Promise<OrderRow> {
    const [o] = await db.select().from(paymentOrders).where(and(eq(paymentOrders.id, id), eq(paymentOrders.companyId, companyId)));
    if (!o) throw notFound('Payment');
    return o;
  }

  async list(companyId: string, kind?: string): Promise<PaymentOrderItem[]> {
    const rows = await db.select().from(paymentOrders).where(and(eq(paymentOrders.companyId, companyId), kind ? eq(paymentOrders.kind, kind) : undefined)).orderBy(desc(paymentOrders.createdAt)).limit(100);
    return Promise.all(rows.map(o => this.toItem(o)));
  }

  async get(companyId: string, id: string) {
    return this.toItem(await this.mustOrder(companyId, id));
  }

  /** Creates the hosted checkout (Stripe) or, in development without keys, a local simulated link. */
  private async openCheckout(order: { id: string; companyId: string; kind: string; amountMinor: number; title: string; expiresAt: Date; customerEmail?: string | null }) {
    if (stripeConfigured()) {
      const s = await stripeRequest<{ id: string; url: string }>(
        'POST',
        '/checkout/sessions',
        {
          mode: 'payment',
          'line_items[0][quantity]': 1,
          'line_items[0][price_data][currency]': 'inr',
          'line_items[0][price_data][unit_amount]': order.amountMinor,
          'line_items[0][price_data][product_data][name]': order.title,
          'metadata[orderId]': order.id,
          'metadata[companyId]': order.companyId,
          'metadata[kind]': order.kind,
          'payment_intent_data[metadata][orderId]': order.id,
          'payment_intent_data[metadata][companyId]': order.companyId,
          client_reference_id: order.id,
          customer_email: order.customerEmail ?? undefined,
          expires_at: Math.floor(order.expiresAt.getTime() / 1000),
          success_url: `${appUrl()}/billing?paid=${order.id}`,
          cancel_url: `${appUrl()}/billing?cancelled=${order.id}`,
        },
        `order_${order.id}`,
      );
      return { provider: 'stripe', providerOrderId: s.id, url: s.url };
    }
    if (isProd()) throw new ApiError(503, 'PAYMENTS_NOT_CONFIGURED', 'Online payments are not configured yet.');
    return { provider: 'manual', providerOrderId: `sim_${order.id}`, url: `${appUrl()}/pay/simulated/${order.id}` };
  }

  /** Booking-token payment link for a lead (and optionally a unit). */
  async createPaymentLink(companyId: string, userId: string | null, input: CreatePaymentLinkInput): Promise<PaymentOrderItem> {
    const [lead] = await db.select({ id: leads.id, contactId: leads.contactId, email: contacts.email }).from(leads).innerJoin(contacts, eq(contacts.id, leads.contactId)).where(and(eq(leads.id, input.leadId), eq(leads.companyId, companyId)));
    if (!lead) throw badRequest('LEAD_INVALID', 'That lead does not exist.');

    let projectId = input.projectId ?? null;
    let title = 'Booking token';
    if (input.unitId) {
      const [u] = await db.select({ id: units.id, projectId: units.projectId, status: units.status, no: units.unitNumber }).from(units).where(and(eq(units.id, input.unitId), eq(units.companyId, companyId)));
      if (!u) throw badRequest('UNIT_INVALID', 'That unit does not exist.');
      if (u.status !== 'available') throw conflict('UNIT_NOT_AVAILABLE', `Unit ${u.no} is ${u.status} and cannot take a booking token.`);
      if (projectId && projectId !== u.projectId) throw badRequest('UNIT_PROJECT_MISMATCH', 'That unit belongs to a different project.');
      projectId = u.projectId;
      title = `Booking token for unit ${u.no}`;
    }
    if (projectId) {
      const [p] = await db.select({ id: projects.id, name: projects.name }).from(projects).where(and(eq(projects.id, projectId), eq(projects.companyId, companyId)));
      if (!p) throw badRequest('PROJECT_INVALID', 'That project does not exist.');
      title += ` · ${p.name}`;
    }
    const [dup] = await db.select({ id: paymentOrders.id }).from(paymentOrders).where(and(eq(paymentOrders.companyId, companyId), eq(paymentOrders.kind, 'booking_token'), eq(paymentOrders.leadId, input.leadId), input.unitId ? eq(paymentOrders.unitId, input.unitId) : sql`true`, inArray(paymentOrders.status, ['created', 'pending', 'paid']), sql`(${paymentOrders.expiresAt} IS NULL OR ${paymentOrders.expiresAt} > now() OR ${paymentOrders.status} = 'paid')`)).limit(1);
    if (dup) throw conflict('PAYMENT_EXISTS', 'There is already an open or paid booking token for this lead and unit.');

    const id = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + input.expiresInHours * 3_600_000);
    const amountMinor = inrToMinor(input.amountInr);
    const co = await this.openCheckout({ id, companyId, kind: 'booking_token', amountMinor, title, expiresAt, customerEmail: lead.email });
    const [o] = await db
      .insert(paymentOrders)
      .values({ id, companyId, kind: 'booking_token', leadId: input.leadId, contactId: lead.contactId, projectId, unitId: input.unitId ?? null, amountMinor, provider: co.provider, providerOrderId: co.providerOrderId, paymentLinkUrl: co.url, status: 'pending', metadata: { note: input.note ?? null, createdBy: userId }, expiresAt })
      .returning();
    await db.insert(leadActivities).values({ companyId, leadId: input.leadId, contactId: lead.contactId, activityType: 'payment', title: `Payment link sent: Rs ${input.amountInr.toLocaleString('en-IN')}`, description: title, metadata: { orderId: id } });
    return this.toItem(o!);
  }

  /** Next receipt number for the company and year, e.g. RCPT-2026-0007. Unique per company by index. */
  private async nextReceiptNo(companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(paymentOrders).where(and(eq(paymentOrders.companyId, companyId), sql`${paymentOrders.receiptNo} LIKE ${`RCPT-${year}-%`}`));
    return `RCPT-${year}-${String((r?.n ?? 0) + 1).padStart(4, '0')}`;
  }

  /**
   * Marks an order paid exactly once. The amount reported by the provider must equal the order amount:
   * a mismatch is recorded and never credited.
   */
  async markPaid(orderId: string, info: { providerPaymentId?: string | null; amountMinor?: number | null; currency?: string | null }): Promise<{ applied: boolean; reason?: string }> {
    const [o] = await db.select().from(paymentOrders).where(eq(paymentOrders.id, orderId));
    if (!o) return { applied: false, reason: 'unknown order' };
    if (o.status === 'paid' || o.status === 'refunded' || o.status === 'partially_refunded') return { applied: false, reason: 'already paid' };
    if (info.amountMinor != null && (info.amountMinor !== o.amountMinor || (info.currency && info.currency.toUpperCase() !== o.currency))) {
      await db.update(paymentOrders).set({ status: 'failed', metadata: { ...o.metadata, mismatch: { expected: o.amountMinor, received: info.amountMinor } }, updatedAt: new Date() }).where(eq(paymentOrders.id, orderId));
      return { applied: false, reason: 'amount mismatch' };
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const receiptNo = await this.nextReceiptNo(o.companyId);
        const claimed = await db
          .update(paymentOrders)
          .set({ status: 'paid', paidAt: new Date(), providerPaymentId: info.providerPaymentId ?? o.providerPaymentId, receiptNo, updatedAt: new Date() })
          .where(and(eq(paymentOrders.id, orderId), inArray(paymentOrders.status, ['created', 'pending', 'failed', 'expired'])))
          .returning({ id: paymentOrders.id });
        if (claimed.length === 0) return { applied: false, reason: 'already paid' };
        break;
      } catch (e) {
        if (!isUnique(e) || attempt === 2) throw e;
      }
    }
    if (o.kind === 'credit_topup') {
      const credits = Number((o.metadata as { credits?: number }).credits ?? 0);
      if (credits > 0) await this.grantCredits(o.companyId, credits, 'topup', o.id);
    }
    if (o.kind === 'booking_token' && o.leadId) {
      await db.insert(domainEvents).values({ companyId: o.companyId, type: 'payment_received', payload: { lead_id: o.leadId, order_id: o.id, amount_minor: o.amountMinor, unit_id: o.unitId, summary: `Booking token of Rs ${(o.amountMinor / 100).toLocaleString('en-IN')} received` } });
      if (o.contactId) await db.insert(leadActivities).values({ companyId: o.companyId, leadId: o.leadId, contactId: o.contactId, activityType: 'payment', title: 'Booking token received', description: `Rs ${(o.amountMinor / 100).toLocaleString('en-IN')}`, metadata: { orderId: o.id } });
    }
    return { applied: true };
  }

  /** Development only: pays a simulated (keyless) order so the full flow can be tried locally. */
  async simulatePaid(companyId: string, id: string) {
    if (isProd()) throw new ApiError(403, 'FORBIDDEN', 'Simulated payments are disabled in production.');
    const o = await this.mustOrder(companyId, id);
    if (o.provider !== 'manual') throw badRequest('NOT_SIMULATED', 'Only simulated orders can be paid this way.');
    await this.markPaid(id, { providerPaymentId: `sim_pay_${id}`, amountMinor: o.amountMinor, currency: o.currency });
    return this.get(companyId, id);
  }

  async cancel(companyId: string, id: string) {
    const o = await this.mustOrder(companyId, id);
    if (!['created', 'pending'].includes(o.status)) throw conflict('PAYMENT_NOT_OPEN', `This payment is ${o.status}.`);
    if (o.provider === 'stripe' && o.providerOrderId && stripeConfigured()) await stripeRequest('POST', `/checkout/sessions/${o.providerOrderId}/expire`).catch(() => undefined);
    await db.update(paymentOrders).set({ status: 'expired', updatedAt: new Date() }).where(eq(paymentOrders.id, id));
    return this.get(companyId, id);
  }

  /** Worker sweep: links past their expiry stop being payable. */
  async expireStale(): Promise<number> {
    const res = await db.update(paymentOrders).set({ status: 'expired', updatedAt: new Date() }).where(and(inArray(paymentOrders.status, ['created', 'pending']), lt(paymentOrders.expiresAt, new Date()))).returning({ id: paymentOrders.id });
    return res.length;
  }

  // ---------------------------------------------------------------- refunds
  async refund(companyId: string, userId: string | null, id: string, input: RefundOrderInput) {
    const result = await db.transaction(async tx => {
      const locked = (await tx.execute(sql`SELECT * FROM payment_orders WHERE id = ${id} AND company_id = ${companyId} FOR UPDATE`)) as unknown as Array<Record<string, unknown>> | { rows?: Array<Record<string, unknown>> };
      const row = (Array.isArray(locked) ? locked : (locked.rows ?? []))[0];
      if (!row) throw notFound('Payment');
      const o = await tx.select().from(paymentOrders).where(eq(paymentOrders.id, id)).then(r => r[0]!);
      if (o.kind !== 'booking_token') throw badRequest('REFUND_KIND', 'Only booking tokens can be refunded here.');
      if (!['paid', 'partially_refunded'].includes(o.status)) throw conflict('REFUND_NOT_PAID', `A ${o.status} payment cannot be refunded.`);
      const [done] = await tx.select({ n: sql<number>`coalesce(sum(${paymentRefunds.amountMinor}), 0)::bigint` }).from(paymentRefunds).where(and(eq(paymentRefunds.orderId, id), inArray(paymentRefunds.status, ['processed', 'pending'])));
      const remaining = o.amountMinor - Number(done?.n ?? 0);
      const amountMinor = input.amountInr ? inrToMinor(input.amountInr) : remaining;
      if (amountMinor <= 0 || amountMinor > remaining) throw badRequest('REFUND_AMOUNT', `You can refund at most Rs ${(remaining / 100).toLocaleString('en-IN')}.`);
      const [r] = await tx.insert(paymentRefunds).values({ companyId, orderId: id, amountMinor, reason: input.reason, requestedBy: userId }).returning();
      return { order: o, refund: r!, remaining: remaining - amountMinor };
    });

    let providerRefundId: string | null = null;
    let status: 'processed' | 'failed' = 'processed';
    try {
      if (result.order.provider === 'stripe' && result.order.providerPaymentId) {
        const out = await stripeRequest<{ id: string }>('POST', '/refunds', { payment_intent: result.order.providerPaymentId, amount: result.refund.amountMinor, 'metadata[orderId]': id, 'metadata[reason]': input.reason.slice(0, 200) }, `refund_${result.refund.id}`);
        providerRefundId = out.id;
      } else {
        providerRefundId = `sim_refund_${result.refund.id}`;
      }
    } catch (e) {
      status = 'failed';
      await db.update(paymentRefunds).set({ status }).where(eq(paymentRefunds.id, result.refund.id));
      throw e;
    }
    await db.update(paymentRefunds).set({ status, providerRefundId }).where(eq(paymentRefunds.id, result.refund.id));
    await db.update(paymentOrders).set({ status: result.remaining === 0 ? 'refunded' : 'partially_refunded', updatedAt: new Date() }).where(eq(paymentOrders.id, id));
    return this.get(companyId, id);
  }

  // ---------------------------------------------------------------- receipt
  async receiptHtml(companyId: string, id: string): Promise<string> {
    const o = await this.mustOrder(companyId, id);
    if (!o.receiptNo || !o.paidAt) throw conflict('RECEIPT_NOT_AVAILABLE', 'A receipt exists only for paid payments.');
    const [company] = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, companyId));
    const profile = await this.getProfile(companyId);
    const buyer = o.contactId ? (await db.select({ f: contacts.firstName, l: contacts.lastName, p: contacts.phone, e: contacts.email }).from(contacts).where(eq(contacts.id, o.contactId)))[0] : undefined;
    const project = o.projectId ? (await db.select({ n: projects.name, rera: projects.reraNo, loc: projects.location }).from(projects).where(eq(projects.id, o.projectId)))[0] : undefined;
    const unit = o.unitId ? (await db.select({ n: units.unitNumber, t: units.tower, b: units.bhk }).from(units).where(eq(units.id, o.unitId)))[0] : undefined;
    const refunds = await db.select().from(paymentRefunds).where(and(eq(paymentRefunds.orderId, id), eq(paymentRefunds.status, 'processed')));
    const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
    const inr = (m: number) => `Rs ${(m / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    const rows: Array<[string, string]> = [
      ['Receipt no.', o.receiptNo],
      ['Date', o.paidAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })],
      ['Received from', buyer ? `${buyer.f} ${buyer.l ?? ''}`.trim() : '-'],
      ['Project', project ? `${project.n}${project.loc ? `, ${project.loc}` : ''}` : '-'],
      ['RERA registration', project?.rera ?? 'Not provided'],
      ['Unit', unit ? `${unit.n}${unit.t ? `, Tower ${unit.t}` : ''}, ${unit.b} BHK` : '-'],
      ['Amount received', inr(o.amountMinor)],
      ['Towards', 'Booking token (advance). Adjustable against the sale consideration. GST is charged separately as per the applicable law.'],
      ['Payment reference', o.providerPaymentId ?? '-'],
      ...refunds.map((r): [string, string] => [`Refunded ${r.createdAt.toLocaleDateString('en-IN')}`, `${inr(r.amountMinor)}${r.reason ? ` (${r.reason})` : ''}`]),
    ];
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Receipt ${esc(o.receiptNo)}</title><style>body{font-family:system-ui,sans-serif;max-width:640px;margin:32px auto;padding:0 16px;color:#0f172a}h1{font-size:20px;margin:0}table{width:100%;border-collapse:collapse;margin-top:16px}td{padding:8px 4px;border-bottom:1px solid #e2e8f0;vertical-align:top;font-size:14px}td:first-child{color:#64748b;width:38%}.muted{color:#64748b;font-size:12px;margin-top:16px}</style></head><body><h1>${esc(profile.legalName ?? company?.name ?? 'Receipt')}</h1><p class="muted">${esc(profile.gstin ? `GSTIN ${profile.gstin}` : '')}</p><h2 style="font-size:16px">Payment receipt</h2><table>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table><p class="muted">This is a computer-generated receipt and does not require a signature.</p></body></html>`;
  }

  // ---------------------------------------------------------------- credits
  private async account(companyId: string) {
    await db.insert(usageCreditAccounts).values({ companyId }).onConflictDoNothing();
    return (await db.select().from(usageCreditAccounts).where(eq(usageCreditAccounts.companyId, companyId)))[0]!;
  }

  async getCredits(companyId: string): Promise<CreditAccountItem> {
    const a = await this.account(companyId);
    const auto = { enabled: false, threshold: 200, packId: 'pack_1000', ...(a.autoTopup as Record<string, unknown>) } as CreditAccountItem['autoTopup'];
    return { balance: num(a.balance), autoTopup: auto, lowBalance: num(a.balance) <= auto.threshold };
  }

  async setAutoTopup(companyId: string, input: AutoTopupInput) {
    await this.account(companyId);
    await db.update(usageCreditAccounts).set({ autoTopup: input, updatedAt: new Date() }).where(eq(usageCreditAccounts.companyId, companyId));
    return this.getCredits(companyId);
  }

  async creditHistory(companyId: string): Promise<CreditTransactionItem[]> {
    const rows = await db.select().from(usageCreditTransactions).where(eq(usageCreditTransactions.companyId, companyId)).orderBy(desc(usageCreditTransactions.createdAt)).limit(100);
    return rows.map(r => ({ id: r.id, delta: num(r.delta), reason: r.reason, balanceAfter: r.balanceAfter === null ? null : num(r.balanceAfter), createdAt: r.createdAt.toISOString() }));
  }

  async grantCredits(companyId: string, credits: number, reason: 'topup' | 'grant' | 'refund' | 'adjustment', orderId?: string): Promise<number> {
    await this.account(companyId);
    const [a] = await db.update(usageCreditAccounts).set({ balance: sql`${usageCreditAccounts.balance} + ${credits}`, updatedAt: new Date() }).where(eq(usageCreditAccounts.companyId, companyId)).returning();
    await db.insert(usageCreditTransactions).values({ companyId, delta: String(credits), reason, paymentOrderId: orderId ?? null, balanceAfter: a!.balance });
    return num(a!.balance);
  }

  /**
   * Charges usage against prepaid credits. Only companies that have a credit account are metered; the balance
   * never goes below zero (usage is never blocked mid-conversation), and crossing the low-balance line raises one event.
   */
  async consume(companyId: string, credits: number, ledgerId?: string): Promise<void> {
    if (!(credits > 0)) return;
    const [acct] = await db.select().from(usageCreditAccounts).where(eq(usageCreditAccounts.companyId, companyId));
    if (!acct) return;
    const before = num(acct.balance);
    const [a] = await db.update(usageCreditAccounts).set({ balance: sql`greatest(${usageCreditAccounts.balance} - ${credits}, 0)`, updatedAt: new Date() }).where(eq(usageCreditAccounts.companyId, companyId)).returning();
    const after = num(a!.balance);
    await db.insert(usageCreditTransactions).values({ companyId, delta: String(-(before - after)), reason: 'usage', usageLedgerId: ledgerId ?? null, balanceAfter: a!.balance });
    const threshold = Number((acct.autoTopup as { threshold?: number }).threshold ?? 200);
    if (before > threshold && after <= threshold) {
      await db.insert(domainEvents).values({ companyId, type: 'credits_low', payload: { balance: after, threshold, summary: `Prepaid credits are down to ${Math.round(after)}. Top up to keep AI replies and calls running.` } });
    }
  }

  usageCredits(costUsd: number): number {
    return costUsd * INR_PER_USD;
  }

  async createTopup(companyId: string, packId: string): Promise<PaymentOrderItem> {
    const pack = CREDIT_PACKS.find(p => p.id === packId);
    if (!pack) throw badRequest('PACK_INVALID', 'Unknown credit pack.');
    const id = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 3_600_000);
    const amountMinor = inrToMinor(pack.priceInr);
    const co = await this.openCheckout({ id, companyId, kind: 'credit_topup', amountMinor, title: `PropBot credits: ${pack.label}`, expiresAt });
    const [o] = await db.insert(paymentOrders).values({ id, companyId, kind: 'credit_topup', amountMinor, provider: co.provider, providerOrderId: co.providerOrderId, paymentLinkUrl: co.url, status: 'pending', metadata: { packId: pack.id, credits: pack.credits }, expiresAt }).returning();
    return this.toItem(o!);
  }

  // ---------------------------------------------------------------- provider events
  /** Writes the raw event once. Returns false when this event id was already seen (redelivery). */
  async recordEvent(provider: string, eventId: string, type: string, payload: unknown, companyId?: string | null): Promise<boolean> {
    const res = await db.insert(paymentEvents).values({ provider, eventId, type, payload, companyId: companyId ?? null }).onConflictDoNothing().returning({ id: paymentEvents.id });
    return res.length > 0;
  }

  async forgetEvent(provider: string, eventId: string) {
    await db.delete(paymentEvents).where(and(eq(paymentEvents.provider, provider), eq(paymentEvents.eventId, eventId), sql`${paymentEvents.processedAt} IS NULL`));
  }

  async finishEvent(provider: string, eventId: string, error?: string) {
    await db.update(paymentEvents).set({ processedAt: error ? null : new Date(), error: error ?? null }).where(and(eq(paymentEvents.provider, provider), eq(paymentEvents.eventId, eventId)));
  }

  /** Payment-mode checkout events (booking tokens, credit top-ups). Returns true when the event was for an order. */
  async handleStripeOrderEvent(evt: { type?: string; data?: { object?: Record<string, unknown> } }): Promise<boolean> {
    const obj = evt.data?.object ?? {};
    const meta = (obj.metadata ?? {}) as Record<string, string>;
    const orderId = meta.orderId ?? (typeof obj.client_reference_id === 'string' ? obj.client_reference_id : undefined);
    if (!orderId || !['booking_token', 'credit_topup'].includes(meta.kind ?? '')) return false;
    if (evt.type === 'checkout.session.completed' || evt.type === 'checkout.session.async_payment_succeeded') {
      if (obj.payment_status && obj.payment_status !== 'paid') return true; // delayed methods confirm later
      await this.markPaid(orderId, { providerPaymentId: typeof obj.payment_intent === 'string' ? obj.payment_intent : null, amountMinor: typeof obj.amount_total === 'number' ? obj.amount_total : null, currency: typeof obj.currency === 'string' ? obj.currency : null });
    } else if (evt.type === 'checkout.session.expired') {
      await db.update(paymentOrders).set({ status: 'expired', updatedAt: new Date() }).where(and(eq(paymentOrders.id, orderId), inArray(paymentOrders.status, ['created', 'pending'])));
    } else if (evt.type === 'checkout.session.async_payment_failed') {
      await db.update(paymentOrders).set({ status: 'failed', updatedAt: new Date() }).where(and(eq(paymentOrders.id, orderId), inArray(paymentOrders.status, ['created', 'pending'])));
    }
    return true;
  }

  async rememberStripeSubscription(companyId: string, subscriptionId: string): Promise<void> {
    const [c] = await db.select({ settings: companies.settings }).from(companies).where(eq(companies.id, companyId));
    const billing = { ...(((c?.settings as { billing?: Record<string, unknown> } | null)?.billing) ?? {}), stripeSubscriptionId: subscriptionId };
    await db.update(companies).set({ settings: { ...((c?.settings as Record<string, unknown> | null) ?? {}), billing } }).where(eq(companies.id, companyId));
  }

  async stripeSubscriptionOf(companyId: string): Promise<string | null> {
    const [c] = await db.select({ settings: companies.settings }).from(companies).where(eq(companies.id, companyId));
    return ((c?.settings as { billing?: { stripeSubscriptionId?: string } } | null)?.billing?.stripeSubscriptionId) ?? null;
  }

  // ---------------------------------------------------------------- dunning
  async markPastDue(companyId: string): Promise<void> {
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.companyId, companyId));
    if (!sub || sub.status === 'past_due' || sub.status === 'canceled') return;
    await db.update(subscriptions).set({ status: 'past_due', updatedAt: new Date() }).where(eq(subscriptions.id, sub.id));
    const [c] = await db.select({ settings: companies.settings }).from(companies).where(eq(companies.id, companyId));
    const settings = { ...((c?.settings as Record<string, unknown> | null) ?? {}), billing: { ...(((c?.settings as { billing?: Record<string, unknown> } | null)?.billing) ?? {}), pastDueSince: new Date().toISOString() } };
    await db.update(companies).set({ settings }).where(eq(companies.id, companyId));
    await db.insert(domainEvents).values({ companyId, type: 'payment_failed', payload: { summary: `Your subscription payment failed. Update your payment method within ${GRACE_DAYS} days to keep your plan.` } });
  }

  async clearPastDue(companyId: string): Promise<void> {
    const [c] = await db.select({ settings: companies.settings }).from(companies).where(eq(companies.id, companyId));
    const billing = { ...(((c?.settings as { billing?: Record<string, unknown> } | null)?.billing) ?? {}) };
    if (!billing.pastDueSince) return;
    delete billing.pastDueSince;
    await db.update(companies).set({ settings: { ...((c?.settings as Record<string, unknown> | null) ?? {}), billing } }).where(eq(companies.id, companyId));
  }

  /** Worker sweep: after the grace period an unpaid subscription falls back to the trial limits. */
  async dunningSweep(now = new Date()): Promise<number> {
    const due = await db.select({ companyId: subscriptions.companyId, id: subscriptions.id, settings: companies.settings }).from(subscriptions).innerJoin(companies, eq(companies.id, subscriptions.companyId)).where(eq(subscriptions.status, 'past_due'));
    let n = 0;
    for (const s of due) {
      const since = (s.settings as { billing?: { pastDueSince?: string } } | null)?.billing?.pastDueSince;
      if (!since || now.getTime() - new Date(since).getTime() < GRACE_DAYS * 86_400_000) continue;
      const trial = SUBSCRIPTION_PLANS.trial!;
      await db.update(subscriptions).set({ plan: 'trial', status: 'active', limits: trial.limits as never, updatedAt: now }).where(eq(subscriptions.id, s.id));
      await db.update(companies).set({ plan: 'trial', updatedAt: now }).where(eq(companies.id, s.companyId));
      await this.clearPastDue(s.companyId);
      await db.insert(domainEvents).values({ companyId: s.companyId, type: 'subscription_downgraded', payload: { summary: 'Your plan was moved to the free trial because the payment was not completed.' } });
      n++;
    }
    return n;
  }
}

export const paymentsService = new PaymentsService();
