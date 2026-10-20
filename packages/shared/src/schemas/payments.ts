import { z } from 'zod';

// ------------------------------------------------------------------ GST / billing profile
const GSTIN_RE = /^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const billingProfileSchema = z.object({
  legalName: z.string().min(2).max(200),
  gstin: z.string().toUpperCase().regex(GSTIN_RE, 'Enter a valid 15-character GSTIN').optional().or(z.literal('')),
  pan: z.string().toUpperCase().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Enter a valid PAN').optional().or(z.literal('')),
  stateCode: z.string().regex(/^[0-9]{2}$/, 'Two-digit GST state code, e.g. 29 for Karnataka').optional().or(z.literal('')),
  address: z.object({ line1: z.string().max(200).default(''), city: z.string().max(100).default(''), state: z.string().max(100).default(''), pincode: z.string().max(10).default('') }).default({}),
  billingEmail: z.string().email().optional().or(z.literal('')),
});
export type BillingProfileInput = z.infer<typeof billingProfileSchema>;
export interface BillingProfileItem {
  legalName: string | null;
  gstin: string | null;
  pan: string | null;
  stateCode: string | null;
  address: Record<string, string>;
  billingEmail: string | null;
}

/** GST on SaaS is 18%. Prices are GST-inclusive: the tax is the share of what was paid. */
export const GST_RATE_PERCENT = 18;
export interface GstBreakdown {
  taxableMinor: number;
  totalTaxMinor: number;
  cgstMinor: number;
  sgstMinor: number;
  igstMinor: number;
  kind: 'intra_state' | 'inter_state';
}

// ------------------------------------------------------------------ Booking token payment links
export const createPaymentLinkSchema = z.object({
  leadId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  unitId: z.string().uuid().optional(),
  /** Whole rupees. */
  amountInr: z.number().int().min(1000).max(1_000_000),
  expiresInHours: z.number().int().min(1).max(24).default(24),
  note: z.string().max(200).optional(),
});
export type CreatePaymentLinkInput = z.infer<typeof createPaymentLinkSchema>;

export const refundOrderSchema = z.object({
  /** Whole rupees; omit to refund whatever is left. */
  amountInr: z.number().int().min(1).optional(),
  reason: z.string().min(3).max(300),
});
export type RefundOrderInput = z.infer<typeof refundOrderSchema>;

export type PaymentOrderStatus = 'created' | 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded' | 'expired';
export interface PaymentOrderItem {
  id: string;
  kind: 'booking_token' | 'subscription' | 'credit_topup';
  leadId: string | null;
  leadName: string | null;
  projectName: string | null;
  unitNumber: string | null;
  amountMinor: number;
  refundedMinor: number;
  currency: string;
  provider: string;
  status: PaymentOrderStatus;
  paymentLinkUrl: string | null;
  receiptNo: string | null;
  expiresAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

// ------------------------------------------------------------------ Credits
export const CREDIT_PACKS = [
  { id: 'pack_1000', priceInr: 1000, credits: 1000, label: '1,000 credits' },
  { id: 'pack_5000', priceInr: 5000, credits: 5500, label: '5,500 credits (10% bonus)' },
  { id: 'pack_20000', priceInr: 20000, credits: 24000, label: '24,000 credits (20% bonus)' },
] as const;
export const topupSchema = z.object({ packId: z.enum(['pack_1000', 'pack_5000', 'pack_20000']) });
export type TopupInput = z.infer<typeof topupSchema>;
export const autoTopupSchema = z.object({ enabled: z.boolean(), threshold: z.number().int().min(0).max(100000).default(200), packId: z.enum(['pack_1000', 'pack_5000', 'pack_20000']).default('pack_1000') });
export type AutoTopupInput = z.infer<typeof autoTopupSchema>;
/** 1 credit = Rs 1 of usage. Gemini and telephony costs are converted at this exchange rate. */
export const INR_PER_USD = 84;
export interface CreditAccountItem {
  balance: number;
  autoTopup: { enabled: boolean; threshold: number; packId: string };
  lowBalance: boolean;
}
export interface CreditTransactionItem {
  id: string;
  delta: number;
  reason: string;
  balanceAfter: number | null;
  createdAt: string;
}
