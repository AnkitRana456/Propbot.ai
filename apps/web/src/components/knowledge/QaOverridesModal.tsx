import React, { useState } from 'react';
import { X, ShieldAlert, Plus, Trash2, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import type { QaOverrideResponse } from '@propbot/shared';

interface QaOverridesModalProps {
  isOpen: boolean;
  onClose: () => void;
  overrides: QaOverrideResponse[];
  onAddOverride: (question: string, answer: string) => Promise<void>;
  onDeleteOverride: (id: string) => Promise<void>;
  prefilledQuestion?: string;
}

export const QaOverridesModal: React.FC<QaOverridesModalProps> = ({
  isOpen,
  onClose,
  overrides,
  onAddOverride,
  onDeleteOverride,
  prefilledQuestion = '',
}) => {
  const [question, setQuestion] = useState(prefilledQuestion);
  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (prefilledQuestion) {
      setQuestion(prefilledQuestion);
    }
  }, [prefilledQuestion]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) {
      setError('Both question and exact answer are required.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await onAddOverride(question.trim(), answer.trim());
      setQuestion('');
      setAnswer('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save override');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDeleteOverride(id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Priority Q&A Overrides</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Exact answers that bypass vector search with immediate 100% confidence
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informational banner */}
        <div className="mx-6 mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
          <span>
            Use overrides to lock in specific executive guidelines, VIP answers, or instant corrections.
            When a visitor asks this question, the AI delivers this exact verified response without model latency.
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* New Override Form */}
          <form onSubmit={handleSubmit} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-emerald-600" />
              Add Direct Override
            </h3>

            {error && <p className="text-xs text-rose-600">{error}</p>}

            <div>
              <input
                type="text"
                placeholder="Trigger Question (e.g. Can we combine two units?)"
                value={question}
                onChange={e => setQuestion(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:border-emerald-500 text-slate-900"
              />
            </div>

            <div>
              <textarea
                rows={2}
                placeholder="Exact Verified Answer..."
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:border-emerald-500 resize-none text-slate-900"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="w-3 h-3 animate-spin" />}
                Save Override
              </button>
            </div>
          </form>

          {/* Existing Overrides List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Active Overrides ({overrides.length})
            </h3>

            {overrides.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 italic text-center">No overrides configured yet.</p>
            ) : (
              <div className="space-y-2">
                {overrides.map(ov => (
                  <div
                    key={ov.id}
                    className="p-3.5 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-colors flex items-start justify-between gap-3 shadow-sm"
                  >
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        {ov.question}
                      </div>
                      <p className="text-xs text-slate-600 pl-5">{ov.answer}</p>
                    </div>

                    <button
                      type="button"
                      disabled={deletingId === ov.id}
                      onClick={() => handleDelete(ov.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0 disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
