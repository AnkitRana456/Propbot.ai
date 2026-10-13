import React from 'react';
import {
  Dna,
  Home,
  MapPin,
  Clock,
  Wallet,
  Check,
  X,
  AlertTriangle,
  Building2,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import type { BuyerDna } from '@propbot/shared';

interface BuyerDnaCardProps {
  dna: BuyerDna;
}

export const BuyerDnaCard: React.FC<BuyerDnaCardProps> = ({ dna }) => {
  const formatCurrency = (amount: number | null) => {
    if (!amount) return null;
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(2)} Cr`;
    }
    return `₹${(amount / 100000).toFixed(1)} L`;
  };

  const budgetDisplay =
    dna.budgetMin && dna.budgetMax
      ? `${formatCurrency(dna.budgetMin)} - ${formatCurrency(dna.budgetMax)}`
      : dna.budgetMax
        ? `Up to ${formatCurrency(dna.budgetMax)}`
        : dna.budgetMin
          ? `From ${formatCurrency(dna.budgetMin)}`
          : 'Not specified yet';

  const isExplicit = (field: string) => dna.explicitFields?.includes(field);

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-blue-900 to-indigo-900 p-4 text-white shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 backdrop-blur-md">
            <Dna className="h-5 w-5 text-blue-300" />
          </div>
          <div>
            <h4 className="text-sm font-bold tracking-tight">Living Buyer DNA Profile</h4>
            <p className="text-xs text-blue-200">
              Continuously synthesized from conversational interactions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-blue-800/80 px-2.5 py-1 text-[11px] font-semibold text-blue-100">
          <Sparkles className="h-3 w-3 text-amber-300" />
          <span>Real-time AI Active</span>
        </div>
      </div>

      {/* Core Preferences Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {/* Budget */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="flex items-center gap-1 font-medium">
              <Wallet className="h-3.5 w-3.5" /> Budget Range
            </span>
            {isExplicit('budgetMax') && (
              <span title="Confirmed by buyer">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />
              </span>
            )}
          </div>
          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
            {budgetDisplay}
          </p>
        </div>

        {/* BHK */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="flex items-center gap-1 font-medium">
              <Home className="h-3.5 w-3.5" /> Configuration
            </span>
            {isExplicit('bhk') && <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />}
          </div>
          <div className="flex flex-wrap gap-1">
            {dna.bhk && dna.bhk.length > 0 ? (
              dna.bhk.map(b => (
                <span
                  key={b}
                  className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                >
                  {b}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-400 italic">Not stated</span>
            )}
          </div>
        </div>

        {/* Property Type */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="flex items-center gap-1 font-medium">
              <Building2 className="h-3.5 w-3.5" /> Property Type
            </span>
            {isExplicit('propertyType') && <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />}
          </div>
          <p className="text-sm font-bold capitalize text-slate-900 dark:text-white">
            {dna.propertyType || <span className="text-xs text-slate-400 font-normal italic">Flexible</span>}
          </p>
        </div>

        {/* Localities */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="flex items-center gap-1 font-medium">
              <MapPin className="h-3.5 w-3.5" /> Preferred Areas
            </span>
            {isExplicit('localities') && <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />}
          </div>
          <div className="flex flex-wrap gap-1">
            {dna.localities && dna.localities.length > 0 ? (
              dna.localities.map(loc => (
                <span
                  key={loc}
                  className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  {loc}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-400 italic">Exploring any</span>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="flex items-center gap-1 font-medium">
              <Clock className="h-3.5 w-3.5" /> Possession
            </span>
            {isExplicit('timeline') && <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />}
          </div>
          <p className="text-sm font-bold capitalize text-slate-900 dark:text-white">
            {dna.timeline ? dna.timeline.replace('_', ' ') : <span className="text-xs text-slate-400 font-normal italic">Open</span>}
          </p>
        </div>

        {/* Financing */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="flex items-center gap-1 font-medium">
              <Wallet className="h-3.5 w-3.5" /> Financing
            </span>
            {isExplicit('financing') && <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />}
          </div>
          <p className="text-sm font-bold capitalize text-slate-900 dark:text-white">
            {dna.financing ? dna.financing.replace('_', ' ') : <span className="text-xs text-slate-400 font-normal italic">Evaluating</span>}
          </p>
        </div>
      </div>

      {/* Must Haves and Deal Breakers */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Must Haves */}
        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-3.5 dark:border-emerald-900/60 dark:bg-emerald-950/20">
          <h5 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 mb-2">
            <Check className="h-4 w-4 text-emerald-600" /> Must-Haves
          </h5>
          <div className="flex flex-wrap gap-1.5">
            {dna.mustHaves && dna.mustHaves.length > 0 ? (
              dna.mustHaves.map((mh, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"
                >
                  <Check className="h-3 w-3" /> {mh}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-400 italic">No specific must-haves noted</span>
            )}
          </div>
        </div>

        {/* Deal Breakers */}
        <div className="rounded-xl border border-rose-200/80 bg-rose-50/40 p-3.5 dark:border-rose-900/60 dark:bg-rose-950/20">
          <h5 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300 mb-2">
            <X className="h-4 w-4 text-rose-600" /> Deal-Breakers
          </h5>
          <div className="flex flex-wrap gap-1.5">
            {dna.dealBreakers && dna.dealBreakers.length > 0 ? (
              dna.dealBreakers.map((db, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800 dark:bg-rose-900/60 dark:text-rose-200"
                >
                  <X className="h-3 w-3" /> {db}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-400 italic">No deal-breakers stated</span>
            )}
          </div>
        </div>
      </div>

      {/* Objections & Competitors */}
      {((dna.objections && dna.objections.length > 0) ||
        (dna.competitorsMentioned && dna.competitorsMentioned.length > 0)) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 dark:border-amber-900/60 dark:bg-amber-950/30">
          <h5 className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" /> Sales Objections & Competitors Mentioned
          </h5>
          <div className="space-y-1.5">
            {dna.objections.map((obj, i) => (
              <div key={i} className="text-xs text-amber-900 dark:text-amber-200 flex items-start gap-1.5">
                <span className="mt-0.5 text-amber-500">&bull;</span>
                <span>{obj}</span>
              </div>
            ))}
            {dna.competitorsMentioned.length > 0 && (
              <div className="mt-2 pt-2 border-t border-amber-200/60 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200">
                <span className="font-semibold">Benchmarking against: </span>
                {dna.competitorsMentioned.join(', ')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
