import React, { useState } from 'react';
import { X, Star, ThumbsUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useSubmitSurvey } from '../../services/appointments.service.js';
import type { AppointmentItem } from '@propbot/shared';

interface AppointmentSurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: AppointmentItem | null;
}

export const AppointmentSurveyModal: React.FC<AppointmentSurveyModalProps> = ({
  isOpen,
  onClose,
  appointment,
}) => {
  const submitSurveyMutation = useSubmitSurvey();
  const [rating, setRating] = useState<number>(5);
  const [interestedInBooking, setInterestedInBooking] = useState<'yes' | 'maybe' | 'no'>('yes');
  const [feedback, setFeedback] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen || !appointment) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointment.surveyToken) {
      setErrorMsg('This appointment does not have a survey token assigned.');
      return;
    }

    try {
      setErrorMsg(null);
      await submitSurveyMutation.mutateAsync({
        token: appointment.surveyToken,
        input: {
          rating,
          feedback: feedback.trim() || undefined,
          interestedInBooking,
        },
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1200);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit survey';
      setErrorMsg(message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
              <Star className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Post-Visit Survey</h3>
              <p className="text-xs text-slate-500">
                Visitor: <span className="font-medium text-slate-700 dark:text-slate-300">{appointment.leadName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {success ? (
          <div className="py-8 text-center animate-in fade-in">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <h4 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">Survey Recorded!</h4>
            <p className="text-xs text-slate-500 mt-1">
              Lead intent score and CRM timeline have been updated.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {errorMsg && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Star Rating */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Overall Visit Experience Rating (1–5 Stars)
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-1 text-amber-400 hover:scale-110 transition-transform"
                  >
                    <Star
                      className={`h-7 w-7 ${
                        star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-700'
                      }`}
                    />
                  </button>
                ))}
                <span className="ml-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  {rating} of 5
                </span>
              </div>
            </div>

            {/* Interested in Booking */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Is the client interested in proceeding with booking?
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['yes', 'maybe', 'no'] as const).map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setInterestedInBooking(option)}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 px-3 text-xs font-medium capitalize transition-all ${
                      interestedInBooking === option
                        ? option === 'yes'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                          : option === 'maybe'
                            ? 'border-amber-600 bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                            : 'border-slate-600 bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-800'
                    }`}
                  >
                    {option === 'yes' && <ThumbsUp className="h-3.5 w-3.5" />}
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {/* Free text Feedback */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Client Feedback & Notes
              </label>
              <textarea
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                rows={3}
                placeholder="Client loved the 3BHK corner unit on 14th floor, requested floor plans with East facing layout..."
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-slate-800 dark:bg-slate-800/60 dark:text-white"
              />
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitSurveyMutation.isPending}
                className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-purple-700 disabled:opacity-50"
              >
                {submitSurveyMutation.isPending ? 'Submitting...' : 'Save Survey Feedback'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
