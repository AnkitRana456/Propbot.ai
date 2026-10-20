import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import request from 'supertest';
import { eq, and, like } from 'drizzle-orm';
import { SUBSCRIPTION_PLANS } from '@propbot/shared';
import { createApp } from '../../src/server.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { createAuthenticatedUser } from '../helpers/test-fixtures.js';
import {
  companies,
  contacts,
  domainEvents,
  leads,
  paymentEvents,
  paymentOrders,
  paymentRefunds,
  subscriptionInvoices,
  subscriptions,
  units,
  usageCreditAccounts,
  usageCreditTransactions,
} from '../../src/db/schema/index.js';
import { inventoryService } from '../../src/modules/inventory/inventory.service.js';
import { computeGst } from '../../src/modules/payments/gst.js';
import { paymentsService } from '../../src/modules/payments/payments.service.js';
import { recordLlmCall } from '../../src/modules/ai/llm-call-log.js';
import { billingService } from '../../src/modules/billing/billing.service.js';

const RUN = crypto.randomBytes(4).toString('hex'); // provider event ids are global, so every run needs its own
const WH_SECRET = 'whsec_test_secret';
const GSTIN = '29ABCDE1234F1Z5';

const signed = (body: object, secret = WH_SECRET) => {
  const raw = JSON.stringify(body);
  const t = Math.floor(Date.now() / 1000);
  const v1 = crypto.createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  return { raw, header: `t=${t},v1=${v1}` };
};
const waitFor = async <T,>(fn: () => Promise<T | undefined | false>, ms = 3000): Promise<T> => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v as T;
    if (Date.now() > end) throw new Error('waitFor timed out');
    await new Promise(r => setTimeout(r, 40));
  }
};

describe('P8: payments, billing and credits', () => {
  const app = createApp();
  let a: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let b: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let agent: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let leadId = '';
  let projectId = '';
  let unitId = '';
  const api = (method: 'get' | 'post' | 'put' | 'delete', url: string, who = a) => request(app)[method](url).set('Authorization', who.authHeader);

  async function makeLead(first: string, phone: string) {
    const [c] = await testDb.insert(contacts).values({ companyId: a.company.id, firstName: first, lastName: 'Buyer', phone, email: `${first.toLowerCase()}@example.com` }).returning();
    const [l] = await testDb.insert(leads).values({ companyId: a.company.id, contactId: c!.id }).returning();
    return l!.id;
  }
  async function makeUnit(no: string, status = 'available') {
    const [u] = await testDb.insert(units).values({ companyId: a.company.id, projectId, unitNumber: no, bhk: 3, carpetAreaSqft: '1100', price: '9000000', status }).returning();
    return u!.id;
  }

  beforeAll(async () => {
    a = await createAuthenticatedUser('company_admin');
    b = await createAuthenticatedUser('company_admin');
    agent = await createAuthenticatedUser('agent', { id: a.company.id } as never);
    const p = await inventoryService.createProject(a.company.id, { name: 'Lakeside Habitat', builderName: 'ACME', location: 'Whitefield', reraNo: 'PRM/KA/RERA/1251/446/PR/123' } as never);
    projectId = p.id;
    unitId = await makeUnit('B-101');
    leadId = await makeLead('Asha', '+919855500001');
  });
  afterAll(async () => {
    await testDb.delete(paymentEvents).where(like(paymentEvents.eventId, `%_${RUN}`));
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    await cleanupTestDatabase([a.company.id, b.company.id]);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  describe('GST', () => {
    it('splits an inclusive price exactly: CGST+SGST in the seller state, IGST elsewhere', () => {
      const intra = computeGst(299_900, '29', '29');
      expect(intra).toMatchObject({ kind: 'intra_state', igstMinor: 0 });
      expect(intra.taxableMinor + intra.totalTaxMinor).toBe(299_900);
      expect(intra.cgstMinor + intra.sgstMinor).toBe(intra.totalTaxMinor);
      expect(Math.abs(intra.cgstMinor - intra.sgstMinor)).toBeLessThanOrEqual(1);
      const inter = computeGst(299_900, '27', '29');
      expect(inter).toMatchObject({ kind: 'inter_state', cgstMinor: 0, sgstMinor: 0 });
      expect(inter.igstMinor).toBe(inter.totalTaxMinor);
      expect(computeGst(118_00, null, '29').kind).toBe('inter_state');
      expect(computeGst(11_800, '29', '29').totalTaxMinor).toBe(1_800);
    });
    it('validates the billing profile and keeps GSTIN, PAN and state consistent', async () => {
      expect((await api('put', '/api/payments/profile').send({ legalName: 'ACME Realty Pvt Ltd', gstin: 'NOT-A-GSTIN' })).status).toBe(400);
      expect((await api('put', '/api/payments/profile').send({ legalName: 'ACME', gstin: GSTIN, stateCode: '27' })).status).toBe(400);
      expect((await api('put', '/api/payments/profile').send({ legalName: 'ACME', gstin: GSTIN, pan: 'ZZZZZ9999Z' })).status).toBe(400);
      const ok = await api('put', '/api/payments/profile').send({ legalName: 'ACME Realty Pvt Ltd', gstin: GSTIN, pan: 'ABCDE1234F', billingEmail: 'accounts@acme.test', address: { city: 'Bengaluru' } });
      expect(ok.status, JSON.stringify(ok.body)).toBe(200);
      expect(ok.body.data).toMatchObject({ gstin: GSTIN, stateCode: '29' });
      expect((await api('get', '/api/payments/profile', b)).body.data.gstin).toBeNull();
      expect((await api('get', '/api/payments/profile', agent)).status).toBe(403);
    });
  });

  describe('booking token payment links', () => {
    let orderId = '';
    it('creates a link for a lead and an available unit, and blocks duplicates and bad references', async () => {
      const res = await api('post', '/api/payments/orders').send({ leadId, unitId, amountInr: 50_000 });
      expect(res.status, JSON.stringify(res.body)).toBe(201);
      orderId = res.body.data.id;
      expect(res.body.data).toMatchObject({ kind: 'booking_token', status: 'pending', amountMinor: 5_000_000, provider: 'manual', unitNumber: 'B-101', projectName: 'Lakeside Habitat' });
      expect(res.body.data.paymentLinkUrl).toContain(orderId);
      expect((await api('post', '/api/payments/orders').send({ leadId, unitId, amountInr: 50_000 })).status).toBe(409);
      expect((await api('post', '/api/payments/orders').send({ leadId, amountInr: 500 })).status).toBe(400);
      expect((await api('post', '/api/payments/orders').send({ leadId: crypto.randomUUID(), amountInr: 5000 })).status).toBe(400);
      const sold = await makeUnit('B-102', 'sold');
      expect((await api('post', '/api/payments/orders').send({ leadId, unitId: sold, amountInr: 5000 })).status).toBe(409);
      expect((await api('post', '/api/payments/orders', b).send({ leadId, amountInr: 5000 })).status).toBe(400);
    });
    it('is tenant isolated and permission checked', async () => {
      expect((await api('get', `/api/payments/orders/${orderId}`, b)).status).toBe(404);
      expect((await api('get', '/api/payments/orders', b)).body.data).toEqual([]);
      expect((await api('post', `/api/payments/orders/${orderId}/refund`, agent).send({ reason: 'nope' })).status).toBe(403);
    });
    it('marks paid once, numbers the receipt, notifies, and renders an escaped RERA receipt', async () => {
      const paid = await api('post', `/api/payments/orders/${orderId}/simulate-paid`);
      expect(paid.body.data).toMatchObject({ status: 'paid' });
      const year = new Date().getFullYear();
      expect(paid.body.data.receiptNo).toBe(`RCPT-${year}-0001`);
      expect((await paymentsService.markPaid(orderId, { amountMinor: 5_000_000, currency: 'INR' })).applied).toBe(false); // redelivery changes nothing
      const events = await testDb.select().from(domainEvents).where(and(eq(domainEvents.companyId, a.company.id), eq(domainEvents.type, 'payment_received')));
      expect(events).toHaveLength(1);

      await testDb.update(contacts).set({ firstName: '<script>alert(1)</script>' }).where(eq(contacts.phone, '+919855500001'));
      const receipt = await api('get', `/api/payments/orders/${orderId}/receipt`);
      expect(receipt.status).toBe(200);
      expect(receipt.headers['content-type']).toContain('text/html');
      expect(receipt.headers['content-security-policy']).toContain("default-src 'none'");
      expect(receipt.text).toContain('RERA registration');
      expect(receipt.text).toContain('PRM/KA/RERA/1251/446/PR/123');
      expect(receipt.text).toContain('50,000.00');
      expect(receipt.text).not.toContain('<script>');
      expect((await api('get', `/api/payments/orders/${orderId}/receipt`, b)).status).toBe(404);
    });
    it('numbers further receipts in sequence and refuses receipts for unpaid links', async () => {
      const lead2 = await makeLead('Ravi', '+919855500002');
      const o2 = (await api('post', '/api/payments/orders').send({ leadId: lead2, amountInr: 25_000 })).body.data;
      expect((await api('get', `/api/payments/orders/${o2.id}/receipt`)).status).toBe(409);
      expect((await api('post', `/api/payments/orders/${o2.id}/simulate-paid`)).body.data.receiptNo).toMatch(/-0002$/);
    });
    it('cancels an open link and rejects cancelling a paid one', async () => {
      const lead3 = await makeLead('Mira', '+919855500003');
      const o = (await api('post', '/api/payments/orders').send({ leadId: lead3, amountInr: 10_000 })).body.data;
      expect((await api('post', `/api/payments/orders/${o.id}/cancel`)).body.data.status).toBe('expired');
      expect((await api('post', `/api/payments/orders/${orderId}/cancel`)).status).toBe(409);
    });
    it('expires stale links in the sweep', async () => {
      const lead4 = await makeLead('Old', '+919855500004');
      const o = (await api('post', '/api/payments/orders').send({ leadId: lead4, amountInr: 10_000 })).body.data;
      await testDb.update(paymentOrders).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(paymentOrders.id, o.id));
      expect(await paymentsService.expireStale()).toBeGreaterThanOrEqual(1);
      expect((await api('get', `/api/payments/orders/${o.id}`)).body.data.status).toBe('expired');
    });
  });

  describe('refunds', () => {
    let orderId = '';
    beforeAll(async () => {
      const lead = await makeLead('Refund', '+919855500010');
      orderId = (await api('post', '/api/payments/orders').send({ leadId: lead, amountInr: 40_000 })).body.data.id;
    });
    it('only refunds paid payments, within what is left', async () => {
      expect((await api('post', `/api/payments/orders/${orderId}/refund`).send({ reason: 'changed mind' })).status).toBe(409);
      await api('post', `/api/payments/orders/${orderId}/simulate-paid`);
      expect((await api('post', `/api/payments/orders/${orderId}/refund`).send({ amountInr: 50_000, reason: 'too much' })).status).toBe(400);
      expect((await api('post', `/api/payments/orders/${orderId}/refund`).send({ amountInr: 10_000 })).status).toBe(400); // reason required
      const part = await api('post', `/api/payments/orders/${orderId}/refund`).send({ amountInr: 15_000, reason: 'Unit withdrawn' });
      expect(part.body.data).toMatchObject({ status: 'partially_refunded', refundedMinor: 1_500_000 });
      const rest = await api('post', `/api/payments/orders/${orderId}/refund`).send({ reason: 'Remaining balance' });
      expect(rest.body.data).toMatchObject({ status: 'refunded', refundedMinor: 4_000_000 });
      expect((await api('post', `/api/payments/orders/${orderId}/refund`).send({ reason: 'again' })).status).toBe(409);
      expect((await testDb.select().from(paymentRefunds).where(eq(paymentRefunds.orderId, orderId))).every(r => r.status === 'processed')).toBe(true);
    });
    it('never refunds more than was paid, even with simultaneous requests', async () => {
      const lead = await makeLead('Race', '+919855500011');
      const id = (await api('post', '/api/payments/orders').send({ leadId: lead, amountInr: 30_000 })).body.data.id;
      await api('post', `/api/payments/orders/${id}/simulate-paid`);
      const results = await Promise.all([1, 2, 3].map(() => api('post', `/api/payments/orders/${id}/refund`).send({ reason: 'parallel refund request' })));
      expect(results.filter(r => r.status === 200)).toHaveLength(1);
      const total = (await testDb.select().from(paymentRefunds).where(eq(paymentRefunds.orderId, id))).reduce((s, r) => s + r.amountMinor, 0);
      expect(total).toBe(3_000_000);
    });
  });

  describe('Stripe', () => {
    const stripeOk = (body: object) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

    it('opens a hosted checkout in payment mode with the right amount, metadata and idempotency key', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_x';
      const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(stripeOk({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' }));
      const lead = await makeLead('Stripe', '+919855500020');
      const res = await api('post', '/api/payments/orders').send({ leadId: lead, amountInr: 60_000 });
      expect(res.status, JSON.stringify(res.body)).toBe(201);
      expect(res.body.data).toMatchObject({ provider: 'stripe', paymentLinkUrl: 'https://checkout.stripe.com/c/pay/cs_test_1' });
      const [url, init] = spy.mock.calls[0]!;
      expect(String(url)).toBe('https://api.stripe.com/v1/checkout/sessions');
      const body = new URLSearchParams(String((init as RequestInit).body));
      expect(body.get('mode')).toBe('payment');
      expect(body.get('line_items[0][price_data][unit_amount]')).toBe('6000000');
      expect(body.get('line_items[0][price_data][currency]')).toBe('inr');
      expect(body.get('metadata[kind]')).toBe('booking_token');
      expect(body.get('metadata[companyId]')).toBe(a.company.id);
      expect(Number(body.get('expires_at'))).toBeGreaterThan(Date.now() / 1000);
      const headers = (init as RequestInit).headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer sk_test_x');
      expect(headers['Idempotency-Key']).toBe(`order_${res.body.data.id}`);
    });

    it('surfaces provider errors as a 502 without leaving a half-created order', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_x';
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: { message: 'Invalid API Key provided' } }), { status: 401 }));
      const lead = await makeLead('Broken', '+919855500021');
      const res = await api('post', '/api/payments/orders').send({ leadId: lead, amountInr: 5000 });
      expect(res.status).toBe(502);
      expect(await testDb.select().from(paymentOrders).where(eq(paymentOrders.leadId, lead))).toHaveLength(0);
    });

    describe('webhooks', () => {
      let orderId = '';
      beforeAll(async () => {
        process.env.STRIPE_SECRET_KEY = 'sk_test_x';
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(stripeOk({ id: 'cs_wh_1', url: 'https://checkout.stripe.com/c/pay/cs_wh_1' }));
        const lead = await makeLead('Hook', '+919855500022');
        orderId = (await api('post', '/api/payments/orders').send({ leadId: lead, amountInr: 20_000 })).body.data.id;
        vi.restoreAllMocks();
        delete process.env.STRIPE_SECRET_KEY;
      });
      const post = (evt: object, secret = WH_SECRET) => {
        process.env.STRIPE_WEBHOOK_SECRET = WH_SECRET;
        const { raw, header } = signed(evt, secret);
        return request(app).post('/api/subscription/webhook/stripe').set('Content-Type', 'application/json').set('Stripe-Signature', header).send(raw);
      };
      const completed = (id: string, amount: number, extra: object = {}) => ({ id, type: 'checkout.session.completed', data: { object: { id: 'cs_wh_1', payment_status: 'paid', payment_intent: 'pi_123', amount_total: amount, currency: 'inr', metadata: { orderId, companyId: a.company.id, kind: 'booking_token' }, ...extra } } });

      it('rejects unsigned and wrongly signed deliveries', async () => {
        process.env.STRIPE_WEBHOOK_SECRET = WH_SECRET;
        expect((await request(app).post('/api/subscription/webhook/stripe').set('Content-Type', 'application/json').send(JSON.stringify(completed(`evt_x_${RUN}`, 2_000_000)))).status).toBe(401);
        expect((await post(completed(`evt_x_${RUN}`, 2_000_000), 'whsec_wrong')).status).toBe(401);
        expect((await api('get', `/api/payments/orders/${orderId}`)).body.data.status).toBe('pending');
      });
      it('does not credit a payment whose amount differs from the order', async () => {
        const res = await post(completed(`evt_short_${RUN}`, 1_000));
        expect(res.status).toBe(200);
        const o = (await api('get', `/api/payments/orders/${orderId}`)).body.data;
        expect(o.status).toBe('failed');
        expect(o.receiptNo).toBeNull();
        await testDb.update(paymentOrders).set({ status: 'pending' }).where(eq(paymentOrders.id, orderId));
      });
      it('pays the order once, stores the raw event once, and ignores redelivery', async () => {
        const first = await post(completed(`evt_ok_1_${RUN}`, 2_000_000));
        expect(first.status).toBe(200);
        expect((await api('get', `/api/payments/orders/${orderId}`)).body.data).toMatchObject({ status: 'paid' });
        const again = await post(completed(`evt_ok_1_${RUN}`, 2_000_000));
        expect(again.body.result.duplicate).toBe(true);
        expect(await testDb.select().from(paymentEvents).where(eq(paymentEvents.eventId, `evt_ok_1_${RUN}`))).toHaveLength(1);
        const received = (await testDb.select().from(domainEvents).where(and(eq(domainEvents.companyId, a.company.id), eq(domainEvents.type, 'payment_received')))).filter(e => (e.payload as { order_id?: string }).order_id === orderId);
        expect(received).toHaveLength(1);
      });
      it('refunds through the Stripe API against the stored payment intent', async () => {
        const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(stripeOk({ id: 're_test_1' }));
        process.env.STRIPE_SECRET_KEY = 'sk_test_x';
        const res = await api('post', `/api/payments/orders/${orderId}/refund`).send({ amountInr: 5_000, reason: 'Customer cancelled' });
        expect(res.body.data).toMatchObject({ status: 'partially_refunded', refundedMinor: 500_000 });
        const [url, init] = spy.mock.calls[0]!;
        expect(String(url)).toBe('https://api.stripe.com/v1/refunds');
        const body = new URLSearchParams(String((init as RequestInit).body));
        expect(body.get('payment_intent')).toBe('pi_123');
        expect(body.get('amount')).toBe('500000');
        const [r] = await testDb.select().from(paymentRefunds).where(eq(paymentRefunds.orderId, orderId));
        expect(r!.providerRefundId).toBe('re_test_1');
      });
      it('marks a failed provider refund as failed and keeps the order refundable', async () => {
        process.env.STRIPE_SECRET_KEY = 'sk_test_x';
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: { message: 'charge already refunded' } }), { status: 400 }));
        const res = await api('post', `/api/payments/orders/${orderId}/refund`).send({ amountInr: 1_000, reason: 'Retry later' });
        expect(res.status).toBe(502);
        const refunds = await testDb.select().from(paymentRefunds).where(eq(paymentRefunds.orderId, orderId));
        expect(refunds.map(r => r.status).sort()).toEqual(['failed', 'processed']);
        expect((await api('get', `/api/payments/orders/${orderId}`)).body.data.refundedMinor).toBe(500_000);
      });
      it('retries a failed delivery: the event is forgotten when processing throws', async () => {
        vi.spyOn(paymentsService, 'handleStripeOrderEvent').mockRejectedValueOnce(new Error('db hiccup'));
        const evt = completed(`evt_retry_${RUN}`, 2_000_000);
        expect((await post(evt)).status).toBeGreaterThanOrEqual(500);
        expect(await testDb.select().from(paymentEvents).where(eq(paymentEvents.eventId, `evt_retry_${RUN}`))).toHaveLength(0);
        expect((await post(evt)).status).toBe(200);
      });
    });
  });

  describe('credits', () => {
    it('tops up through a paid order and keeps a ledger', async () => {
      const order = await api('post', '/api/payments/credits/topup').send({ packId: 'pack_5000' });
      expect(order.status, JSON.stringify(order.body)).toBe(201);
      expect((await api('get', '/api/payments/credits')).body.data.balance).toBe(0);
      await api('post', `/api/payments/orders/${order.body.data.id}/simulate-paid`);
      const c = (await api('get', '/api/payments/credits')).body.data;
      expect(c.balance).toBe(5500);
      expect(c.packs).toHaveLength(3);
      const hist = (await api('get', '/api/payments/credits/history')).body.data;
      expect(hist[0]).toMatchObject({ delta: 5500, reason: 'topup', balanceAfter: 5500 });
      expect((await api('post', '/api/payments/credits/topup').send({ packId: 'free_money' })).status).toBe(400);
      await api('post', `/api/payments/orders/${order.body.data.id}/simulate-paid`);
      expect((await api('get', '/api/payments/credits')).body.data.balance).toBe(5500); // paying twice never doubles credits
      expect((await api('get', '/api/payments/credits', b)).body.data.balance).toBe(0);
    });
    it('charges usage against credits, never below zero, and warns once when low', async () => {
      await api('put', '/api/payments/credits/auto-topup').send({ enabled: false, threshold: 300, packId: 'pack_1000' });
      await paymentsService.consume(a.company.id, 5000);
      expect((await api('get', '/api/payments/credits')).body.data.balance).toBe(500);
      await paymentsService.consume(a.company.id, 400);
      await paymentsService.consume(a.company.id, 10_000);
      const c = (await api('get', '/api/payments/credits')).body.data;
      expect(c.balance).toBe(0);
      expect(c.lowBalance).toBe(true);
      const low = await testDb.select().from(domainEvents).where(and(eq(domainEvents.companyId, a.company.id), eq(domainEvents.type, 'credits_low')));
      expect(low).toHaveLength(1);
      const usage = (await testDb.select().from(usageCreditTransactions).where(eq(usageCreditTransactions.companyId, a.company.id))).filter(t => t.reason === 'usage');
      expect(usage.reduce((s, t) => s + Number(t.delta), 0)).toBe(-5500);
    });
    it('does not meter companies that have no credit account', async () => {
      const fresh = await createAuthenticatedUser('company_admin');
      await paymentsService.consume(fresh.company.id, 50);
      expect(await testDb.select().from(usageCreditAccounts).where(eq(usageCreditAccounts.companyId, fresh.company.id))).toHaveLength(0);
      await cleanupTestDatabase([fresh.company.id]);
    });
    it('deducts real Gemini usage from the balance', async () => {
      await paymentsService.grantCredits(a.company.id, 1000, 'grant');
      recordLlmCall({ tier: 'fast', companyId: a.company.id, chatbotId: '', systemPrompt: '', userMessage: '' } as never, { text: 'x', provider: 'gemini', model: 'gemini-3.8-flash', tokens: { prompt: 1_000_000, completion: 100_000, total: 1_100_000 }, costUsd: 0, latencyMs: 5, circuitBreakerTripped: false });
      const bal = await waitFor(async () => {
        const [acct] = await testDb.select().from(usageCreditAccounts).where(eq(usageCreditAccounts.companyId, a.company.id));
        return Number(acct!.balance) < 1000 ? Number(acct!.balance) : false;
      });
      expect(bal).toBeLessThan(1000);
    });
  });

  describe('subscriptions', () => {
    const post = (evt: object) => {
      process.env.STRIPE_WEBHOOK_SECRET = WH_SECRET;
      const { raw, header } = signed(evt);
      return request(app).post('/api/subscription/webhook/stripe').set('Content-Type', 'application/json').set('Stripe-Signature', header).send(raw);
    };

    it('opens a recurring INR subscription checkout with the company in the metadata', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_x';
      const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id: 'cs_sub_1', url: 'https://checkout.stripe.com/c/pay/cs_sub_1' }), { status: 200 }));
      const res = await api('post', '/api/subscription/checkout').send({ plan: 'growth', billingCycle: 'annual', provider: 'stripe' });
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      const body = new URLSearchParams(String((spy.mock.calls[0]![1] as RequestInit).body));
      expect(body.get('mode')).toBe('subscription');
      expect(body.get('line_items[0][price_data][recurring][interval]')).toBe('year');
      expect(body.get('line_items[0][price_data][unit_amount]')).toBe(String(SUBSCRIPTION_PLANS.growth!.priceInrAnnually * 100));
      expect(body.get('subscription_data[metadata][companyId]')).toBe(a.company.id);
      expect(body.get('subscription_data[metadata][plan]')).toBe('growth');
    });

    it('upgrades on a paid event with GST on the invoice, and remembers the Stripe subscription', async () => {
      const amount = SUBSCRIPTION_PLANS.growth!.priceInrMonthly * 100;
      const res = await post({ id: `evt_sub_paid_${RUN}`, type: 'checkout.session.completed', data: { object: { id: 'cs_sub_1', mode: 'subscription', subscription: 'sub_abc', amount_total: amount, metadata: { companyId: a.company.id, plan: 'growth', billingCycle: 'monthly' } } } });
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      const [sub] = await testDb.select().from(subscriptions).where(eq(subscriptions.companyId, a.company.id));
      expect(sub).toMatchObject({ plan: 'growth', status: 'active' });
      const [inv] = await testDb.select().from(subscriptionInvoices).where(eq(subscriptionInvoices.companyId, a.company.id));
      expect(inv!.amount).toBe(amount);
      expect(inv!.taxAmount).toBe(computeGst(amount, '29', '29').totalTaxMinor);
      expect((inv!.taxBreakdown as { kind: string }).kind).toBe('intra_state'); // the profile above is in state 29
      expect((inv!.billingSnapshot as { gstin: string }).gstin).toBe(GSTIN);
      expect(await paymentsService.stripeSubscriptionOf(a.company.id)).toBe('sub_abc');
    });

    it('moves a subscription to past due on a failed payment, then to the trial after the grace period', async () => {
      const failed = await post({ id: `evt_fail_${RUN}`, type: 'invoice.payment_failed', data: { object: { id: 'in_1', subscription_details: { metadata: { companyId: a.company.id } } } } });
      expect(failed.body.result.pastDue).toBe(true);
      expect((await testDb.select().from(subscriptions).where(eq(subscriptions.companyId, a.company.id)))[0]!.status).toBe('past_due');
      expect(await testDb.select().from(domainEvents).where(and(eq(domainEvents.companyId, a.company.id), eq(domainEvents.type, 'payment_failed')))).toHaveLength(1);

      expect(await paymentsService.dunningSweep(new Date(Date.now() + 3 * 86_400_000))).toBe(0); // still in the grace period
      expect(await paymentsService.dunningSweep(new Date(Date.now() + 8 * 86_400_000))).toBeGreaterThanOrEqual(1);
      const [sub] = await testDb.select().from(subscriptions).where(eq(subscriptions.companyId, a.company.id));
      expect(sub).toMatchObject({ plan: 'trial', status: 'active' });
      expect((await testDb.select({ plan: companies.plan }).from(companies).where(eq(companies.id, a.company.id)))[0]!.plan).toBe('trial');
    });

    it('a later successful payment clears the past-due state', async () => {
      await paymentsService.markPastDue(a.company.id);
      const amount = SUBSCRIPTION_PLANS.starter!.priceInrMonthly * 100;
      await post({ id: `evt_sub_paid_2_${RUN}`, type: 'invoice.paid', data: { object: { id: 'in_2', amount_paid: amount, subscription_details: { metadata: { companyId: a.company.id, plan: 'starter', billingCycle: 'monthly' } } } } });
      const [sub] = await testDb.select().from(subscriptions).where(eq(subscriptions.companyId, a.company.id));
      expect(sub).toMatchObject({ plan: 'starter', status: 'active' });
    });

    it('cancelling stops renewal at Stripe as well', async () => {
      await paymentsService.rememberStripeSubscription(a.company.id, 'sub_cancel_me');
      process.env.STRIPE_SECRET_KEY = 'sk_test_x';
      const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id: 'sub_cancel_me' }), { status: 200 }));
      await billingService.cancelSubscription(a.company.id, a.user.id);
      const [url, init] = spy.mock.calls[0]!;
      expect(String(url)).toBe('https://api.stripe.com/v1/subscriptions/sub_cancel_me');
      expect(new URLSearchParams(String((init as RequestInit).body)).get('cancel_at_period_end')).toBe('true');
    });
  });
});
