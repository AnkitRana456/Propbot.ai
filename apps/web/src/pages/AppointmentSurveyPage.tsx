import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Star, CheckCircle2, Building2, AlertCircle } from 'lucide-react';
import { useSubmitSurvey } from '../services/appointments.service.js';

export const AppointmentSurveyPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const submitMutation = useSubmitSurvey();

  const [rating, setRating] = useState<number>(5);
  const [interestedInBooking, setInterestedInBooking] = useState<'yes' | 'maybe' | 'no'>('yes');
  const [feedback, setFeedback] = useState<string>('');
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      setErrorMsg(null);
      await submitMutation.mutateAsync({
        token,
        input: {
          rating,
          feedback: feedback.trim() || undefined,
          interestedInBooking,
        },
      });
      setSubmitted(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit feedback';
      setErrorMsg(message);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-slate-900">Thank You For Your Feedback!</h2>
          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
            Your review has been shared with your dedicated property advisor. We look forward to assisting you on your real estate journey!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-xl border border-slate-100 animate-in fade-in duration-200">
        <div className="text-center pb-6 border-b border-slate-100">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-3">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">How Was Your Site Visit?</h1>
          <p className="text-xs text-slate-500 mt-1">
            Please share your quick 30-second feedback to help us assist you better.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-2xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Star Rating */}
          <div className="text-center">
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Overall Experience Rating
            </label>
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-1 hover:scale-125 transition-transform"
                >
                  <Star
                    className={`h-9 w-9 ${
                      star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                    }`}
                  />
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-400 mt-1.5 block">
              {rating === 5 ? 'Excellent' : rating === 4 ? 'Good' : rating === 3 ? 'Average' : 'Could be better'}
            </span>
          </div>

          {/* Interested in booking */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Are you interested in proceeding with booking or an offer?
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['yes', 'maybe', 'no'] as const).map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setInterestedInBooking(opt)}
                  className={`rounded-2xl border py-3 px-2 text-xs font-semibold capitalize transition-all ${
                    interestedInBooking === opt
                      ? opt === 'yes'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700 shadow-sm'
                        : opt === 'maybe'
                          ? 'border-amber-600 bg-amber-50 text-amber-700 shadow-sm'
                          : 'border-slate-800 bg-slate-100 text-slate-800'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {opt === 'yes' ? 'Yes, interested!' : opt === 'maybe' ? 'Considering' : 'Not suitable'}
                </button>
              ))}
            </div>
          </div>

          {/* Comments */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Any comments, questions, or unit preferences?
            </label>
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              rows={3}
              placeholder="Liked the amenities and clubhouse, would like to see final quotation with payment plan options..."
              className="w-full rounded-2xl border border-slate-200 p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <button
            type="submit"
            disabled={submitMutation.isPending}
            className="w-full rounded-2xl bg-blue-600 py-3 text-xs font-bold text-white shadow-lg shadow-blue-500/25 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
          >
            {submitMutation.isPending ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </form>
      </div>
    </div>
  );
};
