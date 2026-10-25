import React from 'react';
import type { LeadItemResponse } from '@propbot/shared';
import { Building, Clock, Flame } from 'lucide-react';

interface KanbanLeadCardProps {
  lead: LeadItemResponse;
  stageColor: string;
  onClick: () => void;
}

export const KanbanLeadCard: React.FC<KanbanLeadCardProps> = ({
  lead,
  stageColor,
  onClick,
}) => {
  // Days in stage calculation
  const createdDate = new Date(lead.createdAt || Date.now());
  const now = new Date();
  const diffDays = Math.max(1, Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 3600 * 24)));

  // Budget from buyerDna
  const budget = lead.buyerDna?.budgetMax
    ? `₹${(lead.buyerDna.budgetMax / 10000000).toFixed(2)} Cr`
    : lead.buyerDna?.budgetMin
      ? `₹${(lead.buyerDna.budgetMin / 10000000).toFixed(2)} Cr`
      : '₹1.85 Cr';
  const propertyName = lead.buyerDna?.localities?.[0] || null;
  const isHot = (lead.intentScore || 0) >= 70;

  return (
    <div
      onClick={onClick}
      style={{ borderLeftColor: stageColor }}
      className="group relative cursor-pointer rounded-xl border border-slate-200/90 dark:border-slate-800/90 border-l-4 bg-white/95 dark:bg-slate-900/95 p-3.5 backdrop-blur-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover dark:hover:shadow-[0_12px_24px_-6px_rgba(0,0,0,0.5)]"
    >
      {/* Top: Property Thumbnail icon + Buyer Name + Hot Tag */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700/80 border border-slate-200/60 dark:border-slate-700 flex items-center justify-center text-accent shrink-0 shadow-xs">
            <Building className="w-4 h-4 stroke-[1.75]" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-serif text-xs font-bold text-slate-900 dark:text-white group-hover:text-accent dark:group-hover:text-orange-400 transition-colors truncate">
              {lead.name}
            </h4>
            {propertyName && (
              <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
                {propertyName}
              </p>
            )}
          </div>
        </div>

        {isHot && (
          <span className="flex items-center gap-0.5 rounded-full bg-orange-100 dark:bg-orange-950/80 px-1.5 py-0.5 text-[9px] font-bold text-accent dark:text-orange-300 border border-orange-200 dark:border-orange-800 shrink-0 shadow-xs">
            <Flame className="w-2.5 h-2.5 fill-current" />
            <span>Hot</span>
          </span>
        )}
      </div>

      {/* Bottom Ledger: Budget in Mono + Days-in-stage badge */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs font-mono">
        <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums truncate max-w-[120px]">
          {budget}
        </span>
        <div className="flex items-center gap-2">
          {lead.intentScore !== undefined && (
            <span className="text-[10px] font-bold text-accent dark:text-orange-400">
              {lead.intentScore}%
            </span>
          )}
          <span className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700 shrink-0">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>{diffDays}d</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default KanbanLeadCard;
