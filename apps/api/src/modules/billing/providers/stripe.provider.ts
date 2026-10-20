import { SUBSCRIPTION_PLANS } from '@propbot/shared';
import type {
  PaymentProvider,
  CreateCheckoutInput,
  BillingWebhookResult,
} from './payment-provider.interface.js';
import { mockPaymentProvider } from './mock-payment.provider.js';
import { verifyStripeSignature } from '../webhook-signatures.js';
import { stripeRequest } from '../../payments/stripe-api.js';

export class StripePaymentProvider implements PaymentProvider {
  private readonly webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  /**
   * Hosted Stripe Checkout in subscription mode (INR, recurring monthly or yearly). The company and plan travel as
   * metadata on the session and on the subscription, so every later invoice event can be tied back to the company.
   * Without STRIPE_SECRET_KEY, development falls back to the mock provider and production refuses.
   */
  async createCheckoutSession(
    input: CreateCheckoutInput,
  ): Promise<{ checkoutUrl: string; sessionId: string }> {
    if (!process.env.STRIPE_SECRET_KEY) {
      if (process.env.NODE_ENV === 'production') {
        throw Object.assign(new Error('Stripe is not configured (STRIPE_SECRET_KEY missing).'), {
          statusCode: 503,
          code: 'PAYMENTS_NOT_CONFIGURED',
        });
      }
      return mockPaymentProvider.createCheckoutSession(input);
    }

    const planDef = SUBSCRIPTION_PLANS[input.plan];
    if (!planDef || input.plan === 'trial') {
      throw Object.assign(new Error('Choose a paid plan.'), { statusCode: 400, code: 'PLAN_INVALID' });
    }
    const annual = input.billingCycle === 'annual';
    const unitAmount = (annual ? planDef.priceInrAnnually : planDef.priceInrMonthly) * 100;
    const base = process.env.APP_BASE_URL ?? process.env.WEB_APP_URL ?? 'http://localhost:5173';

    const session = await stripeRequest<{ id: string; url: string }>('POST', '/checkout/sessions', {
      mode: 'subscription',
      'line_items[0][quantity]': 1,
      'line_items[0][price_data][currency]': 'inr',
      'line_items[0][price_data][unit_amount]': unitAmount,
      'line_items[0][price_data][recurring][interval]': annual ? 'year' : 'month',
      'line_items[0][price_data][product_data][name]': `PropBot ${planDef.name} (${annual ? 'annual' : 'monthly'})`,
      'metadata[companyId]': input.companyId,
      'metadata[plan]': input.plan,
      'metadata[billingCycle]': input.billingCycle,
      'subscription_data[metadata][companyId]': input.companyId,
      'subscription_data[metadata][plan]': input.plan,
      'subscription_data[metadata][billingCycle]': input.billingCycle,
      client_reference_id: input.companyId,
      success_url: input.successUrl ?? `${base}/subscription?checkout=success`,
      cancel_url: input.cancelUrl ?? `${base}/subscription?checkout=cancelled`,
    });
    return { checkoutUrl: session.url, sessionId: session.id };
  }

  /**
   * Real Stripe scheme (`Stripe-Signature: t=...,v1=...` over `${t}.${rawBody}`, 5-minute tolerance).
   * With no STRIPE_WEBHOOK_SECRET configured every delivery is rejected: a missing secret must never
   * mean "accept anything", because a forged event can upgrade any company's plan.
   */
  verifyWebhookSignature(payload: Buffer | string, signature: string, secret?: string): boolean {
    const key = secret || this.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET;
    if (!key) return false;
    return verifyStripeSignature(payload, signature, key);
  }

  async handleWebhookEvent(event: unknown): Promise<BillingWebhookResult> {
    const evt = (event ?? {}) as Record<string, unknown>;
    const evtData = (evt.data ?? {}) as Record<string, unknown>;
    const obj = (evtData.object ?? {}) as Record<string, unknown>;
    const ownMeta = (obj.metadata ?? {}) as Record<string, unknown>;
    // Invoice events carry the subscription's metadata under subscription_details
    const subMeta = ((obj.subscription_details ?? {}) as { metadata?: Record<string, unknown> }).metadata ?? {};
    const metadata = Object.keys(ownMeta).length ? ownMeta : subMeta;
    const eventType = String(evt.type || '');
    // Only events that mean "money was received" may change a plan
    const PAID_EVENTS = ['checkout.session.completed', 'invoice.paid', 'invoice.payment_succeeded'];
    if (!PAID_EVENTS.includes(eventType)) {
      return { handled: false, eventType };
    }
    const companyId = metadata.companyId as string | undefined;
    const plan = metadata.plan as 'trial' | 'starter' | 'growth' | 'enterprise' | undefined;
    const billingCycle = (metadata.billingCycle || 'monthly') as 'monthly' | 'annual';
    const amount = Number(obj.amount_total ?? obj.amount_paid ?? 0);
    const providerInvoiceId = String(obj.invoice || (eventType.startsWith('invoice.') ? obj.id : undefined) || `in_${String(evt.id ?? Date.now())}`);

    return {
      handled: true,
      eventType,
      companyId,
      plan,
      billingCycle,
      amount,
      providerInvoiceId,
    };
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    // At period end: the customer keeps what they paid for, and Stripe stops renewing.
    await stripeRequest('POST', `/subscriptions/${subscriptionId}`, { cancel_at_period_end: true });
  }
}

export const stripeProvider = new StripePaymentProvider();
