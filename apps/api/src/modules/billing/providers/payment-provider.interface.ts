export interface CreateCheckoutInput {
  companyId: string;
  plan: 'trial' | 'starter' | 'growth' | 'enterprise';
  billingCycle: 'monthly' | 'annual';
  successUrl?: string;
  cancelUrl?: string;
}

export interface BillingWebhookResult {
  handled: boolean;
  eventType: string;
  companyId?: string;
  plan?: 'trial' | 'starter' | 'growth' | 'enterprise';
  billingCycle?: 'monthly' | 'annual';
  amount?: number;
  providerInvoiceId?: string;
}

export interface PaymentProvider {
  createCheckoutSession(input: CreateCheckoutInput): Promise<{ checkoutUrl: string; sessionId: string }>;
  verifyWebhookSignature(payload: Buffer | string, signature: string, secret?: string): boolean;
  handleWebhookEvent(event: unknown): Promise<BillingWebhookResult>;
  cancelSubscription(subscriptionId: string): Promise<void>;
}
