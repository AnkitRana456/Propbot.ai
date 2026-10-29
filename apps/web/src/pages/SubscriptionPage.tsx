import React, { useMemo, useRef, useState } from 'react';
import {
  useSubscriptionOverview,
  useInvoices,
  useCreateCheckoutMutation,
  useCancelSubscriptionMutation,
  usePurchaseCreditsMutation,
  useLeadCreditTransactions,
} from '../services/billing.service.js';
import { CurrentPlanCard } from '../components/billing/CurrentPlanCard.js';
import { UsageMeters } from '../components/billing/UsageMeters.js';
import PricingTicket, { type Plan } from '../components/billing/PricingTicket.js';
import { InvoicesTable } from '../components/billing/InvoicesTable.js';
import { LeadCreditsCard } from '../components/billing/LeadCreditsCard.js';
import { Skeleton } from '../components/common/Skeleton.js';
import { SUBSCRIPTION_PLANS, type PlanTier, type SubscriptionPlanDefinition } from '@propbot/shared';

type Cycle = 'monthly' | 'annual';
const TIERS = Object.values(SUBSCRIPTION_PLANS);
const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const count = (n: number, one: string) => (n >= 999 ? 'Unlimited' : `${n.toLocaleString('en-IN')} ${one}${n === 1 ? '' : 's'}`);

/** A plan as a ticket: price → chats a month, with users and chatbots. The current plan's stub can't be torn. */
const toTicket = (p: SubscriptionPlanDefinition, cycle: Cycle, current?: string): Plan => ({
  id: p.id,
  name: p.name,
  code: p.id.slice(0, 2).toUpperCase(),
  plan: p.name,
  price: p.priceInrMonthly ? inr(cycle === 'annual' ? p.priceInrAnnually : p.priceInrMonthly) : 'Free',
  priceLabel: !p.priceInrMonthly ? '14-day trial' : cycle === 'annual' ? 'Per year' : 'Per month',
  to: p.limits.conversationsPerMonth.toLocaleString('en-IN'),
  toLabel: 'Chats a month',
  seats: count(p.limits.users, 'user'),
  access: count(p.limits.chatbots, 'chatbot'),
  cta: '',
  href: '',
  current: p.id === current,
});

export const SubscriptionPage: React.FC = () => {
  const comparisonRef = useRef<HTMLDivElement>(null);
  const [cycle, setCycle] = useState<Cycle>('monthly');
  // bumping the key prints a fresh ticket on `start` (after a failed claim)
  const [ticket, setTicket] = useState<{ key: number; start?: string }>({ key: 0 });
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const { data: overview, isLoading } = useSubscriptionOverview();
  const { data: invoicesData, isLoading: isLoadingInvoices } = useInvoices();
  const { data: creditTransactions = [] } = useLeadCreditTransactions();

  const checkoutMutation = useCreateCheckoutMutation();
  const cancelMutation = useCancelSubscriptionMutation();
  const purchaseCreditsMutation = usePurchaseCreditsMutation();

  const plans = useMemo(() => TIERS.map(p => toTicket(p, cycle, overview?.plan)), [cycle, overview?.plan]);
  // open on the next tier up from the current plan
  const nextTier = TIERS[TIERS.findIndex(p => p.id === overview?.plan) + 1]?.id ?? overview?.plan;

  const scrollToPlans = () => {
    comparisonRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Tearing a stub switches the plan; if that fails, a fresh stub comes back on the same plan.
  const handleClaim = async (plan: Plan) => {
    setNote(null);
    try {
      await checkoutMutation.mutateAsync({ plan: plan.id as PlanTier, billingCycle: cycle, provider: 'mock' });
      setNote({ ok: true, text: `You're on ${plan.name} now, billed ${cycle}.` });
    } catch (err: unknown) {
      setNote({ ok: false, text: (err as Error).message || 'Failed to initiate plan upgrade.' });
      setTicket(t => ({ key: t.key + 1, start: plan.id }));
    }
  };

  const handleCancelSubscription = async () => {
    if (confirm('Are you sure you want to cancel your recurring subscription? Your access will remain active until the end of the current billing cycle.')) {
      try {
        await cancelMutation.mutateAsync();
        alert('Subscription canceled.');
      } catch (err: unknown) {
        alert((err as Error).message || 'Failed to cancel subscription.');
      }
    }
  };

  const handlePurchaseCredits = async (credits: number) => {
    return await purchaseCreditsMutation.mutateAsync({ credits });
  };

  return (
    <div className="py-6 sm:p-6 max-w-7xl mx-auto space-y-8">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Subscription & Billing
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage your subscription plan, monitor usage meters, purchase lead credits, and review invoices.
        </p>
      </div>

      {/* 1. Current Plan Banner */}
      <CurrentPlanCard
        overview={overview}
        onUpgradeClick={scrollToPlans}
        onCancelClick={handleCancelSubscription}
      />

      {/* 2. Usage Meters */}
      <UsageMeters usage={overview?.usage} />

      {/* 3. Lead Credits Panel */}
      <LeadCreditsCard
        balance={overview?.leadCreditsBalance ?? 0}
        transactions={creditTransactions}
        onPurchase={handlePurchaseCredits}
      />

      {/* 4. Plan Selection Ticket */}
      <div ref={comparisonRef} className="space-y-4 pt-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Choose Your Plan</h2>
            <p className="text-xs text-slate-500">
              Pick a plan, then pull the stub to switch to it
            </p>
          </div>
          <div className="flex rounded-full border border-slate-200 bg-slate-100 p-1 text-xs font-semibold dark:border-slate-800 dark:bg-slate-800" role="radiogroup" aria-label="Billing cycle">
            {(['monthly', 'annual'] as const).map(c => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={cycle === c}
                onClick={() => setCycle(c)}
                className={`rounded-full px-3 py-1.5 capitalize cursor-pointer ${cycle === c ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-500'}`}
              >
                {c}
                {c === 'annual' && <span className="ml-1 text-emerald-600 dark:text-emerald-400">save 17%</span>}
              </button>
            ))}
          </div>
        </div>
        {isLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : (
          <PricingTicket
            key={ticket.key}
            plans={plans}
            start={ticket.start ?? nextTier}
            onClaim={p => void handleClaim(p)}
            backdrop={false}
            page="var(--bg)"
            className="py-2"
          />
        )}
        {note && (
          <p role={note.ok ? 'status' : 'alert'} className={`text-center text-xs ${note.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
            {note.text}
          </p>
        )}
      </div>

      {/* 5. Invoices History Table */}
      <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Billing Invoices</h3>
          <p className="text-xs text-slate-500">
            Download PDF receipts and tax invoices for accounting
          </p>
        </div>
        <InvoicesTable
          invoices={invoicesData?.data || []}
          isLoading={isLoadingInvoices}
        />
      </div>
    </div>
  );
};
