import { paymentsService } from '../payments/payments.service.js';
import { computeGst } from '../payments/gst.js';
import { stripeConfigured } from '../payments/stripe-api.js';
import { eq, and, desc, gte, isNull, sql } from 'drizzle-orm';
import { SUBSCRIPTION_PLANS, type PlanTier, type BillingCycle, type PlanLimits } from '@propbot/shared';
import type {
  CheckoutSessionInput,
  PurchaseLeadCreditsInput,
  SubscriptionInvoiceFilter,
  SubscriptionOverview,
} from '@propbot/shared';
import { db } from '../../db/index.js';
import {
  subscriptions,
  companies,
  chatbots,
  users,
  conversations,
  whatsappConfigs,
  subscriptionInvoices,
  knowledgeSources,
  leadCreditTransactions,
} from '../../db/schema/index.js';
import { mockPaymentProvider } from './providers/mock-payment.provider.js';
import { stripeProvider } from './providers/stripe.provider.js';
import { razorpayProvider } from './providers/razorpay.provider.js';
import { auditService } from '../audit/audit.service.js';

/** Thrown when a server-side plan limit blocks an action (HTTP 403, same shape as the middleware). */
export class PlanLimitError extends Error {
  readonly statusCode = 403;
  readonly code = 'PLAN_LIMIT_EXCEEDED';
  constructor(
    message: string,
    readonly details: { resource: string; current: number; limit: number; upgradeUrl: string },
  ) {
    super(message);
    this.name = 'PlanLimitError';
  }
}

const BYTES_PER_MB = 1024 * 1024;

export class BillingService {
  private getProvider(providerName?: string) {
    if (providerName === 'stripe') return stripeProvider;
    if (providerName === 'razorpay') return razorpayProvider;
    if (providerName === 'mock' || providerName === undefined) {
      if (process.env.NODE_ENV === 'production') {
        throw Object.assign(new Error('The mock payment provider is disabled in production.'), {
          statusCode: 403,
          code: 'MOCK_PAYMENTS_DISABLED',
        });
      }
      return mockPaymentProvider;
    }
    throw Object.assign(new Error(`Unknown payment provider: ${providerName}`), { statusCode: 400 });
  }

  /** Total stored knowledge text in MB (uploads are kept as extracted text in Postgres). */
  async getStorageUsedMb(companyId: string): Promise<number> {
    const [row] = await db
      .select({ bytes: sql<number>`coalesce(sum(${knowledgeSources.byteSize}), 0)::float8` })
      .from(knowledgeSources)
      .where(eq(knowledgeSources.companyId, companyId));
    return (row?.bytes ?? 0) / BYTES_PER_MB;
  }

  /** Blocks starting a new conversation once the plan's monthly conversation quota is used up. */
  async assertConversationQuota(companyId: string): Promise<void> {
    const overview = await this.getSubscriptionOverview(companyId);
    const { current, limit } = overview.usage.conversations;
    if (current >= limit) {
      throw new PlanLimitError(
        `This assistant has reached its monthly conversation limit (${current}/${limit}).`,
        { resource: 'conversations', current, limit, upgradeUrl: '/subscription' },
      );
    }
  }

  /** Blocks an upload that would push stored knowledge past the plan's storage allowance. */
  async assertStorageQuota(companyId: string, incomingBytes: number): Promise<void> {
    const overview = await this.getSubscriptionOverview(companyId);
    const limit = overview.limits.storageMb;
    const used = await this.getStorageUsedMb(companyId);
    if (used + incomingBytes / BYTES_PER_MB > limit) {
      throw new PlanLimitError(
        `This upload would exceed your plan's storage limit (${used.toFixed(1)} MB used of ${limit} MB).`,
        { resource: 'storage', current: Math.round(used * 10) / 10, limit, upgradeUrl: '/subscription' },
      );
    }
  }

  async getSubscriptionOverview(companyId: string): Promise<SubscriptionOverview> {
    let sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.companyId, companyId),
    });

    if (!sub) {
      const trialPlan = SUBSCRIPTION_PLANS.trial!;
      try {
        const [newSub] = await db
          .insert(subscriptions)
          .values({
            companyId,
            plan: 'trial',
            status: 'trial',
            billingCycle: 'monthly',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
            limits: trialPlan.limits as unknown as PlanLimits,
            leadCreditsBalance: 25,
          })
          .returning();
        sub = newSub!;
      } catch {
        // Fallback in-memory trial subscription if company row does not exist in DB (e.g. test suites)
        sub = {
          id: 'temp-sub-' + companyId,
          companyId,
          plan: 'trial',
          status: 'trial',
          billingCycle: 'monthly',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          limits: trialPlan.limits as unknown as PlanLimits,
          leadCreditsBalance: 25,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          razorpayCustomerId: null,
          razorpaySubscriptionId: null,
          cancelAtPeriodEnd: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as unknown as typeof subscriptions.$inferSelect;
      }
    }

    const activeSub = sub!;
    const planTier = (activeSub.plan as PlanTier) || 'trial';
    const planDef = SUBSCRIPTION_PLANS[planTier] || SUBSCRIPTION_PLANS.trial!;
    const limits = planDef.limits;

    // Calculate live usage
    const botCount = (
      await db.query.chatbots.findMany({
        where: and(eq(chatbots.companyId, companyId), isNull(chatbots.deletedAt)),
        columns: { id: true },
      })
    ).length;

    const userCount = (
      await db.query.users.findMany({
        where: and(eq(users.companyId, companyId), isNull(users.deletedAt)),
        columns: { id: true },
      })
    ).length;

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const convCount = (
      await db.query.conversations.findMany({
        where: and(eq(conversations.companyId, companyId), gte(conversations.createdAt, startOfMonth)),
        columns: { id: true },
      })
    ).length;

    const waCount = (
      await db.query.whatsappConfigs.findMany({
        where: and(eq(whatsappConfigs.companyId, companyId), eq(whatsappConfigs.status, 'connected')),
        columns: { id: true },
      })
    ).length;

    const storageUsedMb = await this.getStorageUsedMb(companyId);

    const usage = {
      chatbots: {
        current: botCount,
        limit: limits.chatbots,
        percentage: Math.min(100, Math.round((botCount / limits.chatbots) * 100)),
      },
      conversations: {
        current: convCount,
        limit: limits.conversationsPerMonth,
        percentage: Math.min(100, Math.round((convCount / limits.conversationsPerMonth) * 100)),
      },
      aiTokens: {
        current: Math.round(convCount * 320),
        limit: limits.aiTokensPerMonth,
        percentage: Math.min(
          100,
          Math.round(((convCount * 320) / limits.aiTokensPerMonth) * 100),
        ),
      },
      users: {
        current: userCount,
        limit: limits.users,
        percentage: Math.min(100, Math.round((userCount / limits.users) * 100)),
      },
      whatsappNumbers: {
        current: waCount,
        limit: limits.whatsappNumbers,
        percentage:
          limits.whatsappNumbers > 0
            ? Math.min(100, Math.round((waCount / limits.whatsappNumbers) * 100))
            : 0,
      },
      storageMb: {
        current: Math.round(storageUsedMb * 10) / 10,
        limit: limits.storageMb,
        percentage: Math.min(100, Math.round((storageUsedMb / limits.storageMb) * 100)),
      },
    };

    return {
      plan: planTier,
      planName: planDef.name,
      status: activeSub.status as 'active' | 'trial' | 'past_due' | 'canceled',
      billingCycle: (activeSub.billingCycle as BillingCycle) || 'monthly',
      currentPeriodStart: activeSub.currentPeriodStart?.toISOString() ?? null,
      currentPeriodEnd: activeSub.currentPeriodEnd?.toISOString() ?? null,
      leadCreditsBalance: activeSub.leadCreditsBalance,
      limits,
      usage,
    };
  }

  async createCheckoutSession(companyId: string, input: CheckoutSessionInput) {
    const billingCycle = input.billingCycle || 'monthly';
    const provider = this.getProvider(input.provider ?? (process.env.NODE_ENV === 'production' ? 'stripe' : undefined));
    const session = await provider.createCheckoutSession({
      companyId,
      plan: input.plan,
      billingCycle,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
    });

    // Dev/mock mode only (getProvider already refuses 'mock' in production): immediately switch plan
    if (!input.provider || input.provider === 'mock') {
      await this.applyPlanUpgrade(
        companyId,
        input.plan,
        billingCycle,
        'mock',
        session.sessionId,
      );
    }

    return session;
  }

  async applyPlanUpgrade(
    companyId: string,
    plan: PlanTier,
    billingCycle: BillingCycle = 'monthly',
    provider = 'mock',
    providerInvoiceId?: string,
    paidAmount?: number,
  ) {
    const planDef = SUBSCRIPTION_PLANS[plan] || SUBSCRIPTION_PLANS.starter!;
    const periodDays = billingCycle === 'annual' ? 365 : 30;
    const now = new Date();
    const periodEnd = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000);
    const amount =
      paidAmount ??
      (billingCycle === 'annual' ? planDef.priceInrAnnually * 100 : planDef.priceInrMonthly * 100);

    let sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.companyId, companyId),
    });

    if (sub) {
      await db
        .update(subscriptions)
        .set({
          plan,
          status: 'active',
          billingCycle,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          limits: planDef.limits as unknown as PlanLimits,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, sub.id));
    } else {
      const [newSub] = await db
        .insert(subscriptions)
        .values({
          companyId,
          plan,
          status: 'active',
          billingCycle,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          limits: planDef.limits as unknown as PlanLimits,
          leadCreditsBalance: 100,
        })
        .returning();
      sub = newSub!;
    }

    await db.update(companies).set({ plan, updatedAt: now }).where(eq(companies.id, companyId));

    // Create invoice record
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
    const profile = await paymentsService.getProfile(companyId);
    const gst = computeGst(amount, profile.stateCode);
    await db.insert(subscriptionInvoices).values({
      taxAmount: gst.totalTaxMinor,
      taxBreakdown: gst,
      billingSnapshot: { legalName: profile.legalName, gstin: profile.gstin, stateCode: profile.stateCode, address: profile.address },
      companyId,
      subscriptionId: sub.id,
      invoiceNumber,
      amount,
      currency: 'INR',
      status: 'paid',
      provider,
      providerInvoiceId: providerInvoiceId || `inv_${Date.now()}`,
      paidAt: now,
      pdfUrl: `/api/subscription/invoices/${invoiceNumber}/pdf`,
    });

    await auditService.log({
      companyId,
      action: 'subscription_upgraded',
      resourceType: 'subscription',
      resourceId: sub.id,
      details: { plan, billingCycle, amount, invoiceNumber },
    });

    await paymentsService.clearPastDue(companyId);
    return { success: true, plan, invoiceNumber };
  }

  async cancelSubscription(companyId: string, actorId?: string) {
    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.companyId, companyId),
    });
    if (!sub) throw new Error('Subscription not found.');

    await db
      .update(subscriptions)
      .set({ status: 'canceled', updatedAt: new Date() })
      .where(eq(subscriptions.id, sub.id));

    await auditService.log({
      companyId,
      userId: actorId,
      action: 'subscription_canceled',
      resourceType: 'subscription',
      resourceId: sub.id,
    });

    // Stop the recurring charge at the provider too, otherwise the customer keeps being billed
    const stripeSub = await paymentsService.stripeSubscriptionOf(companyId);
    if (stripeSub && stripeConfigured()) await stripeProvider.cancelSubscription(stripeSub);

    return { success: true, message: 'Subscription canceled successfully.' };
  }

  async getInvoices(companyId: string, filter: SubscriptionInvoiceFilter) {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 10;
    const offset = (page - 1) * limit;

    const conditions = [eq(subscriptionInvoices.companyId, companyId)];
    if (filter.status && filter.status !== 'all') {
      conditions.push(eq(subscriptionInvoices.status, filter.status));
    }

    const whereClause = and(...conditions);

    const invoices = await db.query.subscriptionInvoices.findMany({
      where: whereClause,
      orderBy: [desc(subscriptionInvoices.createdAt)],
      limit,
      offset,
    });

    const allMatching = await db.query.subscriptionInvoices.findMany({
      where: whereClause,
      columns: { id: true },
    });

    return {
      invoices,
      pagination: {
        page,
        limit,
        total: allMatching.length,
        totalPages: Math.ceil(allMatching.length / limit),
      },
    };
  }

  async purchaseLeadCredits(
    companyId: string,
    input: PurchaseLeadCreditsInput,
    actorId?: string,
  ) {
    let sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.companyId, companyId),
    });
    if (!sub) {
      await this.getSubscriptionOverview(companyId);
      sub = (await db.query.subscriptions.findFirst({
        where: eq(subscriptions.companyId, companyId),
      }))!;
    }

    const newBalance = sub.leadCreditsBalance + input.credits;
    await db
      .update(subscriptions)
      .set({ leadCreditsBalance: newBalance, updatedAt: new Date() })
      .where(eq(subscriptions.id, sub.id));

    await db.insert(leadCreditTransactions).values({
      companyId,
      amount: input.credits,
      balanceAfter: newBalance,
      type: 'purchase',
      description: `Purchased ${input.credits} lead delivery credits`,
      referenceId: `credit_order_${Date.now()}`,
    });

    await auditService.log({
      companyId,
      userId: actorId,
      action: 'lead_credits_purchased',
      resourceType: 'lead_credits',
      details: { creditsPurchased: input.credits, newBalance },
    });

    return {
      success: true,
      creditsAdded: input.credits,
      newBalance,
    };
  }

  async deductLeadCredit(
    companyId: string,
    leadId: string,
    amount = 1,
    description = 'Qualified lead delivery to client',
  ) {
    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.companyId, companyId),
    });
    if (!sub) return { success: false, reason: 'No subscription record found' };

    if (sub.leadCreditsBalance < amount) {
      return { success: false, reason: 'INSUFFICIENT_CREDITS' };
    }

    const newBalance = sub.leadCreditsBalance - amount;
    await db
      .update(subscriptions)
      .set({ leadCreditsBalance: newBalance, updatedAt: new Date() })
      .where(eq(subscriptions.id, sub.id));

    await db.insert(leadCreditTransactions).values({
      companyId,
      amount: -amount,
      balanceAfter: newBalance,
      type: 'consumption',
      description,
      referenceId: leadId,
    });

    return { success: true, newBalance };
  }

  async getLeadCreditTransactions(companyId: string) {
    return await db.query.leadCreditTransactions.findMany({
      where: eq(leadCreditTransactions.companyId, companyId),
      orderBy: [desc(leadCreditTransactions.createdAt)],
      limit: 50,
    });
  }

  /**
   * `rawPayload` must be the exact request bytes: the signature covers them, so verification can never
   * be done on re-serialised JSON.
   */
  async handleWebhook(providerName: string, rawPayload: Buffer | string, signature: string) {
    const ctx: { recordedId?: string } = {};
    try {
      return await this.handleWebhookInner(providerName, rawPayload, signature, ctx);
    } catch (err) {
      // A failed delivery must be retryable: forget the event we recorded so the provider's redelivery is processed again
      if (ctx.recordedId) await paymentsService.forgetEvent(providerName, ctx.recordedId).catch(() => undefined);
      throw err;
    }
  }

  private async handleWebhookInner(providerName: string, rawPayload: Buffer | string, signature: string, ctx: { recordedId?: string }) {
    const provider = this.getProvider(providerName);
    const isValid = provider.verifyWebhookSignature(rawPayload, signature);
    if (!isValid) {
      throw Object.assign(new Error('Invalid webhook signature'), { statusCode: 401, code: 'INVALID_SIGNATURE' });
    }

    let event: unknown;
    try {
      event = JSON.parse(Buffer.isBuffer(rawPayload) ? rawPayload.toString('utf8') : rawPayload);
    } catch {
      throw Object.assign(new Error('Webhook body is not valid JSON'), { statusCode: 400 });
    }

    const evt = event as { id?: string; type?: string; data?: { object?: Record<string, unknown> } };
    if (providerName === 'stripe' && evt.id) {
      // Providers redeliver: each event id is processed once
      const fresh = await paymentsService.recordEvent('stripe', evt.id, String(evt.type ?? ''), event);
      if (!fresh) return { handled: false, eventType: String(evt.type ?? ''), duplicate: true };
      ctx.recordedId = evt.id;
    }
    if (providerName === 'stripe' && (await paymentsService.handleStripeOrderEvent(evt))) {
      if (evt.id) await paymentsService.finishEvent('stripe', evt.id);
      return { handled: true, eventType: String(evt.type ?? ''), order: true };
    }
    if (providerName === 'stripe' && evt.type === 'invoice.payment_failed') {
      const o = evt.data?.object ?? {};
      const m = ((o.subscription_details as { metadata?: Record<string, string> } | undefined)?.metadata ?? (o.metadata as Record<string, string> | undefined) ?? {});
      if (m.companyId) await paymentsService.markPastDue(m.companyId);
      if (evt.id) await paymentsService.finishEvent('stripe', evt.id);
      return { handled: true, eventType: 'invoice.payment_failed', pastDue: Boolean(m.companyId) };
    }

    const result = await provider.handleWebhookEvent(event);

    // Idempotency: providers retry deliveries; the same invoice must upgrade a plan only once
    if (result.handled && result.providerInvoiceId) {
      const [seen] = await db
        .select({ id: subscriptionInvoices.id })
        .from(subscriptionInvoices)
        .where(
          and(
            eq(subscriptionInvoices.provider, providerName),
            eq(subscriptionInvoices.providerInvoiceId, result.providerInvoiceId),
          ),
        )
        .limit(1);
      if (seen) return { ...result, handled: false, duplicate: true };
    }

    if (providerName === 'stripe' && result.companyId && typeof (evt.data?.object as { subscription?: unknown } | undefined)?.subscription === 'string') {
      await paymentsService.rememberStripeSubscription(result.companyId, (evt.data!.object as { subscription: string }).subscription);
    }
    if (result.handled && result.companyId && result.plan) {
      await this.applyPlanUpgrade(
        result.companyId,
        result.plan,
        result.billingCycle || 'monthly',
        providerName,
        result.providerInvoiceId,
        result.amount,
      );
    }
    if (providerName === 'stripe' && evt.id) await paymentsService.finishEvent('stripe', evt.id);
    return result;
  }
}

export const billingService = new BillingService();
