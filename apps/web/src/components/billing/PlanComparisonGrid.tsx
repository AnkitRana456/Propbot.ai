import React, { useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { SUBSCRIPTION_PLANS, type PlanTier } from '@propbot/shared';

interface PlanComparisonGridProps {
  currentPlan?: PlanTier;
  onSelectPlan: (plan: PlanTier, cycle: 'monthly' | 'annual') => void;
  isLoading?: boolean;
}

export const PlanComparisonGrid: React.FC<PlanComparisonGridProps> = ({
  currentPlan = 'trial',
  onSelectPlan,
  isLoading,
}) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  const plans = Object.values(SUBSCRIPTION_PLANS);

  return (
    <div className="space-y-6">
      {/* Cycle Toggle */}
      <div className="flex items-center justify-center gap-3">
        <span
          className={`text-xs font-semibold ${
            billingCycle === 'monthly' ? 'text-slate-900 dark:text-white' : 'text-slate-500'
          }`}
        >
          Monthly Billing
        </span>
        <button
          onClick={() => setBillingCycle(b => (b === 'monthly' ? 'annual' : 'monthly'))}
          className="w-12 h-6 rounded-full bg-blue-600 p-0.5 transition-colors relative"
        >
          <div
            className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
              billingCycle === 'annual' ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </button>
        <span
          className={`text-xs font-semibold flex items-center gap-1.5 ${
            billingCycle === 'annual' ? 'text-slate-900 dark:text-white' : 'text-slate-500'
          }`}
        >
          Annual Billing
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            Save 17%
          </span>
        </span>
      </div>

      {/* Grid of 4 Plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map(p => {
          const isCurrent = currentPlan === p.id;
          const isHighlight = p.highlight;
          const price =
            billingCycle === 'annual'
              ? Math.round(p.priceInrAnnually / 12)
              : p.priceInrMonthly;

          return (
            <div
              key={p.id}
              className={`rounded-2xl p-6 flex flex-col justify-between transition-all relative ${
                isHighlight
                  ? 'border-2 border-blue-600 dark:border-blue-500 bg-white dark:bg-slate-900 shadow-xl'
                  : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm'
              }`}
            >
              {isHighlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-blue-600 text-white text-[11px] font-bold tracking-wider uppercase flex items-center gap-1 shadow-md">
                  <Sparkles className="w-3 h-3" />
                  Most Popular
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-lg text-slate-900 dark:text-white">{p.name}</h4>
                  {isCurrent && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 min-h-[32px]">{p.tagline}</p>

                <div className="my-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                      {p.id === 'trial'
                        ? 'Free'
                        : p.id === 'enterprise'
                          ? 'Custom'
                          : `₹${price.toLocaleString()}`}
                    </span>
                    {p.id !== 'trial' && p.id !== 'enterprise' && (
                      <span className="text-xs text-slate-500">/mo</span>
                    )}
                  </div>
                  {billingCycle === 'annual' && p.priceInrAnnually > 0 && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      Billed ₹{p.priceInrAnnually.toLocaleString()} annually
                    </p>
                  )}
                </div>

                <div className="space-y-2.5 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>
                      <strong>{p.limits.chatbots}</strong> Active Chatbot
                      {p.limits.chatbots > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>
                      <strong>{p.limits.conversationsPerMonth.toLocaleString()}</strong> Chats / mo
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>
                      <strong>{(p.limits.aiTokensPerMonth / 1_000_000).toFixed(1)}M</strong> AI Tokens
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>
                      <strong>{p.limits.users}</strong> Team Member{p.limits.users > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>
                      <strong>{p.limits.whatsappNumbers}</strong> WhatsApp Number
                      {p.limits.whatsappNumbers > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check
                      className={`w-4 h-4 shrink-0 ${
                        p.limits.features.whiteLabel ? 'text-emerald-500' : 'text-slate-300'
                      }`}
                    />
                    <span className={p.limits.features.whiteLabel ? '' : 'text-slate-400 line-through'}>
                      White-label branding
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check
                      className={`w-4 h-4 shrink-0 ${
                        p.limits.features.workflows ? 'text-emerald-500' : 'text-slate-300'
                      }`}
                    />
                    <span className={p.limits.features.workflows ? '' : 'text-slate-400 line-through'}>
                      Guarded AI workflows
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <button
                  onClick={() => onSelectPlan(p.id as PlanTier, billingCycle)}
                  disabled={isCurrent || isLoading}
                  className={`w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-all ${
                    isCurrent
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-default'
                      : isHighlight
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20'
                        : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100'
                  }`}
                >
                  {isCurrent ? 'Current Plan' : 'Select Plan'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
