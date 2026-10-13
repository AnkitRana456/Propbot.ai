import React, { useState } from 'react';
import { X, HelpCircle, Check, Loader2, MessageSquare, ArrowRight } from 'lucide-react';
import type { UnansweredQuestionResponse } from '@propbot/shared';

interface UnansweredInboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  unansweredQuestions: UnansweredQuestionResponse[];
  onResolve: (questionId: string, answer: string) => Promise<void>;
}

export const UnansweredInboxModal: React.FC<UnansweredInboxModalProps> = ({
  isOpen,
  onClose,
  unansweredQuestions,
  onResolve,
}) => {
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleResolveSubmit = async (e: React.FormEvent, questionId: string) => {
    e.preventDefault();
    if (!answer.trim()) {
      setError('Please provide a verified answer to resolve this question.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await onResolve(questionId, answer.trim());
      setSelectedQuestionId(null);
      setAnswer('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resolve question');
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingQuestions = unansweredQuestions.filter(q => q.status === 'pending');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Unanswered Questions Inbox</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Questions asked by prospects that lacked verified knowledge base context
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <p className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {error}
            </p>
          )}

          {pendingQuestions.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">All questions answered!</h3>
              <p className="text-xs text-slate-500">
                Your knowledge base currently has high coverage for all recent visitor queries.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingQuestions.map(item => {
                const isSelected = selectedQuestionId === item.id;
                return (
                  <div
                    key={item.id}
                    className="p-4 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-all space-y-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-slate-900 flex items-center gap-2">
                          <HelpCircle className="w-4 h-4 text-blue-600 shrink-0" />
                          "{item.question}"
                        </div>
                        <div className="text-xs text-slate-500 pl-6 flex items-center gap-3">
                          <span className="font-medium text-slate-700">
                            Frequency: <span className="text-blue-600 font-bold">{item.frequency}x</span>
                          </span>
                          <span>•</span>
                          <span>Last asked: {new Date(item.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {!isSelected && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedQuestionId(item.id);
                            setAnswer('');
                            setError(null);
                          }}
                          className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
                        >
                          Resolve
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {isSelected && (
                      <form
                        onSubmit={e => handleResolveSubmit(e, item.id)}
                        className="pl-6 space-y-2 pt-2 border-t border-slate-100"
                      >
                        <textarea
                          rows={2}
                          autoFocus
                          placeholder="Provide the verified answer to save as permanent Q&A..."
                          value={answer}
                          onChange={e => setAnswer(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-500 resize-none"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedQuestionId(null)}
                            className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {isSubmitting && <Loader2 className="w-3 h-3 animate-spin" />}
                            Save & Close Question
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
