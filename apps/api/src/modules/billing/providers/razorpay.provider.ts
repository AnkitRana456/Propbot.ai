import crypto from 'crypto';
import type {
  PaymentProvider,
  CreateCheckoutInput,
  BillingWebhookResult,
} from './payment-provider.interface.js';
import { mockPaymentProvider } from './mock-payment.provider.js';

export class RazorpayPaymentProvider implements PaymentProvider {
  private readonly keyId = process.env.RAZORPAY_KEY_ID;
  private readonly keySecret = process.env.RAZORPAY_KEY_SECRET;
  private readonly webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  async createCheckoutSession(
    input: CreateCheckoutInput,
  ): Promise<{ checkoutUrl: string; sessionId: string }> {
    if (!this.keyId || !this.keySecret) {
      return mockPaymentProvider.createCheckoutSession(input);
    }

    const orderId = `order_${crypto.randomBytes(14).toString('hex')}`;
    return {
      checkoutUrl: `https://api.razorpay.com/v1/checkout/${orderId}`,
      sessionId: orderId,
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
    const payload = (evt.payload ?? {}) as Record<string, unknown>;
    const payment = (payload.payment ?? {}) as Record<string, unknown>;
    const entity = (payment.entity ?? {}) as Record<string, unknown>;
    const notes = (entity.notes ?? {}) as Record<string, unknown>;
    const eventType = String(evt.event || 'subscription.charged');
    const companyId = notes.companyId as string | undefined;
    const plan = notes.plan as 'trial' | 'starter' | 'growth' | 'enterprise' | undefined;
    const billingCycle = (notes.billingCycle || 'monthly') as 'monthly' | 'annual';
    const amount = Number(entity.amount || 0);
    const providerInvoiceId = String(entity.invoice_id || `inv_${Date.now()}`);

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

export const razorpayProvider = new RazorpayPaymentProvider();
