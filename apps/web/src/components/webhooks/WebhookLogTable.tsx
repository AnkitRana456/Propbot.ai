import React, { useState } from 'react';
import { CheckCircle2, ChevronRight, Clock, Eye, RotateCw, XCircle, AlertCircle } from 'lucide-react';
import type { WebhookLogItem } from '@propbot/shared';
import { Skeleton } from '../common/Skeleton.js';

interface WebhookLogTableProps {
  logs: WebhookLogItem[];
  isLoading?: boolean;
  onInspect: (log: WebhookLogItem) => void;
  onReplay: (logId: string) => void;
  isReplaying?: boolean;
}

/** Delivery status → colour pair reused from the lead status palette so light and dark both pass contrast. */
const STATUS: Record<WebhookLogItem['status'], { key: string; icon: React.ElementType; label: (l: WebhookLogItem) => string }> = {
  success: { key: 'won', icon: CheckCircle2, label: l => `${l.statusCode ?? 200} OK` },
  retrying: { key: 'contacted', icon: Clock, label: l => `Retrying ${l.attempt}/${l.maxAttempts}` },
  dead_letter: { key: 'lost', icon: XCircle, label: l => `Dead letter${l.statusCode ? ` ${l.statusCode}` : ''}` },
  failed: { key: 'lost', icon: AlertCircle, label: l => `Failed${l.statusCode ? ` ${l.statusCode}` : ''}` },
};

const StatusPill: React.FC<{ log: WebhookLogItem }> = ({ log }) => {
  const s = STATUS[log.status];
  const Icon = s.icon;
  return (
    <span style={{ backgroundColor: `var(--status-${s.key}-bg)`, color: `var(--status-${s.key}-fg)` }} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold">
      <Icon aria-hidden className="h-3.5 w-3.5" />
      {s.label(log)}
    </span>
  );
};

const Json: React.FC<{ title: string; value: unknown }> = ({ title, value }) => (
  <div className="min-w-0">
    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">{title}</p>
    <pre tabIndex={0} className="max-h-64 overflow-auto rounded-lg border border-border bg-bg p-3 font-mono text-xs leading-relaxed text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
      {typeof value === 'string' ? value || '(empty)' : JSON.stringify(value, null, 2)}
    </pre>
  </div>
);

export function WebhookLogTable({ logs, isLoading, onInspect, onReplay, isReplaying }: WebhookLogTableProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div role="status" aria-label="Loading webhook logs" className="space-y-2 rounded-xl border border-border bg-surface p-4">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-12 text-center">
        <p className="mb-1 text-sm font-semibold text-text">No deliveries yet</p>
        <p className="text-sm text-text-muted">Adjust the filters, or check that an endpoint is subscribed to events.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left font-mono text-xs">
          <caption className="sr-only">Webhook deliveries, newest first</caption>
          <thead>
            <tr className="border-b border-border bg-surface-2 text-text-muted">
              <th scope="col" className="w-8 px-2 py-3"><span className="sr-only">Expand</span></th>
              {['Time', 'Event', 'Endpoint', 'Status', 'Duration', 'Lead', ''].map((h, i) => (
                <th key={i} scope="col" className="whitespace-nowrap px-3 py-3 font-sans text-xs font-semibold uppercase tracking-wide">
                  {h || <span className="sr-only">Actions</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map(log => {
              const isOpen = expanded === log.id;
              return (
                <React.Fragment key={log.id}>
                  <tr className="border-b border-border-subtle hover:bg-surface-2/60">
                    <td className="px-2 py-2.5">
                      <button type="button" aria-expanded={isOpen} aria-label={`${isOpen ? 'Hide' : 'Show'} payload for ${log.eventType}`} onClick={() => setExpanded(isOpen ? null : log.id)} className="rounded p-1 text-text-muted hover:bg-surface-2 hover:text-text">
                        <ChevronRight aria-hidden className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-text-muted">
                      {new Date(log.createdAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="px-3 py-2.5"><span className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-text">{log.eventType}</span></td>
                    <td className="max-w-[220px] px-3 py-2.5" title={log.endpointUrl}>
                      <span className="block truncate font-sans font-medium text-text">{log.endpointName}</span>
                      <span className="block truncate text-text-muted">{log.endpointUrl}</span>
                    </td>
                    <td className="px-3 py-2.5"><StatusPill log={log} /></td>
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-text-muted">{log.durationMs !== null ? `${log.durationMs} ms` : '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-sans text-text">{log.leadName || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-sans">
                      <button type="button" onClick={() => onInspect(log)} className="mr-1.5 inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-text hover:bg-surface-2">
                        <Eye aria-hidden className="h-3.5 w-3.5" /> Inspect
                      </button>
                      <button type="button" onClick={() => onReplay(log.id)} disabled={isReplaying} className="inline-flex items-center gap-1 rounded-lg border border-accent/30 bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent hover:opacity-90 disabled:opacity-50">
                        <RotateCw aria-hidden className="h-3.5 w-3.5" /> Replay
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-border-subtle bg-surface-2/40">
                      <td />
                      <td colSpan={7} className="p-3">
                        {log.errorMessage && <p role="alert" className="mb-3 rounded-lg bg-danger/10 px-3 py-2 font-sans text-sm text-danger">{log.errorMessage}</p>}
                        <div className="grid gap-3 lg:grid-cols-2">
                          <Json title="Request payload" value={log.requestPayload} />
                          <Json title="Response body" value={log.responseBody ?? ''} />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
