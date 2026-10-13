import React, { useState } from 'react';
import { X, Phone, Clock, FileText, CheckCircle2 } from 'lucide-react';

interface ManualCallLogModalProps {
  leadId: string;
  leadName?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ManualCallLogModal: React.FC<ManualCallLogModalProps> = ({
  leadId,
  leadName,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [direction, setDirection] = useState<'outbound_manual' | 'inbound'>('outbound_manual');
  const [durationMinutes, setDurationMinutes] = useState<number>(3);
  const [durationSeconds, setDurationSeconds] = useState<number>(0);
  const [outcome, setOutcome] = useState<
    'interested' | 'callback_requested' | 'visit_booked' | 'not_interested' | 'wrong_number' | 'no_answer'
  >('interested');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!notes.trim()) {
      setError('Please enter call notes or discussion summary.');
      return;
    }

    setSubmitting(true);
    const totalSeconds = durationMinutes * 60 + durationSeconds;

    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch('/api/voice/manual-log', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          leadId,
          direction,
          durationSeconds: totalSeconds,
          status: 'completed',
          outcome,
          notes: notes.trim(),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error?.message || 'Failed to log call');
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Log Agent Call
              </h3>
              <p className="text-xs text-slate-500">
                Record offline phone interaction for {leadName || 'Lead'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}

          {/* Call Direction */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Call Direction
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDirection('outbound_manual')}
                className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition ${
                  direction === 'outbound_manual'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                Outbound (Agent to Lead)
              </button>
              <button
                type="button"
                onClick={() => setDirection('inbound')}
                className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition ${
                  direction === 'inbound'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                Inbound (Lead to Agent)
              </button>
            </div>
          </div>

          {/* Call Duration */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Duration (Minutes & Seconds)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  type="number"
                  min="0"
                  max="240"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="Minutes"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Minutes</span>
              </div>
              <div>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={durationSeconds}
                  onChange={(e) => setDurationSeconds(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                  placeholder="Seconds"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Seconds</span>
              </div>
            </div>
          </div>

          {/* Call Outcome */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Outcome
            </label>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as 'interested' | 'callback_requested' | 'visit_booked' | 'not_interested' | 'wrong_number' | 'no_answer')}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="interested">Interested / High Intent</option>
              <option value="visit_booked">Site Visit Booked</option>
              <option value="callback_requested">Callback Requested</option>
              <option value="not_interested">Not Interested</option>
              <option value="wrong_number">Wrong Number / Invalid</option>
              <option value="no_answer">No Answer / Ringing</option>
            </select>
          </div>

          {/* Notes / Summary */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Call Notes & Key Takeaways
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Discussed 3BHK flat in Sarjapur, budget confirmed at 2.5 Cr. Wants site visit this Saturday at 11 AM."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white resize-none"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center gap-1.5 shadow-sm"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {submitting ? 'Saving...' : 'Save Call to CRM'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
