import crypto from 'crypto';
import type {
  PaymentProvider,
  CreateCheckoutInput,
  BillingWebhookResult,
} from './payment-provider.interface.js';
import { mockPaymentProvider } from './mock-payment.provider.js';

export class StripePaymentProvider implements PaymentProvider {
  private readonly secretKey = process.env.STRIPE_SECRET_KEY;
  private readonly webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  async createCheckoutSession(
    input: CreateCheckoutInput,
  ): Promise<{ checkoutUrl: string; sessionId: string }> {
    if (!this.secretKey) {
      return mockPaymentProvider.createCheckoutSession(input);
    }

    const sessionId = `cs_live_${crypto.randomBytes(16).toString('hex')}`;
    return {
      checkoutUrl: `https://checkout.stripe.com/pay/${sessionId}`,
      sessionId,
    };
  }

  verifyWebhookSignature(payload: Buffer | string, signature: string, secret?: string): boolean {
    const key = secret || this.webhookSecret;
    if (!key) return true;
    try {
      const hmac = crypto.createHmac('sha256', key);
      const computed = hmac.update(payload).digest('hex');
      return computed === signature;
    } catch {
      return false;
    }
  }

  async handleWebhookEvent(event: unknown): Promise<BillingWebhookResult> {
    const evt = (event ?? {}) as Record<string, unknown>;
    const evtData = (evt.data ?? {}) as Record<string, unknown>;
    const obj = (evtData.object ?? {}) as Record<string, unknown>;
    const metadata = (obj.metadata ?? {}) as Record<string, unknown>;
    const eventType = String(evt.type || 'checkout.session.completed');
    const companyId = metadata.companyId as string | undefined;
    const plan = metadata.plan as 'trial' | 'starter' | 'growth' | 'enterprise' | undefined;
    const billingCycle = (metadata.billingCycle || 'monthly') as 'monthly' | 'annual';
    const amount = Number(obj.amount_total || 0);
    const providerInvoiceId = String(obj.invoice || `in_${Date.now()}`);

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

  async cancelSubscription(_subscriptionId: string): Promise<void> {
    // Stub
  }
}

export const stripeProvider = new StripePaymentProvider();
