import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Lock,
  Mail,
  User,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('admin@prestige.com');
  const [password, setPassword] = useState('Password123!');
  const [companyName, setCompanyName] = useState('Prestige Realty Group');
  const [companySlug, setCompanySlug] = useState('prestige-realty');
  const [adminName, setAdminName] = useState('Vikram Mehta');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    const API_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000';

    try {
      if (mode === 'login') {
        const res = await fetch(`${API_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error?.message || 'Login failed. Please check credentials.');
        }

        login(data.data.tokens.accessToken, data.data.user, data.data.company);
        navigate('/dashboard');
      } else {
        const res = await fetch(`${API_URL}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyName,
            companySlug: companySlug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
            adminName,
            adminEmail: email,
            password,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error?.message || 'Registration failed.');
        }

        if (data.data.pendingApproval || !data.data.tokens) {
          setMode('login');
          setErrorMessage(data.data.message || 'Your account is pending approval. Please wait for admin activation.');
          return;
        }
        login(data.data.tokens.accessToken, data.data.user, data.data.company);
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoLogin = async (demoEmail: string, demoPass: string = 'Password123!') => {
    setIsLoading(true);
    setErrorMessage(null);
    const API_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000';

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: demoEmail, password: demoPass }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Demo login failed');
      }

      login(data.data.tokens.accessToken, data.data.user, data.data.company);
      navigate('/dashboard');
    } catch (err: unknown) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-slate-950 text-slate-100">
      {/* Left Column: Brand Hero & Value Prop */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden border-r border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950/40 p-12 lg:flex">
        {/* Ambient Glow Effects */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 rounded-full bg-indigo-600/15 blur-3xl" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-500/25">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">PropBot Pro</h1>
            <p className="text-xs font-medium text-blue-400">
              AI Conversion Platform for Real Estate
            </p>
          </div>
        </div>

        <div className="relative z-10 my-auto max-w-lg space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1 text-xs font-semibold text-blue-300 backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-blue-400" />
            <span>Phase 1 — Multi-Tenant Architecture & Auth</span>
          </div>

          <h2 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Close high-intent buyers{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">
              24/7 with autonomous AI.
            </span>
          </h2>

          <p className="text-base text-slate-400 leading-relaxed">
            Multi-tenant real estate concierge powered by PostgreSQL Row-Level Security, Live Buyer
            DNA extraction, and instant lead handoff.
          </p>

          <div className="space-y-3 pt-4">
            {[
              'Enterprise Tenant Isolation & Database Row-Level Security',
              'Role-Based Access Control (Admin, Manager, Agent, Viewer)',
              'Live Intent Scoring (0–100) & Instant Site Visit Booking',
              'Transactional Event Outbox & Guarded AI Action Layer',
            ].map((feature, idx) => (
              <div key={idx} className="flex items-center gap-3 text-sm text-slate-300">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between border-t border-slate-800/80 pt-6 text-xs text-slate-500">
          <span>&copy; 2026 PropBot Pro. All rights reserved.</span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            SOC2 & DPDP Compliant Architecture
          </span>
        </div>
      </div>

      {/* Right Column: Interactive Login / Register Form */}
      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-md">
          {/* Header Mobile Brand */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <span className="font-bold text-white">PropBot Pro</span>
              <span className="block text-xs text-slate-400">Real Estate AI Platform</span>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight text-white">
              {mode === 'login' ? 'Sign in to your agency' : 'Register your brokerage'}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {mode === 'login'
                ? 'Enter your credentials or use the 1-click demo logins below.'
                : 'Provision a new company tenant with isolated database schemas.'}
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="mb-6 flex rounded-xl border border-slate-800 bg-slate-900/60 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMessage(null);
              }}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                mode === 'login'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMessage(null);
              }}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                mode === 'register'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Register New Agency
            </button>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-5 flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-950/40 p-4 text-xs text-rose-300">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">
                    Company Name
                  </label>
                  <div className="relative">
                    <Building2 className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={e => {
                        setCompanyName(e.target.value);
                        setCompanySlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'));
                      }}
                      placeholder="e.g. Prestige Realty Group"
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/80 py-2.5 pr-4 pl-10 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">
                    Company Slug (Tenant Key)
                  </label>
                  <input
                    type="text"
                    required
                    value={companySlug}
                    onChange={e => setCompanySlug(e.target.value)}
                    placeholder="prestige-realty"
                    className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">
                    Administrator Name
                  </label>
                  <div className="relative">
                    <User className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      required
                      value={adminName}
                      onChange={e => setAdminName(e.target.value)}
                      placeholder="Vikram Mehta"
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/80 py-2.5 pr-4 pl-10 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@prestige.com"
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/80 py-2.5 pr-4 pl-10 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">Password</label>
              <div className="relative">
                <Lock className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/80 py-2.5 pr-10 pl-10 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute top-1/2 right-3.5 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition-all hover:from-blue-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:opacity-60"
            >
              {isLoading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <span>{mode === 'login' ? 'Sign In to Dashboard' : 'Complete Registration'}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick 1-Click Demo Logins for Instant Testing */}
          <div className="mt-8 border-t border-slate-800/80 pt-6">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                🚀 1-Click Demo Accounts
              </span>
              <span className="text-[11px] text-blue-400 font-medium">Pre-Seeded Database</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('admin@prestige.com')}
                disabled={isLoading}
                className="flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-900/60 p-2.5 text-left transition-all hover:border-blue-500/50 hover:bg-slate-800/80"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600/20 text-blue-400">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="overflow-hidden">
                  <div className="truncate text-xs font-semibold text-white">Company Admin</div>
                  <div className="truncate text-[10px] text-slate-400">Prestige Realty</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('manager@prestige.com')}
                disabled={isLoading}
                className="flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-900/60 p-2.5 text-left transition-all hover:border-indigo-500/50 hover:bg-slate-800/80"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400">
                  <User className="h-4 w-4" />
                </div>
                <div className="overflow-hidden">
                  <div className="truncate text-xs font-semibold text-white">Sales Manager</div>
                  <div className="truncate text-[10px] text-slate-400">Prestige Realty</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('agent@prestige.com')}
                disabled={isLoading}
                className="flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-900/60 p-2.5 text-left transition-all hover:border-emerald-500/50 hover:bg-slate-800/80"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600/20 text-emerald-400">
                  <Zap className="h-4 w-4" />
                </div>
                <div className="overflow-hidden">
                  <div className="truncate text-xs font-semibold text-white">Sales Agent</div>
                  <div className="truncate text-[10px] text-slate-400">Prestige Realty</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('admin@sobha.com')}
                disabled={isLoading}
                className="flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-900/60 p-2.5 text-left transition-all hover:border-purple-500/50 hover:bg-slate-800/80"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-600/20 text-purple-400">
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="overflow-hidden">
                  <div className="truncate text-xs font-semibold text-white">Tenant B Admin</div>
                  <div className="truncate text-[10px] text-slate-400">Sobha Developers</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
