import React from 'react';
import { Eye, RotateCw, CheckCircle, AlertCircle, Clock, XCircle } from 'lucide-react';
import type { WebhookLogItem } from '@propbot/shared';

interface WebhookLogTableProps {
  logs: WebhookLogItem[];
  isLoading?: boolean;
  onInspect: (log: WebhookLogItem) => void;
  onReplay: (logId: string) => void;
  isReplaying?: boolean;
}

export function WebhookLogTable({
  logs,
  isLoading,
  onInspect,
  onReplay,
  isReplaying,
}: WebhookLogTableProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
        <p className="text-xs text-gray-500">Loading webhook delivery logs...</p>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-sm font-semibold text-gray-800 mb-1">No webhook delivery logs found</p>
        <p className="text-xs text-gray-500">
          Try adjusting your search filters or check your active endpoint subscriptions.
        </p>
      </div>
    );
  }

  const getStatusBadge = (log: WebhookLogItem) => {
    switch (log.status) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-3 h-3 text-emerald-600" />
            {log.statusCode || 200} OK
          </span>
        );
      case 'retrying':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            Retrying ({log.attempt}/{log.maxAttempts})
          </span>
        );
      case 'dead_letter':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            Dead-Letter ({log.statusCode || 'ERR'})
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            Failed
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50/75 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider">
              <th className="py-3 px-4">Timestamp</th>
              <th className="py-3 px-4">Lead Name</th>
              <th className="py-3 px-4">Chatbot</th>
              <th className="py-3 px-4">Endpoint</th>
              <th className="py-3 px-4">Event</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Duration</th>
              <th className="py-3 px-4">Attempt</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-700">
            {logs.map(log => {
              const dateStr = new Date(log.createdAt).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });

              return (
                <tr key={log.id} className="hover:bg-gray-50/50 transition">
                  <td className="py-3 px-4 text-gray-500 font-mono text-[11px] whitespace-nowrap">
                    {dateStr}
                  </td>
                  <td className="py-3 px-4 font-semibold text-gray-900">
                    {log.leadName || '—'}
                  </td>
                  <td className="py-3 px-4 text-gray-600">
                    {log.chatbotName || 'All Bots'}
                  </td>
                  <td className="py-3 px-4 max-w-[180px] truncate" title={log.endpointUrl}>
                    <div className="font-medium text-gray-900 truncate">{log.endpointName}</div>
                    <div className="text-[10px] text-gray-400 font-mono truncate">{log.endpointUrl}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-gray-100 text-gray-800 border border-gray-200">
                      {log.eventType}
                    </span>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">{getStatusBadge(log)}</td>
                  <td className="py-3 px-4 font-mono text-gray-600 whitespace-nowrap">
                    {log.durationMs !== null ? `${log.durationMs} ms` : '—'}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap text-gray-500 font-medium">
                    Attempt {log.attempt}/{log.maxAttempts}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onInspect(log)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                      >
                        <Eye className="w-3.5 h-3.5 text-gray-500" />
                        Inspect
                      </button>
                      <button
                        onClick={() => onReplay(log.id)}
                        disabled={isReplaying}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition disabled:opacity-50"
                        title="Replay Webhook"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        Replay
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
