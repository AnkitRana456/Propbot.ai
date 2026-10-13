import React, { useState } from 'react';
import { RefreshCw, FileText } from 'lucide-react';
import { useAuditLogs } from '../../services/users.service.js';
import type { AuditLogRecord } from '@propbot/shared';

export const AuditLogsTab: React.FC = () => {
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');

  const { data, isLoading, refetch, isFetching } = useAuditLogs({
    action: actionFilter || undefined,
    resourceType: resourceFilter || undefined,
    limit: 25,
  });

  const logs = data?.data || [];

  const getActionBadge = (action: string) => {
    if (action.includes('delete') || action.includes('revoke')) {
      return 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300';
    }
    if (action.includes('role') || action.includes('upgrade') || action.includes('2fa')) {
      return 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300';
    }
    if (action.includes('invite') || action.includes('create')) {
      return 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300';
    }
    return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  };

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <input
              type="text"
              placeholder="Filter by action (e.g. role_changed)..."
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
          <div className="relative flex-1 sm:w-48">
            <input
              type="text"
              placeholder="Resource (e.g. user)..."
              value={resourceFilter}
              onChange={e => setResourceFilter(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh Trail
        </button>
      </div>

      {/* Logs Table */}
      {isLoading ? (
        <div className="p-8 text-center text-slate-500">Loading audit trail...</div>
      ) : logs.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-slate-600 dark:text-slate-400 font-medium">No audit events recorded.</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Sensitive actions like role changes, exports, and approvals will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-5 py-3">Timestamp</th>
                <th className="px-5 py-3">Actor</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Resource</th>
                <th className="px-5 py-3">Details</th>
                <th className="px-5 py-3">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-[11px]">
              {logs.map((log: AuditLogRecord) => (
                <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-slate-800 dark:text-slate-200 font-sans">
                    {log.userName || 'System / Anonymous'}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium ${getActionBadge(
                        log.action,
                      )}`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-400">
                    {log.targetType}
                  </td>
                  <td className="px-5 py-3 text-slate-500 max-w-xs truncate font-sans">
                    {JSON.stringify(log.details)}
                  </td>
                  <td className="px-5 py-3 text-slate-400">{log.ipAddress || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
