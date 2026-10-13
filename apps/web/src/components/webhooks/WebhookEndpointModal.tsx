import React, { useState } from 'react';
import { X, Plus, Trash2, Send, CheckCircle2, AlertTriangle, Key } from 'lucide-react';
import type { WebhookEndpointItem, CreateWebhookEndpointInput, WebhookEventType } from '@propbot/shared';

interface WebhookEndpointModalProps {
  isOpen: boolean;
  onClose: () => void;
  endpoints: WebhookEndpointItem[];
  onCreate: (input: CreateWebhookEndpointInput) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  onSendTest: (id: string) => Promise<{ success: boolean; statusCode: number | null; durationMs: number; status: string }>;
  isCreating?: boolean;
}

const AVAILABLE_EVENTS: Array<{ id: WebhookEventType; label: string }> = [
  { id: 'lead_captured', label: 'Lead Captured (New Lead)' },
  { id: 'lead_updated', label: 'Lead Updated' },
  { id: 'lead_qualified', label: 'Lead Qualified (Intent ≥ 50)' },
  { id: 'hot_lead', label: 'Hot Lead (Intent ≥ 70)' },
  { id: 'appointment_booked', label: 'Appointment / Visit Booked' },
  { id: 'appointment_changed', label: 'Appointment Changed / Rescheduled' },
  { id: 'brochure_requested', label: 'Brochure Downloaded' },
  { id: 'handoff_requested', label: 'Human Handoff Requested' },
  { id: 'conversation_closed', label: 'Conversation Closed' },
  { id: 'payment_received', label: 'Payment / Token Received' },
];

export function WebhookEndpointModal({
  isOpen,
  onClose,
  endpoints,
  onCreate,
  onDelete,
  onSendTest,
  isCreating,
}: WebhookEndpointModalProps) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('Zapier CRM Hook');
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<WebhookEventType[]>([
    'lead_captured',
    'lead_qualified',
    'hot_lead',
    'appointment_booked',
  ]);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleToggleEvent = (ev: WebhookEventType) => {
    if (selectedEvents.includes(ev)) {
      setSelectedEvents(selectedEvents.filter(e => e !== ev));
    } else {
      setSelectedEvents([...selectedEvents, ev]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setError('URL must start with http:// or https://');
      return;
    }
    if (selectedEvents.length === 0) {
      setError('Please select at least one subscribed event');
      return;
    }

    try {
      await onCreate({
        name,
        url,
        subscribedEvents: selectedEvents,
        headers: {},
        isActive: true,
      });
      setShowForm(false);
      setUrl('');
      setName('Zapier CRM Hook');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create webhook endpoint';
      setError(msg);
    }
  };

  const handleTestPing = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const res = await onSendTest(id);
      setTestResult({
        id,
        success: res.success,
        message: res.success
          ? `Ping success: ${res.statusCode} OK in ${res.durationMs}ms`
          : `Ping failed: ${res.status} (${res.statusCode || 'Timeout'}) in ${res.durationMs}ms`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Test failed';
      setTestResult({ id, success: false, message: msg });
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-gray-200">
        {/* Header */}
        <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gray-50/75">
          <div>
            <h3 className="text-base font-bold text-gray-900">Webhook Endpoints Configuration</h3>
            <p className="text-xs text-gray-500">
              Configure external endpoints to receive real-time signed event dispatches.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Active Endpoints List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Active Endpoints ({endpoints.length})
              </h4>
              {!showForm && (
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Endpoint
                </button>
              )}
            </div>

            {endpoints.length === 0 ? (
              <div className="p-6 bg-gray-50 border border-gray-200 rounded-xl text-center">
                <p className="text-xs text-gray-500 mb-2">No webhook endpoints configured yet.</p>
                <button
                  onClick={() => setShowForm(true)}
                  className="text-xs text-blue-600 font-bold hover:underline"
                >
                  Create your first endpoint
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {endpoints.map(ep => (
                  <div
                    key={ep.id}
                    className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-bold text-gray-900 text-xs block">{ep.name}</span>
                        <span className="text-[11px] font-mono text-gray-600 break-all">{ep.url}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleTestPing(ep.id)}
                          disabled={testingId === ep.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition"
                        >
                          <Send className="w-3 h-3" />
                          {testingId === ep.id ? 'Pinging...' : 'Send Test Event'}
                        </button>
                        <button
                          onClick={() => onDelete(ep.id)}
                          className="p-1 text-gray-400 hover:text-rose-600 transition"
                          title="Delete Endpoint"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1 border-t border-gray-200/60">
                      <div className="flex items-center gap-1 font-mono text-gray-600">
                        <Key className="w-3 h-3 text-gray-400" />
                        Secret: {ep.maskedSecret}
                      </div>
                      <div className="text-gray-500">
                        Subscribed to: {ep.subscribedEvents.length} events
                      </div>
                    </div>

                    {testResult && testResult.id === ep.id && (
                      <div
                        className={`text-xs p-2.5 rounded-lg border flex items-center gap-2 ${
                          testResult.success
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-rose-50 border-rose-200 text-rose-800'
                        }`}
                      >
                        {testResult.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                        <span className="font-mono text-[11px]">{testResult.message}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add New Endpoint Form */}
          {showForm && (
            <form onSubmit={handleSave} className="p-4 bg-blue-50/50 rounded-xl border border-blue-200 space-y-4">
              <div className="flex items-center justify-between border-b border-blue-200 pb-2">
                <h4 className="text-xs font-bold text-blue-900">Configure New Webhook Endpoint</h4>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Cancel
                </button>
              </div>

              {error && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Endpoint Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Zapier Ingestion or Agency CRM"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Destination URL</label>
                <input
                  type="url"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://hooks.zapier.com/hooks/catch/..."
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  required
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  Must be an accessible HTTP/HTTPS URL. Local and private network IP ranges are rejected by SSRF guard.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Subscribed Events ({selectedEvents.length} selected)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-white rounded-lg border border-gray-200">
                  {AVAILABLE_EVENTS.map(ev => (
                    <label key={ev.id} className="flex items-center gap-2 text-xs cursor-pointer text-gray-700 hover:text-gray-900">
                      <input
                        type="checkbox"
                        checked={selectedEvents.includes(ev.id)}
                        onChange={() => handleToggleEvent(ev.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-[11px] font-medium">{ev.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isCreating ? 'Saving...' : 'Save Endpoint'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-gray-300 font-semibold text-gray-700 rounded-lg hover:bg-gray-100 transition text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
