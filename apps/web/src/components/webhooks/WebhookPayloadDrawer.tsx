import React from 'react';
import { X, RotateCw, AlertCircle, Copy, Check } from 'lucide-react';
import type { WebhookLogItem } from '@propbot/shared';

interface WebhookPayloadDrawerProps {
  log: WebhookLogItem | null;
  onClose: () => void;
  onReplay: (logId: string) => void;
  isReplaying?: boolean;
}

export function WebhookPayloadDrawer({
  log,
  onClose,
  onReplay,
  isReplaying,
}: WebhookPayloadDrawerProps) {
  const [copied, setCopied] = React.useState(false);

  if (!log) return null;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(log.requestPayload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 flex justify-end">
      <div className="w-full max-w-xl bg-surface h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-surface-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-blue-100 text-blue-800 font-bold">
                {log.eventType}
              </span>
              <span className="text-xs text-text-muted font-mono">
                {new Date(log.createdAt).toLocaleString()}
              </span>
            </div>
            <h3 className="text-sm font-bold text-text truncate max-w-md">
              {log.endpointName}
            </h3>
            <p className="text-[11px] font-mono text-text-muted truncate max-w-md">
              {log.endpointUrl}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-muted hover:bg-surface-2 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-2 p-3 rounded-lg border border-border">
            <div>
              <span className="text-text-muted block text-[10px] uppercase font-semibold">Status</span>
              <span className="font-bold text-text">
                {log.statusCode ? `${log.statusCode} OK` : log.status}
              </span>
            </div>
            <div>
              <span className="text-text-muted block text-[10px] uppercase font-semibold">Duration</span>
              <span className="font-bold text-text">
                {log.durationMs !== null ? `${log.durationMs} ms` : '—'}
              </span>
            </div>
            <div>
              <span className="text-text-muted block text-[10px] uppercase font-semibold">Attempt</span>
              <span className="font-bold text-text">
                {log.attempt} / {log.maxAttempts}
              </span>
            </div>
            <div>
              <span className="text-text-muted block text-[10px] uppercase font-semibold">Lead</span>
              <span className="font-bold text-text truncate block">
                {log.leadName || '—'}
              </span>
            </div>
          </div>

          {/* Error Message if present */}
          {log.errorMessage && (
            <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-rose-900 mb-0.5">Delivery Error</p>
                <p className="text-[11px] font-mono">{log.errorMessage}</p>
              </div>
            </div>
          )}

          {/* Request Headers */}
          <div>
            <h4 className="text-xs font-bold text-text mb-1.5 uppercase tracking-wider text-[10px]">
              Request Headers (Redacted)
            </h4>
            <pre className="p-3 bg-gray-900 text-gray-100 rounded-lg font-mono text-[11px] overflow-x-auto">
              {JSON.stringify(log.requestHeaders, null, 2)}
            </pre>
          </div>

          {/* Request Payload */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="text-xs font-bold text-text uppercase tracking-wider text-[10px]">
                Request Payload
              </h4>
              <button
                onClick={handleCopyJson}
                className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-semibold"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy JSON'}
              </button>
            </div>
            <pre className="p-3 bg-gray-900 text-emerald-400 rounded-lg font-mono text-[11px] overflow-x-auto max-h-64">
              {JSON.stringify(log.requestPayload, null, 2)}
            </pre>
          </div>

          {/* Response Body */}
          <div>
            <h4 className="text-xs font-bold text-text mb-1.5 uppercase tracking-wider text-[10px]">
              Response Body ({log.statusCode || 'No Status'})
            </h4>
            <pre className="p-3 bg-surface-2 border border-border text-text rounded-lg font-mono text-[11px] overflow-x-auto max-h-48">
              {log.responseBody || '— (Empty response)'}
            </pre>
          </div>
        </div>

        {/* Drawer Footer Actions */}
        <div className="p-4 border-t border-border bg-surface-2 flex items-center justify-between">
          <button
            onClick={() => onReplay(log.id)}
            disabled={isReplaying}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50 text-xs"
          >
            <RotateCw className={`w-4 h-4 ${isReplaying ? 'animate-spin' : ''}`} />
            Replay Webhook
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-surface border border-border font-semibold text-text-muted rounded-lg hover:bg-surface-2 transition text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
