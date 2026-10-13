import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';

interface LostReasonModalProps {
  isOpen: boolean;
  leadName: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isSubmitting?: boolean;
}

const COMMON_REASONS = [
  'Budget mismatch (Price too high)',
  'Location unsuitable for buyer',
  'Purchased from competitor project',
  'Unresponsive / Ceased communication',
  'Dropped purchase plans / Postponed',
  'Seeking rental accommodation only',
  'Financing / Bank loan rejected',
];

export const LostReasonModal: React.FC<LostReasonModalProps> = ({
  isOpen,
  leadName,
  onClose,
  onConfirm,
  isSubmitting = false,
}) => {
  const [selectedReason, setSelectedReason] = useState(COMMON_REASONS[0]!);
  const [customReason, setCustomReason] = useState('');
  const [isCustom, setIsCustom] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = isCustom ? customReason.trim() : selectedReason;
    if (!finalReason) return;
    onConfirm(finalReason);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <AlertCircle className="h-5 w-5" />
            <h3 className="font-bold text-slate-900 dark:text-white">Mark Lead as Lost</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Please indicate why <span className="font-bold text-slate-900 dark:text-white">{leadName}</span> is being marked as Lost. This information helps refine qualification rules and reports.
          </p>

          <div className="space-y-2">
            {COMMON_REASONS.map(reason => (
              <label
                key={reason}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 text-xs transition-colors ${
                  !isCustom && selectedReason === reason
                    ? 'border-rose-500 bg-rose-50/50 text-rose-900 dark:border-rose-500 dark:bg-rose-950/40 dark:text-rose-200 font-semibold'
                    : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="reason"
                  checked={!isCustom && selectedReason === reason}
                  onChange={() => {
                    setIsCustom(false);
                    setSelectedReason(reason);
                  }}
                  className="text-rose-600 focus:ring-rose-500"
                />
                <span>{reason}</span>
              </label>
            ))}

            <label
              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 text-xs transition-colors ${
                isCustom
                  ? 'border-rose-500 bg-rose-50/50 text-rose-900 dark:border-rose-500 dark:bg-rose-950/40 dark:text-rose-200 font-semibold'
                  : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
              }`}
            >
              <input
                type="radio"
                name="reason"
                checked={isCustom}
                onChange={() => setIsCustom(true)}
                className="text-rose-600 focus:ring-rose-500"
              />
              <span>Other specific reason...</span>
            </label>

            {isCustom && (
              <input
                type="text"
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                placeholder="Enter detailed reason..."
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-rose-500 focus:ring-1 focus:ring-rose-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (isCustom && !customReason.trim())}
              className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50 shadow-sm cursor-pointer"
            >
              {isSubmitting ? 'Updating...' : 'Confirm Lost Status'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
