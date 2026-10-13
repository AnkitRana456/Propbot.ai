import { z } from 'zod';
import {
  planTierSchema,
  billingCycleSchema,
  paymentProviderTypeSchema,
  checkoutSessionSchema,
  purchaseLeadCreditsSchema,
  subscriptionInvoiceFilterSchema,
  planLimitCheckSchema,
} from '../schemas/billing.js';
import type { PlanLimits } from '../constants/plans.js';

export type PlanTier = z.infer<typeof planTierSchema>;
export type BillingCycle = z.infer<typeof billingCycleSchema>;
export type PaymentProviderType = z.infer<typeof paymentProviderTypeSchema>;
export type CheckoutSessionInput = z.input<typeof checkoutSessionSchema>;
export type PurchaseLeadCreditsInput = z.input<typeof purchaseLeadCreditsSchema>;
export type SubscriptionInvoiceFilter = z.input<typeof subscriptionInvoiceFilterSchema>;
export type PlanLimitCheckInput = z.input<typeof planLimitCheckSchema>;

export interface UsageMeters {
  chatbots: { current: number; limit: number; percentage: number };
  conversations: { current: number; limit: number; percentage: number };
  aiTokens: { current: number; limit: number; percentage: number };
  users: { current: number; limit: number; percentage: number };
  whatsappNumbers: { current: number; limit: number; percentage: number };
  storageMb: { current: number; limit: number; percentage: number };
}

export interface SubscriptionOverview {
  plan: PlanTier;
  planName: string;
  status: 'active' | 'trial' | 'past_due' | 'canceled';
  billingCycle: BillingCycle;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  leadCreditsBalance: number;
  limits: PlanLimits;
  usage: UsageMeters;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed';
  provider: string;
  paidAt: string | null;
  pdfUrl: string | null;
  createdAt: string;
}

export interface LeadCreditTransactionRecord {
  id: string;
  amount: number;
  balanceAfter: number;
  type: 'purchase' | 'consumption' | 'refund' | 'adjustment';
  description: string;
  referenceId: string | null;
  createdAt: string;
}
