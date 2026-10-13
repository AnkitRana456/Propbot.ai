import React, { useState, useEffect } from 'react';
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  Sparkles,
  Bot,
  AlertCircle,
  Volume2,
  Plus,
} from 'lucide-react';
import { ManualCallLogModal } from './ManualCallLogModal.js';

interface VoiceCallRecord {
  id: string;
  direction: 'outbound_callback' | 'outbound_manual' | 'inbound';
  status: string;
  durationSeconds: number;
  recordingUrl?: string | null;
  transcript?: string | null;
  summary?: string | null;
  sentiment?: 'positive' | 'neutral' | 'negative' | null;
  disclosedAsAi: boolean;
  escalatedToHuman: boolean;
  optedOut: boolean;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

interface LeadCallHistoryTabProps {
  leadId: string;
  leadName?: string;
  phone?: string;
}

export const LeadCallHistoryTab: React.FC<LeadCallHistoryTabProps> = ({
  leadId,
  leadName,
  phone: _phone,
}) => {
  const [calls, setCalls] = useState<VoiceCallRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);
  const [triggeringCallback, setTriggeringCallback] = useState<boolean>(false);
  const [callbackMessage, setCallbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchCalls = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/voice/calls?leadId=${leadId}`, {
        headers,
      });
      if (res.ok) {
        const json = await res.json();
        setCalls(json.data || []);
      }
    } catch {
      setCalls([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (leadId) {
      fetchCalls();
    }
  }, [leadId]);

  const handleTriggerAiCallback = async () => {
    setTriggeringCallback(true);
    setCallbackMessage(null);
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch('/api/voice/callback', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          leadId,
          bypassCallingHours: true, // Manual agent dispatch
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to dispatch voice callback');
      }

      if (json.data?.status === 'initiated') {
        setCallbackMessage({
          type: 'success',
          text: 'AI voice callback dispatched! Disclosing AI identity and dialing prospect now.',
        });
        fetchCalls();
      } else {
        setCallbackMessage({
          type: 'error',
          text: `Callback skipped: ${json.data?.reason || 'Check DND / consent status'}`,
        });
      }
    } catch (err) {
      setCallbackMessage({ type: 'error', text: (err as Error).message });
    } finally {
      setTriggeringCallback(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Phone className="w-4 h-4 text-blue-500" />
            Telecalling & Voice History
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated AI callbacks (with mandatory disclosure) and manual agent logs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsManualModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Log Call
          </button>
          <button
            onClick={handleTriggerAiCallback}
            disabled={triggeringCallback}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition disabled:opacity-50"
          >
            <Bot className="w-3.5 h-3.5" />
            {triggeringCallback ? 'Dialing...' : 'Trigger AI Callback'}
          </button>
        </div>
      </div>

      {callbackMessage && (
        <div
          className={`p-3 text-xs rounded-lg border ${
            callbackMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
              : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
          }`}
        >
          {callbackMessage.text}
        </div>
      )}

      {/* Call Records List */}
      {loading ? (
        <div className="py-12 text-center text-xs text-slate-400">Loading call records...</div>
      ) : calls.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
          <PhoneCall className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No calls recorded yet</p>
          <p className="text-xs text-slate-400 mt-1">
            Trigger an automated callback or log a phone call with this prospect.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {calls.map((call) => (
            <div
              key={call.id}
              className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
            >
              {/* Header row */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {call.direction === 'outbound_callback' ? (
                    <span className="p-1.5 rounded-md bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                      <Bot className="w-3.5 h-3.5" />
                    </span>
                  ) : call.direction === 'inbound' ? (
                    <span className="p-1.5 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                      <PhoneIncoming className="w-3.5 h-3.5" />
                    </span>
                  ) : (
                    <span className="p-1.5 rounded-md bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                      <PhoneOutgoing className="w-3.5 h-3.5" />
                    </span>
                  )}
                  <span className="font-semibold text-slate-900 dark:text-white capitalize">
                    {call.direction.replace('_', ' ')}
                  </span>
                  {call.disclosedAsAi && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" />
                      AI Assistant Disclosed
                    </span>
                  )}
                  {call.escalatedToHuman && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center gap-1">
                      <AlertCircle className="w-2.5 h-2.5" />
                      Price Escalated to Human
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDuration(call.durationSeconds)}
                  </span>
                  <span>{new Date(call.createdAt).toLocaleString()}</span>
                </div>
              </div>

              {/* Summary or notes */}
              {(call.summary || call.transcript) && (
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-700 dark:text-slate-300">
                  <div className="font-semibold text-[11px] text-slate-500 uppercase tracking-wider mb-1">
                    {call.summary ? 'Call Summary' : 'Transcript'}
                  </div>
                  <p>{call.summary || call.transcript}</p>
                </div>
              )}

              {/* Recording Player / Link */}
              {call.recordingUrl && (
                <div className="flex items-center gap-2 pt-1 text-xs">
                  <Volume2 className="w-3.5 h-3.5 text-blue-500" />
                  <audio controls className="h-7 w-full max-w-sm rounded" src={call.recordingUrl}>
                    Your browser does not support audio playback.
                  </audio>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Manual Call Log Modal */}
      <ManualCallLogModal
        leadId={leadId}
        leadName={leadName}
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSuccess={fetchCalls}
      />
    </div>
  );
};
