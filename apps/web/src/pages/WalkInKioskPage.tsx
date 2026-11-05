import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Building2, CheckCircle2, MapPin, Users } from 'lucide-react';
import { apiRequest } from '../services/api-client.js';

interface KioskInfo { name: string; sourceType: string }
interface FormState { fullName: string; phone: string; email: string; projectInterest: string }

const FIELD_CLS = 'h-12 w-full rounded-xl border border-border bg-bg px-4 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-shadow';

export const WalkInKioskPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();

  const utmParams = useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid'];
    const result: Record<string, string> = {};
    for (const k of keys) { const v = p.get(k); if (v) result[k] = v; }
    return Object.keys(result).length ? result : undefined;
  }, []);

  const [kiosk, setKiosk] = useState<KioskInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ fullName: '', phone: '', email: '', projectInterest: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    apiRequest<KioskInfo>(`/api/public/walk-in/${token}`)
      .then(setKiosk)
      .catch((e: Error) => setLoadError(e.message));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      await apiRequest(`/api/public/walk-in/${token}`, {
        method: 'POST',
        body: JSON.stringify({
          name: form.fullName.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || undefined,
          projectInterest: form.projectInterest.trim() || undefined,
          utmParams,
          referrerUrl: document.referrer || undefined,
          landingPage: window.location.href,
          userAgent: navigator.userAgent,
        }),
      });
      setSubmitted(true);
    } catch (err) {
      setSubmitError((err as Error).message || 'Could not save your details. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg p-8 text-center">
        <div>
          <p className="text-2xl font-bold text-text">Kiosk unavailable</p>
          <p className="mt-2 text-text-muted">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!kiosk) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-bg to-bg dark:from-emerald-950/30 dark:via-bg dark:to-bg flex items-center justify-center p-8">
        <div className="max-w-sm w-full text-center rounded-3xl bg-surface p-10 border border-border shadow-2xl">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
            <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-text">Welcome!</h1>
          <p className="mt-3 text-sm text-text-muted leading-relaxed">
            Your details have been saved. Our team will be with you shortly.
          </p>
          <button
            onClick={() => { setSubmitted(false); setForm({ fullName: '', phone: '', email: '', projectInterest: '' }); }}
            className="mt-7 w-full rounded-xl bg-accent py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            Register Another Visitor
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left hero panel */}
      <div className="lg:w-2/5 relative overflow-hidden bg-gradient-to-br from-accent via-indigo-700 to-indigo-900 flex flex-col items-center justify-center p-10 text-white min-h-[260px] lg:min-h-screen">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 80%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '48px 48px' }}
        />
        <div className="relative z-10 text-center max-w-xs">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20">
            <Building2 className="h-8 w-8" />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60 mb-2">{kiosk.name}</p>
          <h1 className="text-3xl sm:text-4xl font-black leading-tight">Welcome to Our Site Office</h1>
          <p className="mt-3 text-sm text-white/70 leading-relaxed">
            Please register your details so our property consultants can personalise your experience.
          </p>
          <div className="mt-8 flex flex-col gap-2 text-xs text-white/60">
            <div className="flex items-center gap-2 justify-center">
              <MapPin className="h-3.5 w-3.5" />
              <span>Exclusive site visit experience</span>
            </div>
            <div className="flex items-center gap-2 justify-center">
              <Users className="h-3.5 w-3.5" />
              <span>Dedicated property consultant assigned</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center bg-bg p-8">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-text">Your Details</h2>
            <p className="text-sm text-text-muted mt-1">Quick registration — takes under a minute.</p>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-text-muted uppercase tracking-wider">Full name *</label>
              <input
                required
                value={form.fullName}
                onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                placeholder="Arjun Kapoor"
                className={FIELD_CLS}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-text-muted uppercase tracking-wider">Phone *</label>
              <input
                required
                type="tel"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+91 98765 43210"
                className={FIELD_CLS}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-text-muted uppercase tracking-wider">Email <span className="text-text-muted normal-case font-normal">(optional)</span></label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="arjun@example.com"
                className={FIELD_CLS}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-text-muted uppercase tracking-wider">Project of interest <span className="text-text-muted normal-case font-normal">(optional)</span></label>
              <input
                value={form.projectInterest}
                onChange={e => setForm(f => ({ ...f, projectInterest: e.target.value }))}
                placeholder="e.g. Tower A, 3 BHK"
                className={FIELD_CLS}
              />
            </div>

            {submitError && (
              <p role="alert" className="rounded-xl bg-danger/10 px-4 py-2.5 text-sm text-danger border border-danger/20">
                {submitError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 h-13 w-full rounded-xl bg-accent text-sm font-bold text-white shadow-lg shadow-accent/20 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Register & Continue →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default WalkInKioskPage;
