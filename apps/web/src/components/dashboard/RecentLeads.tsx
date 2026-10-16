import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { RecentLeadItem } from '@propbot/shared';
import { Sparkles, MessageSquare, Phone, Mail, Clock, ArrowUpRight } from 'lucide-react';
import { Skeleton } from '../common/Skeleton.js';
import { EmptyState } from '../common/EmptyState.js';

interface RecentLeadsProps {
  leads?: RecentLeadItem[];
  isLoading: boolean;
  onSelectLead?: (lead: RecentLeadItem) => void;
}

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  new: {
    label: 'New Lead',
    badgeClass:
      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
  },
  contacted: {
    label: 'Contacted',
    badgeClass:
      'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800',
  },
  qualified: {
    label: 'AI Qualified',
    badgeClass:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
  },
  site_visit_scheduled: {
    label: 'Visit Booked',
    badgeClass:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
  },
  booked: {
    label: 'Unit Booked',
    badgeClass:
      'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-200 dark:border-emerald-700',
  },
};

export const RecentLeads: React.FC<RecentLeadsProps> = ({ leads, isLoading, onSelectLead }) => {
  const navigate = useNavigate();
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-6 w-36 rounded" />
          <Skeleton className="h-4 w-20 rounded" />
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32 rounded" />
                  <Skeleton className="h-3 w-24 rounded" />
                </div>
              </div>
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!leads || leads.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-2 text-base font-bold text-slate-900 dark:text-white">Recent Leads</h3>
        <EmptyState
          title="No leads captured yet"
          description="Embed your chatbot widget or connect WhatsApp to start converting visitors into scored leads."
          actionLabel="View Chatbots"
          onAction={() => {}}
        />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Recent Leads Feed
            </h3>
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Stream
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Real-time intent qualification & Buyer DNA match breakdown
          </p>
        </div>

        <Link
          to="/leads"
          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 cursor-pointer"
        >
          <span>View all leads</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider dark:border-slate-800">
              <th className="pb-3 pl-1">Prospect</th>
              <th className="pb-3 px-3">Intent Score</th>
              <th className="pb-3 px-3">Stage</th>
              <th className="pb-3 px-3">Channel</th>
              <th className="pb-3 pr-1 text-right">Captured</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80 dark:divide-slate-800/80">
            {leads.map(lead => {
              const status = STATUS_CONFIG[lead.status] || {
                label: lead.status,
                badgeClass: 'bg-slate-100 text-slate-700',
              };

              const isHot = lead.intentScore >= 70;
              const isWarm = lead.intentScore >= 35 && lead.intentScore < 70;

              return (
                <tr
                  key={lead.id}
                  onClick={() => (onSelectLead ? onSelectLead(lead) : navigate('/leads'))}
                  className="group cursor-pointer transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                >
                  {/* Lead Info */}
                  <td className="py-3.5 pl-1">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-xs font-bold text-white shadow-sm">
                        {lead.name
                          .split(' ')
                          .map(p => p[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div className="overflow-hidden">
                        <div className="truncate font-semibold text-slate-900 dark:text-white">
                          {lead.name}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          {lead.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {lead.phone}
                            </span>
                          )}
                          {lead.email && (
                            <span className="hidden sm:flex items-center gap-1 truncate max-w-[140px]">
                              <Mail className="h-3 w-3" />
                              {lead.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Intent Score Badge */}
                  <td className="py-3.5 px-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold border ${
                          isHot
                            ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                            : isWarm
                              ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                              : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                        }`}
                      >
                        <Sparkles className="h-3 w-3" />
                        <span>{lead.intentScore}%</span>
                        <span className="text-[10px] uppercase">
                          ({isHot ? 'Hot' : isWarm ? 'Warm' : 'Cold'})
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="py-3.5 px-3">
                    <span
                      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${status.badgeClass}`}
                    >
                      {status.label}
                    </span>
                  </td>

                  {/* Source Channel */}
                  <td className="py-3.5 px-3">
                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
                      <span>{lead.source}</span>
                    </span>
                  </td>

                  {/* Time ago */}
                  <td className="py-3.5 pr-1 text-right text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>
                        {new Date(lead.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
