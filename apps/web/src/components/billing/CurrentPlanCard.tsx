import React from 'react';
import { CreditCard, Calendar, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { SubscriptionOverview } from '@propbot/shared';

interface CurrentPlanCardProps {
  overview?: SubscriptionOverview;
  onUpgradeClick: () => void;
  onCancelClick: () => void;
}

export const CurrentPlanCard: React.FC<CurrentPlanCardProps> = ({
  overview,
  onUpgradeClick,
  onCancelClick,
}) => {
  const isCanceled = overview?.status === 'canceled';
  const isPastDue = overview?.status === 'past_due';

  return (
    <div className="p-6 bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2.5">
          <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
            {overview?.planName || 'Free Trial'} Plan
          </span>
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
              isPastDue
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}
          >
            {isPastDue ? (
              <AlertTriangle className="w-3 h-3" />
            ) : (
              <CheckCircle2 className="w-3 h-3" />
            )}
            {overview?.status || 'active'}
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <h2 className="text-3xl font-extrabold tracking-tight">
            {overview?.plan === 'trial'
              ? 'Free 14-Day Trial'
              : overview?.plan === 'starter'
                ? '₹2,999'
                : overview?.plan === 'growth'
                  ? '₹7,999'
                  : 'Enterprise Tier'}
          </h2>
          {overview?.plan !== 'trial' && overview?.plan !== 'enterprise' && (
            <span className="text-slate-400 text-sm">
              / {overview?.billingCycle === 'annual' ? 'year' : 'month'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-300">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            <span>
              {overview?.currentPeriodEnd
                ? `Renews on ${new Date(overview.currentPeriodEnd).toLocaleDateString()}`
                : 'Active subscription period'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
            <span>Billed {overview?.billingCycle || 'monthly'}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {overview?.plan !== 'enterprise' && (
          <button
            onClick={onUpgradeClick}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-600/30 transition-all text-center"
          >
            Upgrade Plan
          </button>
        )}
        {!isCanceled && overview?.plan !== 'trial' && (
          <button
            onClick={onCancelClick}
            className="px-4 py-2.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition-colors text-center"
          >
            Cancel Subscription
          </button>
        )}
      </div>
    </div>
  );
};
