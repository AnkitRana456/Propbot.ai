import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { createDemoRequestSchema } from '@propbot/shared';
import { apiRequest } from '../../services/api-client.js';

type Fields = { name: string; email: string; mobile: string; agency: string; listings: string; website: string };
const EMPTY: Fields = { name: '', email: '', mobile: '', agency: '', listings: '', website: '' };

const inputCls = 'mt-1 h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 aria-[invalid=true]:border-danger';

/** Posts to the public demo endpoint. The hidden "website" field is a honeypot for bots. */
export const DemoForm: React.FC = () => {
  const [values, setValues] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [serverError, setServerError] = useState<string | null>(null);

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setValues(v => ({ ...v, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const parsed = createDemoRequestSchema.safeParse(values);
    if (!parsed.success) {
      const next: Partial<Record<keyof Fields, string>> = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof Fields] ??= issue.message;
      setErrors(next);
      document.getElementById(`demo-${Object.keys(next)[0]}`)?.focus();
      return;
    }
    setErrors({});
    setState('sending');
    try {
      await apiRequest('/api/demo-requests', { method: 'POST', body: JSON.stringify(parsed.data) });
      setState('done');
    } catch (err) {
      setState('idle');
      setServerError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  };

  if (state === 'done') {
    return (
      <div role="status" className="rounded-2xl border border-border bg-surface p-8 text-center">
        <CheckCircle2 aria-hidden className="mx-auto h-10 w-10 text-success" />
        <h3 className="mt-3 text-xl font-semibold text-text">Thanks, we have your request</h3>
        <p className="mt-1 text-sm text-text-muted">Our team will call you within one working day to set up your demo.</p>
      </div>
    );
  }

  const field = (k: keyof Fields, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`demo-${k}`} className="text-sm font-medium text-text">{label}</label>
      <input id={`demo-${k}`} value={values[k]} onChange={set(k)} aria-invalid={errors[k] ? true : undefined} aria-describedby={errors[k] ? `demo-${k}-err` : undefined} className={inputCls} required {...props} />
      {errors[k] && <p id={`demo-${k}-err`} className="mt-1 text-xs text-danger">{errors[k]}</p>}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-8" aria-label="Book a demo">
      <div className="grid gap-4 sm:grid-cols-2">
        {field('name', 'Your name', { autoComplete: 'name' })}
        {field('agency', 'Agency or developer', { autoComplete: 'organization' })}
        {field('email', 'Work email', { type: 'email', autoComplete: 'email' })}
        {field('mobile', 'Mobile number', { type: 'tel', autoComplete: 'tel', placeholder: '+91 98xxx xxxxx' })}
      </div>
      <div>
        <label htmlFor="demo-listings" className="text-sm font-medium text-text">Active listings</label>
        <select id="demo-listings" value={values.listings} onChange={set('listings')} aria-invalid={errors.listings ? true : undefined} className={inputCls} required>
          <option value="" disabled>Choose a range</option>
          <option value="1-50">1 to 50</option>
          <option value="51-200">51 to 200</option>
          <option value="201-1000">201 to 1,000</option>
          <option value="1000+">More than 1,000</option>
        </select>
        {errors.listings && <p className="mt-1 text-xs text-danger">Choose how many listings you manage</p>}
      </div>
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="demo-website">Leave this empty</label>
        <input id="demo-website" tabIndex={-1} autoComplete="off" value={values.website} onChange={set('website')} />
      </div>
      {serverError && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{serverError}</p>}
      <button type="submit" disabled={state === 'sending'} className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-accent px-6 text-sm font-semibold text-on-accent hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-60">
        {state === 'sending' ? 'Sending…' : 'Book my demo'}
      </button>
      <p className="text-center text-xs text-text-muted">No spam. We only use your details to arrange the demo.</p>
    </form>
  );
};
