import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiRequest } from '../services/api-client.js';

interface KioskInfo { name: string; sourceType: string }
interface FormState { fullName: string; phone: string; email: string; projectInterest: string }

export const WalkInKioskPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();

  // Capture UTM params from the URL at mount time
  const utmParams = useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid'];
    const result: Record<string, string> = {};
    for (const k of keys) {
      const v = p.get(k);
      if (v) result[k] = v;
    }
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
      <div className="flex min-h-screen items-center justify-center bg-bg p-8">
        <div className="max-w-md text-center">
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
      <div className="flex min-h-screen items-center justify-center bg-bg p-8">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-3xl">✓</div>
          <h1 className="text-2xl font-bold text-text">Thank you!</h1>
          <p className="mt-2 text-text-muted">Your details have been saved. Our team will be in touch shortly.</p>
          <button
            onClick={() => { setSubmitted(false); setForm({ fullName: '', phone: '', email: '', projectInterest: '' }); }}
            className="mt-6 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
          >
            Register another visitor
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">{kiosk.name}</p>
          <h1 className="mt-2 text-3xl font-bold text-text">Welcome!</h1>
          <p className="mt-1 text-text-muted">Please share your details so we can assist you.</p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-card">
          <div>
            <label className="mb-1 block text-sm font-medium text-text">Full name *</label>
            <input
              required
              value={form.fullName}
              onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
              placeholder="Arjun Kapoor"
              className="h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text">Phone *</label>
            <input
              required
              type="tel"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="+91 98765 43210"
              className="h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="arjun@example.com"
              className="h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text">Project of interest</label>
            <input
              value={form.projectInterest}
              onChange={e => setForm(f => ({ ...f, projectInterest: e.target.value }))}
              placeholder="e.g. Tower A, 3 BHK"
              className="h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>

          {submitError && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{submitError}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="h-12 w-full rounded-lg bg-accent text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Submit →'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default WalkInKioskPage;
