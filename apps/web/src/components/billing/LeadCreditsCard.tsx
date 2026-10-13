import React, { useState } from 'react';
import { Coins, Plus, History, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { LeadCreditTransactionRecord } from '@propbot/shared';

interface LeadCreditsCardProps {
  balance?: number;
  credits?: number;
  transactions?: LeadCreditTransactionRecord[];
  onPurchase?: (credits: number) => Promise<unknown>;
  onPurchaseCredits?: (credits: number) => Promise<unknown>;
  isPurchasing?: boolean;
}

export const LeadCreditsCard: React.FC<LeadCreditsCardProps> = ({
  balance = 0,
  credits,
  transactions = [],
  onPurchase,
  onPurchaseCredits,
}) => {
  const effectiveBalance = credits !== undefined ? credits : balance;
  const effectivePurchase = onPurchase || onPurchaseCredits || (async () => {});
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [selectedPack, setSelectedPack] = useState(100);
  const [isPurchasing, setIsPurchasing] = useState(false);

  const packs = [
    { credits: 50, priceInr: 999, label: '50 Leads (₹20/lead)' },
    { credits: 100, priceInr: 1799, label: '100 Leads (₹18/lead)', highlight: true },
    { credits: 500, priceInr: 7499, label: '500 Leads (₹15/lead)' },
  ];

  const handleConfirmPurchase = async () => {
    setIsPurchasing(true);
    try {
      await effectivePurchase(selectedPack);
      alert(`Successfully added ${selectedPack} lead credits!`);
      setIsTopUpOpen(false);
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to purchase lead credits.');
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">Lead Delivery Credits</h3>
            <p className="text-xs text-slate-500">
              Pay-per-qualified-lead delivery balance for reseller and client routing
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-2xl font-black text-slate-900 dark:text-white">{effectiveBalance}</div>
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Credits Available
            </div>
          </div>
          <button
            onClick={() => setIsTopUpOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            Top-Up
          </button>
        </div>
      </div>

      {/* Transaction History */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <History className="w-3.5 h-3.5" />
          Recent Lead Credit Transactions
        </h4>

        {transactions.length === 0 ? (
          <p className="text-xs text-slate-400 py-3">No credit transactions yet.</p>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {transactions.map(tx => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`p-1.5 rounded-lg ${
                      tx.amount > 0
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {tx.amount > 0 ? (
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      {tx.description}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {new Date(tx.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`font-bold ${
                      tx.amount > 0 ? 'text-emerald-600' : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                  </span>
                  <div className="text-[10px] text-slate-400">Bal: {tx.balanceAfter}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top-up Dialog Modal */}
      {isTopUpOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Purchase Lead Credits
            </h3>
            <p className="text-xs text-slate-500">
              Credits never expire and are consumed automatically as qualified buyer leads are delivered.
            </p>

            <div className="space-y-2 pt-2">
              {packs.map(pack => (
                <button
                  key={pack.credits}
                  type="button"
                  onClick={() => setSelectedPack(pack.credits)}
                  className={`w-full p-3 rounded-xl border text-left text-xs transition-all flex items-center justify-between ${
                    selectedPack === pack.credits
                      ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 text-slate-900 dark:text-white font-semibold'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{pack.label}</span>
                  <span className="font-bold">₹{pack.priceInr.toLocaleString()}</span>
                </button>
              ))}
            </div>

            <div className="pt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsTopUpOpen(false)}
                className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPurchase}
                disabled={isPurchasing}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg shadow-sm transition-all"
              >
                {isPurchasing ? 'Processing...' : 'Confirm & Purchase'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
