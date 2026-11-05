import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Star, CheckCircle2, Building2, AlertCircle, Heart } from 'lucide-react';
import { useSubmitSurvey } from '../services/appointments.service.js';

const RATING_LABEL: Record<number, string> = { 1: 'Poor', 2: 'Fair', 3: 'Average', 4: 'Good', 5: 'Excellent!' };

export const AppointmentSurveyPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const submitMutation = useSubmitSurvey();

  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [interestedInBooking, setInterestedInBooking] = useState<'yes' | 'maybe' | 'no'>('yes');
  const [feedback, setFeedback] = useState<string>('');
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      setErrorMsg(null);
      await submitMutation.mutateAsync({ token, input: { rating, feedback: feedback.trim() || undefined, interestedInBooking } });
      setSubmitted(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to submit feedback');
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-bg to-bg dark:from-emerald-950/30 dark:via-bg dark:to-bg flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl bg-surface p-8 text-center shadow-2xl border border-border">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
            <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-text">Thank You!</h2>
          <p className="mt-3 text-sm text-text-muted leading-relaxed">
            Your feedback has been shared with your dedicated property advisor. We look forward to guiding you on your real estate journey.
          </p>
          <div className="mt-6 flex items-center justify-center gap-1 text-xs text-text-muted">
            <Heart className="h-3.5 w-3.5 text-rose-400 fill-rose-400" />
            <span>Powered by PropBot Pro</span>
          </div>
        </div>
      </div>
    );
  }

  const displayRating = hoverRating || rating;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/60 via-bg to-bg dark:from-indigo-950/20 dark:via-bg dark:to-bg flex flex-col items-center justify-center p-4">
      {/* Top branding strip */}
      <div className="mb-6 flex items-center gap-2 text-text-muted">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/10 text-accent">
          <Building2 className="h-4 w-4" />
        </div>
        <span className="text-xs font-semibold uppercase tracking-widest">PropBot Pro</span>
      </div>

      <div className="w-full max-w-lg rounded-3xl bg-surface p-8 shadow-2xl border border-border">
        {/* Header */}
        <div className="text-center pb-6 border-b border-border">
          <h1 className="text-2xl font-bold text-text">How Was Your Site Visit?</h1>
          <p className="text-sm text-text-muted mt-1.5">
            Share your 30-second feedback — it helps us serve you better.
          </p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-6">
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-2xl bg-rose-50 dark:bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Star Rating */}
          <div className="text-center">
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
              Overall Experience
            </label>
            <div className="flex items-center justify-center gap-1.5">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 hover:scale-125 active:scale-110 transition-transform focus:outline-none"
                  aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                >
                  <Star
                    className={`h-10 w-10 transition-colors ${
                      star <= displayRating
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-border fill-transparent'
                    }`}
                  />
                </button>
              ))}
            </div>
            <span className="text-sm font-semibold text-amber-500 dark:text-amber-400 mt-2 block h-5">
              {displayRating ? RATING_LABEL[displayRating] : ''}
            </span>
          </div>

          {/* Interested in booking */}
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
              Interested in proceeding?
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['yes', 'maybe', 'no'] as const).map(opt => {
                const active = interestedInBooking === opt;
                const styles = {
                  yes: active ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 shadow-sm' : 'border-border text-text-muted hover:border-emerald-400',
                  maybe: active ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 shadow-sm' : 'border-border text-text-muted hover:border-amber-400',
                  no: active ? 'border-border bg-surface-2 text-text shadow-sm' : 'border-border text-text-muted hover:bg-surface-2',
                };
                const labels = { yes: '✓ Yes, definitely', maybe: '~ Still deciding', no: '✗ Not for me' };
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setInterestedInBooking(opt)}
                    className={`rounded-2xl border py-3 px-2 text-xs font-semibold transition-all ${styles[opt]}`}
                  >
                    {labels[opt]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Comments */}
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
              Any comments or questions?
            </label>
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              rows={3}
              placeholder="Loved the clubhouse, would like to see the payment plan options..."
              className="w-full rounded-2xl border border-border bg-bg px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitMutation.isPending}
            className="w-full rounded-2xl bg-accent py-3.5 text-sm font-bold text-white shadow-lg shadow-accent/20 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {submitMutation.isPending ? 'Submitting…' : 'Submit Feedback →'}
          </button>
        </form>
      </div>
    </div>
  );
};
