import { z } from 'zod';

export const planTierSchema = z.enum(['trial', 'starter', 'growth', 'enterprise']);
export const billingCycleSchema = z.enum(['monthly', 'annual']);
export const paymentProviderTypeSchema = z.enum(['mock', 'stripe', 'razorpay']);

export const checkoutSessionSchema = z.object({
  plan: planTierSchema,
  billingCycle: billingCycleSchema.default('monthly'),
  provider: paymentProviderTypeSchema.optional().default('mock'),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export const purchaseLeadCreditsSchema = z.object({
  credits: z.number().int().min(10).max(100000),
  provider: paymentProviderTypeSchema.optional().default('mock'),
});

export const subscriptionInvoiceFilterSchema = z.object({
  status: z.enum(['all', 'paid', 'pending', 'failed']).optional().default('all'),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(50).optional().default(10),
});

export const planLimitCheckSchema = z.object({
  resource: z.enum(['chatbots', 'conversations', 'ai_tokens', 'users', 'whatsapp_numbers', 'storage']),
  increment: z.number().int().min(1).default(1),
});
