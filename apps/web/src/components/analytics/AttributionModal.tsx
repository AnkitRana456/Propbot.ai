import React, { useState } from 'react';
import { X, Plus, Compass } from 'lucide-react';
import { useAttribution, useCreateCampaignSpend } from '../../services/analytics.service.js';
import type { AnalyticsFilter } from '@propbot/shared';

interface AttributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  filter: AnalyticsFilter;
}

export const AttributionModal: React.FC<AttributionModalProps> = ({ isOpen, onClose, filter }) => {
  const [model, setModel] = useState<'first_touch' | 'last_touch' | 'linear'>('first_touch');
  const [showSpendForm, setShowSpendForm] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [source, setSource] = useState('meta_ads');
  const [spendAmount, setSpendAmount] = useState('25000');
  const [periodStart, setPeriodStart] = useState('2026-10-01');
  const [periodEnd, setPeriodEnd] = useState('2026-10-31');

  const { data: attributionData, isLoading } = useAttribution(model, filter);
  const createSpendMutation = useCreateCampaignSpend();

  if (!isOpen) return null;

  const handleSpendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignName.trim()) return;

    await createSpendMutation.mutateAsync({
      campaignName: campaignName.trim(),
      source,
      spendAmount: parseInt(spendAmount, 10) || 0,
      periodStart,
      periodEnd,
    });
    setShowSpendForm(false);
    setCampaignName('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Multi-Touch Attribution & Campaign ROI
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Compare attribution weighting models and calculate true Cost Per Lead (CPL)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controls */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          {/* Model Selector */}
          <div className="inline-flex rounded-lg bg-slate-200/70 dark:bg-slate-800 p-0.5 text-xs font-semibold">
            <button
              onClick={() => setModel('first_touch')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                model === 'first_touch'
                  ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              First-Touch (100% Entry)
            </button>
            <button
              onClick={() => setModel('last_touch')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                model === 'last_touch'
                  ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Last-Touch (100% Conversion)
            </button>
            <button
              onClick={() => setModel('linear')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                model === 'linear'
                  ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Linear (Equal Weight)
            </button>
          </div>

          <button
            onClick={() => setShowSpendForm(!showSpendForm)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            {showSpendForm ? 'Hide Spend Form' : 'Log Campaign Spend'}
          </button>
        </div>

        {/* Spend Form */}
        {showSpendForm && (
          <form
            onSubmit={handleSpendSubmit}
            className="p-4 bg-emerald-50/30 dark:bg-emerald-950/20 border-b border-emerald-200/50 dark:border-emerald-900/30 grid grid-cols-2 md:grid-cols-5 gap-3 text-xs"
          >
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Campaign Name</label>
              <input
                type="text"
                placeholder="Google_Search_3BHK"
                value={campaignName}
                onChange={e => setCampaignName(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Source</label>
              <select
                value={source}
                onChange={e => setSource(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              >
                <option value="google_ads">Google Ads</option>
                <option value="meta_ads">Meta Ads</option>
                <option value="99acres">99acres</option>
                <option value="magicbricks">MagicBricks</option>
                <option value="housing">Housing.com</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Spend (INR)</label>
              <input
                type="number"
                min="0"
                value={spendAmount}
                onChange={e => setSpendAmount(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Start Date</label>
              <input
                type="date"
                value={periodStart}
                onChange={e => setPeriodStart(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">End Date</label>
              <input
                type="date"
                value={periodEnd}
                onChange={e => setPeriodEnd(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={createSpendMutation.isPending}
                className="w-full py-1.5 font-semibold rounded-md bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
              >
                {createSpendMutation.isPending ? 'Saving...' : 'Save Spend'}
              </button>
            </div>
          </form>
        )}

        {/* Attribution Table */}
        <div className="p-4 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-400">Computing attribution weights...</div>
          ) : !attributionData?.campaigns.length ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No campaign attribution records found for this period. Capture leads from Google/Meta ads or portals to track attribution.
            </div>
          ) : (
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                  <th className="py-2.5 px-3">Campaign / Source</th>
                  <th className="py-2.5 px-3">Channel</th>
                  <th className="py-2.5 px-3 text-right">Visitors</th>
                  <th className="py-2.5 px-3 text-right">Leads</th>
                  <th className="py-2.5 px-3 text-right">Visits</th>
                  <th className="py-2.5 px-3 text-right">Booked</th>
                  <th className="py-2.5 px-3 text-right">Conv %</th>
                  <th className="py-2.5 px-3 text-right">Spend</th>
                  <th className="py-2.5 px-3 text-right">Cost / Lead</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                {attributionData.campaigns.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-sans font-semibold text-slate-800 dark:text-slate-200">
                      {row.campaign}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-500">{row.source}</td>
                    <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                      {row.visitors.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">
                      {row.leads}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                      {row.visitsBooked}
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400 font-bold">
                      {row.dealsClosed}
                    </td>
                    <td className="py-2.5 px-3 text-right text-blue-600 dark:text-blue-400 font-bold">
                      {row.conversionRate}%
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                      {row.spend !== undefined ? `₹${row.spend.toLocaleString()}` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-purple-600 dark:text-purple-400">
                      {row.costPerLead !== undefined ? `₹${row.costPerLead.toLocaleString()}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
