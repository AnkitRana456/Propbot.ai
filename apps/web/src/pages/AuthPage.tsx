import React, { useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowRight, Building2, CalendarCheck, CheckCircle2, Compass, Eye, EyeOff, Flame, Lock, Mail, MailCheck, ShieldCheck, User, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';
import { ThemeToggle } from '../components/ui/ThemeToggle.js';
import { Input } from '../components/ui/Input.js';
import { BrowserFrame, FloatingCard, ThemedImage, Tilt } from '../components/marketing/Frames.js';
import { useDocumentMeta } from '../lib/use-document-meta.js';

type Mode = 'login' | 'register' | 'forgot';

const API_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000';

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || 'Something went wrong. Please try again.');
  return data.data as T;
}

type LoginFn = ReturnType<typeof useAuth>['login'];
type AuthPayload = { tokens?: { accessToken: string }; user: Parameters<LoginFn>[1]; company: Parameters<LoginFn>[2]; pendingApproval?: boolean; message?: string };

/** 0 to 4: length, mixed case, a digit, a symbol. */
const strength = (pw: string) => [pw.length >= 8, /[a-z]/.test(pw) && /[A-Z]/.test(pw), /\d/.test(pw), /[^A-Za-z0-9]/.test(pw)].filter(Boolean).length;
const STRENGTH_LABEL = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];

const DEMO_ACCOUNTS = [
  { email: 'admin@prestige.com', role: 'Company admin', org: 'Prestige Realty', icon: ShieldCheck },
  { email: 'manager@prestige.com', role: 'Sales manager', org: 'Prestige Realty', icon: User },
  { email: 'agent@prestige.com', role: 'Sales agent', org: 'Prestige Realty', icon: Zap },
  { email: 'admin@sobha.com', role: 'Second agency', org: 'Sobha Developers', icon: Building2 },
];

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, isInitialized } = useAuth();

  const [mode, setMode] = useState<Mode>(location.pathname === '/register' ? 'register' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companySlug, setCompanySlug] = useState('');
  const [adminName, setAdminName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useDocumentMeta({ title: `${mode === 'register' ? 'Create your account' : mode === 'forgot' ? 'Reset your password' : 'Log in'} | PropBot Pro`, noindex: true });
  const score = useMemo(() => strength(password), [password]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setErrorMessage(null);
    setNotice(null);
  };

  const finish = (d: AuthPayload) => {
    if (d.pendingApproval || !d.tokens) {
      switchMode('login');
      setNotice(d.message || 'Your account is waiting for approval. We will let you know once it is active.');
      return;
    }
    login(d.tokens.accessToken, d.user, d.company);
    // Only same-site paths, so a crafted link cannot send someone elsewhere after logging in
    const from = (location.state as { from?: string } | null)?.from;
    navigate(from && from.startsWith('/') && !from.startsWith('//') ? from : '/dashboard', { replace: true });
  };

  const run = async (fn: () => Promise<void>) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await fn();
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      if (mode === 'login') {
        finish(await post<AuthPayload>('/api/auth/login', { email, password }));
      } else if (mode === 'register') {
        finish(
          await post<AuthPayload>('/api/auth/register', {
            companyName,
            companySlug: companySlug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
            adminName,
            adminEmail: email,
            password,
          }),
        );
      } else {
        await post('/api/auth/forgot-password', { email });
        setNotice('If an account exists for that email, a reset link is on its way.');
      }
    });
  };

  const demoLogin = (demoEmail: string) => run(async () => finish(await post<AuthPayload>('/api/auth/login', { email: demoEmail, password: 'Password123!' })));

  const title = mode === 'login' ? 'Welcome back' : mode === 'register' ? 'Create your workspace' : 'Reset your password';
  const subtitle =
    mode === 'login' ? 'Log in to see your leads, visits and conversations.' : mode === 'register' ? 'Set up your agency in a minute. No card needed.' : 'Enter your email and we will send you a reset link.';

  if (isInitialized && isAuthenticated && mode !== 'forgot') return <Navigate to="/dashboard" replace />;

  return (
    <div className="flex min-h-screen w-full bg-bg text-text">
      {/* Brand panel */}
      <aside className="relative hidden w-[52%] flex-col justify-between overflow-hidden border-r border-border bg-surface p-10 lg:flex xl:p-14" aria-label="About PropBot Pro">
        <div aria-hidden className="aurora pointer-events-none absolute inset-0" />
        <div aria-hidden className="grid-fade pointer-events-none absolute inset-0" />
        <div aria-hidden className="drift pointer-events-none absolute -left-20 top-1/3 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />

        <Link to="/" className="relative z-10 flex w-fit items-center gap-2.5 font-bold text-text">
          <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-on-accent shadow-float"><Compass className="h-5 w-5" /></span>
          PropBot Pro
        </Link>

        <div className="relative z-10 my-8">
          <h2 className="max-w-lg text-4xl font-extrabold leading-[1.1] tracking-tight xl:text-5xl">
            Close more buyers, <span className="text-gradient">while you sleep</span>
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-text-muted">Your AI assistant answers every enquiry in seconds, qualifies the buyer and books the site visit.</p>

          <div className="relative mt-10 max-w-xl">
            <Tilt max={5}>
              <BrowserFrame url="app.propbot.pro/overview"><ThemedImage name="dashboard" alt="PropBot dashboard preview" width={1200} height={750} priority /></BrowserFrame>
            </Tilt>
            <FloatingCard className="absolute -right-4 -top-5 flex items-center gap-2.5 xl:-right-10">
              <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent"><Flame className="h-4 w-4" /></span>
              <span><span className="block font-semibold text-text">New hot lead</span><span className="block text-text-muted">Priya S. · ₹1.2 Cr</span></span>
            </FloatingCard>
            <FloatingCard slow className="absolute -bottom-5 -left-4 flex items-center gap-2.5 xl:-left-8">
              <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent"><CalendarCheck className="h-4 w-4" /></span>
              <span><span className="block font-semibold text-text">Visit booked</span><span className="block text-text-muted">Saturday, 11:00 am</span></span>
            </FloatingCard>
          </div>
        </div>

        <ul className="relative z-10 grid gap-2.5 text-sm text-text sm:grid-cols-2">
          {['Replies on web and WhatsApp', 'Scores every lead hot, warm or cold', 'Books visits on your calendar', 'Your data stays in your workspace'].map(t => (
            <li key={t} className="flex items-center gap-2"><CheckCircle2 aria-hidden className="h-4 w-4 shrink-0 text-success" />{t}</li>
          ))}
        </ul>
      </aside>

      {/* Form panel */}
      <main id="main" className="flex w-full flex-1 flex-col lg:w-[48%]">
        <div className="flex items-center justify-between px-5 py-4 sm:px-8">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-text">
            <ArrowLeft aria-hidden className="h-4 w-4" /> Back to home
          </Link>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center px-5 pb-10 sm:px-8">
          <div className="w-full max-w-md">
            <Link to="/" className="mb-6 flex items-center gap-2.5 font-bold text-text lg:hidden">
              <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-on-accent"><Compass className="h-5 w-5" /></span>
              PropBot Pro
            </Link>

            <div className="rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-8">
              <h1 className="text-2xl font-bold tracking-tight text-text">{title}</h1>
              <p className="mt-1 text-sm text-text-muted">{subtitle}</p>

              {mode !== 'forgot' && (
                <div role="tablist" aria-label="Log in or register" className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
                  {([['login', 'Log in'], ['register', 'Create account']] as const).map(([m, label]) => (
                    <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => switchMode(m)} className={`rounded-lg py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${mode === m ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {errorMessage && (
                <div role="alert" className="mt-5 flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
                  <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
              {notice && (
                <div role="status" className="mt-5 flex items-start gap-2.5 rounded-xl border border-success/30 bg-success/10 p-3 text-sm text-text">
                  <MailCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>{notice}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate={false}>
                {mode === 'register' && (
                  <>
                    <Input
                      label="Agency or company name"
                      required
                      value={companyName}
                      autoComplete="organization"
                      leftIcon={<Building2 className="h-4 w-4" />}
                      placeholder="Skyline Realty"
                      onChange={e => {
                        setCompanyName(e.target.value);
                        setCompanySlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
                      }}
                    />
                    <Input label="Workspace ID" required value={companySlug} hint="Lowercase letters, numbers and dashes. Used to identify your workspace." onChange={e => setCompanySlug(e.target.value)} placeholder="skyline-realty" />
                    <Input label="Your name" required value={adminName} autoComplete="name" leftIcon={<User className="h-4 w-4" />} placeholder="Asha Rao" onChange={e => setAdminName(e.target.value)} />
                  </>
                )}

                <Input label="Work email" type="email" required value={email} autoComplete="email" leftIcon={<Mail className="h-4 w-4" />} placeholder="you@agency.com" onChange={e => setEmail(e.target.value)} />

                {mode !== 'forgot' && (
                  <div>
                    <div className="relative">
                      <Input label="Password" type={showPassword ? 'text' : 'password'} required minLength={mode === 'register' ? 8 : undefined} value={password} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} leftIcon={<Lock className="h-4 w-4" />} placeholder="At least 8 characters" onChange={e => setPassword(e.target.value)} className="[&_input]:pr-10" />
                      <button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} className="absolute right-2.5 top-[1.9rem] rounded p-1 text-text-muted hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                        {showPassword ? <EyeOff aria-hidden className="h-4 w-4" /> : <Eye aria-hidden className="h-4 w-4" />}
                      </button>
                    </div>
                    {mode === 'register' && password && (
                      <div className="mt-2" aria-live="polite">
                        <div className="flex gap-1" aria-hidden>
                          {[0, 1, 2, 3].map(i => <span key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < score ? (score <= 1 ? 'bg-danger' : score <= 2 ? 'bg-brass' : 'bg-success') : 'bg-border'}`} />)}
                        </div>
                        <p className="mt-1 text-xs text-text-muted">Password strength: {STRENGTH_LABEL[score]}</p>
                      </div>
                    )}
                    {mode === 'login' && (
                      <div className="mt-2 text-right">
                        <button type="button" onClick={() => switchMode('forgot')} className="text-xs font-semibold text-accent hover:underline">Forgot password?</button>
                      </div>
                    )}
                  </div>
                )}

                <button type="submit" disabled={isLoading} className="btn-sheen flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-on-accent shadow-float transition hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60">
                  {isLoading ? (
                    <span role="status" aria-label="Working" className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <>
                      {mode === 'login' ? 'Log in' : mode === 'register' ? 'Create my workspace' : 'Send reset link'}
                      <ArrowRight aria-hidden className="h-4 w-4" />
                    </>
                  )}
                </button>
                {mode === 'forgot' && (
                  <button type="button" onClick={() => switchMode('login')} className="w-full text-center text-sm font-semibold text-accent hover:underline">Back to log in</button>
                )}
              </form>

              {mode === 'register' && <p className="mt-4 text-center text-xs text-text-muted">By creating an account you agree to be contacted about your workspace.</p>}
            </div>

            {import.meta.env.DEV && mode !== 'forgot' && (
              <section aria-label="Demo accounts" className="mt-6 rounded-2xl border border-dashed border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Demo accounts</h2>
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">Development only</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {DEMO_ACCOUNTS.map(({ email: e, role, org, icon: Icon }) => (
                    <button key={e} type="button" disabled={isLoading} onClick={() => void demoLogin(e)} className="flex items-center gap-2.5 rounded-xl border border-border bg-surface p-2.5 text-left transition hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60">
                      <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"><Icon className="h-4 w-4" /></span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold text-text">{role}</span>
                        <span className="block truncate text-[11px] text-text-muted">{org}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AuthPage;
