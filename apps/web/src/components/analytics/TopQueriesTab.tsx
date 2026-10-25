import React from 'react';
import type { TopQueriesResponse } from '@propbot/shared';
import { AlertCircle, PlusCircle, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';

interface TopQueriesTabProps {
  topQueries?: TopQueriesResponse;
  isLoading?: boolean;
}

export const TopQueriesTab: React.FC<TopQueriesTabProps> = ({ topQueries, isLoading }) => {
  if (isLoading || !topQueries) {
    return (
      <div className="h-72 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse border border-slate-200 dark:border-slate-800" />
    );
  }

  const { clusters, unanswered } = topQueries;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Clustered Question Themes */}
      <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Most Frequent Question Themes
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Semantic clusters of buyer questions during property consultations
            </p>
          </div>
          <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
            Top Themes
          </span>
        </div>

        <div className="space-y-4">
          {clusters.map((cluster, i) => (
            <div
              key={i}
              className="p-3.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                  {cluster.theme}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                  {cluster.count} inquiries
                </span>
              </div>
              {cluster.sampleQueries[0] && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                  Sample: "{cluster.sampleQueries[0]}"
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Unanswered / Low Confidence Questions */}
      <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              Unanswered Questions Inbox
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Visitor questions where the chatbot lacked confident training data
            </p>
          </div>
          <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
            Action Needed
          </span>
        </div>

        {unanswered.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No unanswered questions! All visitor inquiries were answered from your knowledge base.
          </div>
        ) : (
          <div className="space-y-3">
            {unanswered.map(item => (
              <div
                key={item.id}
                className="p-3.5 rounded-lg border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/20"
              >
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  "{item.query}"
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                  <span>Confidence: {item.confidence ? `${Math.round(item.confidence * 100)}%` : 'Low'}</span>
                  <Link
                    to="/chatbots"
                    className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Add Answer to KB
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
