import React, { useRef } from 'react';
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
import { PlanComparisonGrid } from '../components/billing/PlanComparisonGrid.js';
import { InvoicesTable } from '../components/billing/InvoicesTable.js';
import { LeadCreditsCard } from '../components/billing/LeadCreditsCard.js';
import type { PlanTier } from '@propbot/shared';

export const SubscriptionPage: React.FC = () => {
  const comparisonRef = useRef<HTMLDivElement>(null);

  const { data: overview } = useSubscriptionOverview();
  const { data: invoicesData, isLoading: isLoadingInvoices } = useInvoices();
  const { data: creditTransactions = [] } = useLeadCreditTransactions();

  const checkoutMutation = useCreateCheckoutMutation();
  const cancelMutation = useCancelSubscriptionMutation();
  const purchaseCreditsMutation = usePurchaseCreditsMutation();

  const scrollToPlans = () => {
    comparisonRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSelectPlan = async (plan: PlanTier, cycle: 'monthly' | 'annual') => {
    try {
      await checkoutMutation.mutateAsync({
        plan,
        billingCycle: cycle,
        provider: 'mock',
      });
      alert(`Plan successfully transitioned to ${plan.toUpperCase()}!`);
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to initiate plan upgrade.');
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
    <div className="p-6 max-w-7xl mx-auto space-y-8">
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

      {/* 4. Plan Selection Grid */}
      <div ref={comparisonRef} className="space-y-4 pt-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Choose Your Plan</h2>
          <p className="text-xs text-slate-500">
            Scale seamlessly as your project portfolio and buyer conversation volume expands
          </p>
        </div>
        <PlanComparisonGrid
          currentPlan={overview?.plan}
          onSelectPlan={handleSelectPlan}
          isLoading={checkoutMutation.isPending}
        />
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
