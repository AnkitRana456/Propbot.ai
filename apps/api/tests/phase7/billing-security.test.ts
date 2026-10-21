import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import crypto from 'crypto';
import request from 'supertest';
import { eq, like } from 'drizzle-orm';
import { createApp } from '../../src/server.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { createAuthenticatedUser } from '../helpers/test-fixtures.js';
import { companies, paymentEvents, subscriptionInvoices } from '../../src/db/schema/index.js';
import { verifyStripeSignature, verifyHmacSha256Hex } from '../../src/modules/billing/webhook-signatures.js';

const stripeHeader = (raw: string, secret: string, t = Math.floor(Date.now() / 1000)) =>
  `t=${t},v1=${crypto.createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex')}`;

describe('webhook signature verification (unit)', () => {
  const secret = 'whsec_unit_test_secret';
  const body = JSON.stringify({ id: 'evt_1', type: 'invoice.paid' });

  it('accepts a genuine Stripe signature and rejects tampering, wrong secret, stale timestamps', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(verifyStripeSignature(body, stripeHeader(body, secret, now), secret)).toBe(true);
    expect(verifyStripeSignature(body + ' ', stripeHeader(body, secret, now), secret)).toBe(false);
    expect(verifyStripeSignature(body, stripeHeader(body, 'other', now), secret)).toBe(false);
    // replay of an old capture (6 minutes)
    expect(verifyStripeSignature(body, stripeHeader(body, secret, now - 360), secret)).toBe(false);
    // key rotation: any matching v1 is enough
    const hdr = `${stripeHeader(body, 'old-secret', now)},v1=${crypto
      .createHmac('sha256', secret)
      .update(`${now}.${body}`)
      .digest('hex')}`;
    expect(verifyStripeSignature(body, hdr, secret)).toBe(true);
  });

  it('never accepts anything without a secret or header', () => {
    expect(verifyStripeSignature(body, stripeHeader(body, secret), '')).toBe(false);
    expect(verifyStripeSignature(body, '', secret)).toBe(false);
    expect(verifyStripeSignature(body, 't=abc,v1=zz', secret)).toBe(false);
    expect(verifyHmacSha256Hex(body, 'deadbeef', '')).toBe(false);
  });

  it('verifies Razorpay hex HMAC', () => {
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyHmacSha256Hex(body, sig, secret)).toBe(true);
    expect(verifyHmacSha256Hex(body, sig.replace(/.$/, '0'), secret)).toBe(false);
  });
});

describe('billing webhooks & checkout over HTTP', () => {
  const app = createApp();
  const secret = 'whsec_http_test_secret';
  let companyId: string;
  let adminAuth: string;
  const savedEnv = { ...process.env };

  const event = (invoice: string, plan = 'starter') =>
    JSON.stringify({
      id: `evt_${invoice}`,
      type: 'checkout.session.completed',
      data: { object: { invoice, amount_total: 299900, metadata: { companyId, plan, billingCycle: 'monthly' } } },
    });

  const planOf = async () => (await testDb.select().from(companies).where(eq(companies.id, companyId)))[0]!.plan;

  // Recorded webhook events are global (not tenant rows), so clear this file's fixed ids or every second run sees a "duplicate"
  const clearEvents = () => testDb.delete(paymentEvents).where(like(paymentEvents.eventId, 'evt_in_%'));

  beforeAll(async () => {
    await clearEvents();
    const a = await createAuthenticatedUser('company_admin');
    companyId = a.company.id;
    adminAuth = a.authHeader;
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  afterAll(async () => {
    process.env = { ...savedEnv };
    await clearEvents();
    await cleanupTestDatabase([companyId]);
  });

  it('rejects Stripe webhooks when no webhook secret is configured (no fail-open)', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const raw = event('in_nosecret');
    const res = await request(app)
      .post('/api/subscription/webhook/stripe')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', stripeHeader(raw, secret))
      .send(raw);
    expect(res.status).toBe(401);
    expect(await planOf()).not.toBe('starter');
  });

  it('rejects a wrong or missing signature and leaves the plan alone', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = secret;
    const raw = event('in_badsig');
    const bad = await request(app)
      .post('/api/subscription/webhook/stripe')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', stripeHeader(raw, 'attacker-secret'))
      .send(raw);
    expect(bad.status).toBe(401);
    const none = await request(app).post('/api/subscription/webhook/stripe').set('Content-Type', 'application/json').send(raw);
    expect(none.status).toBe(401);
    expect(await planOf()).not.toBe('starter');
  });

  it('applies a correctly signed paid event once, and a redelivery is a no-op', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = secret;
    const raw = event('in_paid_1');
    const send = () =>
      request(app)
        .post('/api/subscription/webhook/stripe')
        .set('Content-Type', 'application/json')
        .set('Stripe-Signature', stripeHeader(raw, secret))
        .send(raw);

    const first = await send();
    expect(first.status).toBe(200);
    expect(first.body.result.handled).toBe(true);
    expect(await planOf()).toBe('starter');

    const again = await send();
    expect(again.status).toBe(200);
    expect(again.body.result.duplicate).toBe(true);
    const invoices = await testDb.select().from(subscriptionInvoices).where(eq(subscriptionInvoices.companyId, companyId));
    expect(invoices.filter(i => i.providerInvoiceId === 'in_paid_1')).toHaveLength(1);
  });

  it('ignores signed events that do not mean "paid"', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = secret;
    const raw = JSON.stringify({
      id: 'evt_x',
      type: 'customer.updated',
      data: { object: { metadata: { companyId, plan: 'enterprise' } } },
    });
    const res = await request(app)
      .post('/api/subscription/webhook/stripe')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', stripeHeader(raw, secret))
      .send(raw);
    expect(res.status).toBe(200);
    expect(res.body.result.handled).toBe(false);
    expect(await planOf()).not.toBe('enterprise');
  });

  it('the mock provider (free upgrades) is unreachable in production', async () => {
    process.env.NODE_ENV = 'production';
    const raw = JSON.stringify({ type: 'payment.succeeded', data: { companyId, plan: 'enterprise' } });
    const res = await request(app)
      .post('/api/subscription/webhook/mock')
      .set('Content-Type', 'application/json')
      .set('x-mock-signature', 'mock_valid_signature')
      .send(raw);
    expect([401, 403]).toContain(res.status);
    expect(await planOf()).not.toBe('enterprise');
  });

  it('mock checkout cannot self-upgrade a plan in production', async () => {
    process.env.NODE_ENV = 'production';
    const res = await request(app)
      .post('/api/subscription/checkout')
      .set('Authorization', adminAuth)
      .send({ plan: 'enterprise', billingCycle: 'monthly', successUrl: 'https://x.test/ok', cancelUrl: 'https://x.test/no' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await planOf()).not.toBe('enterprise');
  });
});
