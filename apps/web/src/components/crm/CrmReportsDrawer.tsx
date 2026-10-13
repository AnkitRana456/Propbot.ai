import React from 'react';
import { X, BarChart3, Trophy, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import { useCrmReports } from '../../services/crm.service.js';
import { Skeleton } from '../common/Skeleton.js';

interface CrmReportsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CrmReportsDrawer: React.FC<CrmReportsDrawerProps> = ({ isOpen, onClose }) => {
  const { data: reports, isLoading } = useCrmReports();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-2xl bg-white shadow-2xl dark:bg-slate-900 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/80">
            <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
              <BarChart3 className="h-5 w-5" />
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  CRM Performance & Analytics
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Agent leaderboard, velocity benchmarks & conversion attribution
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-48 w-full rounded-2xl" />
              </div>
            ) : reports ? (
              <>
                {/* Top Metrics Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                    <span className="text-[11px] font-semibold text-slate-500">Overall Conversion</span>
                    <p className="mt-1 text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                      {reports.overallConversionRate}%
                    </p>
                    <span className="text-[10px] text-slate-400">
                      {reports.convertedLeads} / {reports.totalLeads} leads closed
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                    <span className="text-[11px] font-semibold text-slate-500">Avg First Response</span>
                    <p className="mt-1 text-xl font-extrabold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {reports.avgResponseTimeMinutes}m
                    </p>
                    <span className="text-[10px] text-emerald-600 font-semibold">
                      Target: &lt;15m SLA
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                    <span className="text-[11px] font-semibold text-slate-500">AI Qualified Leads</span>
                    <p className="mt-1 text-xl font-extrabold text-purple-600 dark:text-purple-400">
                      {reports.qualifiedLeads}
                    </p>
                    <span className="text-[10px] text-slate-400">
                      High intent readiness
                    </span>
                  </div>
                </div>

                {/* Agent Leaderboard */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-amber-500" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Sales Agent Leaderboard
                    </h4>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 text-[11px] font-bold">
                        <tr>
                          <th className="py-2.5 pl-4 pr-2">Agent</th>
                          <th className="py-2.5 px-2 text-center">Assigned</th>
                          <th className="py-2.5 px-2 text-center">Contacted</th>
                          <th className="py-2.5 px-2 text-center">Converted</th>
                          <th className="py-2.5 pr-4 text-right">Conv. Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {reports.leaderboard.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-slate-400">
                              No agent performance data recorded yet.
                            </td>
                          </tr>
                        ) : (
                          reports.leaderboard.map((agent, idx) => (
                            <tr key={agent.agentId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                              <td className="py-2.5 pl-4 pr-2">
                                <div className="flex items-center gap-2">
                                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                    {idx + 1}
                                  </span>
                                  <div>
                                    <p className="font-bold text-slate-900 dark:text-white">{agent.agentName}</p>
                                    <p className="text-[10px] text-slate-400">{agent.agentEmail}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-2.5 px-2 text-center text-slate-700 dark:text-slate-300 font-semibold">
                                {agent.leadsAssigned}
                              </td>
                              <td className="py-2.5 px-2 text-center text-slate-700 dark:text-slate-300">
                                {agent.leadsContacted}
                              </td>
                              <td className="py-2.5 px-2 text-center text-emerald-600 font-bold">
                                {agent.leadsConverted}
                              </td>
                              <td className="py-2.5 pr-4 text-right font-extrabold text-blue-600 dark:text-blue-400">
                                {agent.conversionRate}%
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Conversion by Source */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Conversion by Ingestion Channel
                    </h4>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(reports.conversionBySource).map(([src, stat]) => (
                      <div
                        key={src}
                        className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold capitalize text-slate-900 dark:text-white">
                            {src}
                          </span>
                          <span className="text-xs font-extrabold text-emerald-600">
                            {stat.rate}% Rate
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                          <span>{stat.total} Total Inquiries</span>
                          <span>{stat.converted} Converted</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Lost Reasons Breakdown */}
                {reports.lostReasons.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-rose-500" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Top Lost Reasons Analysis
                      </h4>
                    </div>

                    <div className="space-y-2">
                      {reports.lostReasons.map(r => (
                        <div
                          key={r.reason}
                          className="flex items-center justify-between rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs dark:border-slate-800"
                        >
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {r.reason}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500">{r.count} leads</span>
                            <span className="rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                              {r.percentage}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
