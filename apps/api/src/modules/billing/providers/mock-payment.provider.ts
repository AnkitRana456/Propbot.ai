import crypto from 'crypto';
import type {
  PaymentProvider,
  CreateCheckoutInput,
  BillingWebhookResult,
} from './payment-provider.interface.js';

export class DevMockPaymentProvider implements PaymentProvider {
  async createCheckoutSession(
    input: CreateCheckoutInput,
  ): Promise<{ checkoutUrl: string; sessionId: string }> {
    const sessionId = `mock_sess_${crypto.randomBytes(16).toString('hex')}`;
    const checkoutUrl = `${input.successUrl || 'http://localhost:5173/subscription'}?session_id=${sessionId}&plan=${input.plan}&status=success`;
    return {
      checkoutUrl,
      sessionId,
    };
  }

  verifyWebhookSignature(_payload: Buffer | string, signature: string): boolean {
    // Development / test helper only. In production this would let anyone POST a "payment" for free.
    if (process.env.NODE_ENV === 'production') return false;
    return signature === 'mock_valid_signature' || process.env.NODE_ENV === 'test';
  }

  async handleWebhookEvent(event: unknown): Promise<BillingWebhookResult> {
    const evt = (event ?? {}) as Record<string, unknown>;
    const evtData = (evt.data ?? {}) as Record<string, unknown>;
    const eventType = String(evt.type || 'payment.succeeded');
    const companyId = (evtData.companyId || evt.companyId) as string | undefined;
    const plan = (evtData.plan || evt.plan || 'starter') as 'trial' | 'starter' | 'growth' | 'enterprise';
    const billingCycle = (evtData.billingCycle || evt.billingCycle || 'monthly') as 'monthly' | 'annual';
    const amount = Number(evtData.amount || evt.amount || 299900);
    const providerInvoiceId = `mock_inv_${Date.now()}`;

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
    // No-op for mock provider
  }
}

export const mockPaymentProvider = new DevMockPaymentProvider();
