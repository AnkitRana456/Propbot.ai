import React, { useState, useMemo } from 'react';
import {
  HelpCircle,
  BookOpen,
  Code2,
  ShieldCheck,
  ExternalLink,
  ChevronDown,
  LifeBuoy,
  FileText,
  Mail,
  Zap,
  Search,
  ArrowRight,
  MessageSquare,
  Lock,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface FaqItem {
  q: string;
  a: string;
  category: 'onboarding' | 'compliance' | 'ai' | 'billing';
}

const FAQS: FaqItem[] = [
  {
    category: 'onboarding',
    q: 'How do I embed the PropBot widget on my real estate agency website?',
    a: 'Navigate to Chatbots → Select your bot → Embed Code. Copy the single script tag and paste it before the closing </body> tag on WordPress, Webflow, React, or custom HTML. The widget is under 60 KB gzipped and renders inside Shadow DOM to avoid CSS conflicts.',
  },
  {
    category: 'onboarding',
    q: 'How does WhatsApp Cloud API integration work?',
    a: 'Open WhatsApp Bot → Configuration. Enter your Meta Permanent Access Token, Phone Number ID, and Webhook Verify Token. In Meta Developer Console, subscribe to "messages" with your PropBot callback URL.',
  },
  {
    category: 'ai',
    q: 'What happens when an AI bot encounters an unknown question?',
    a: 'PropBot uses strict RAG guardrails. If an answer cannot be grounded in your verified inventory or knowledge base documents, the bot transparently admits it and immediately offers to schedule a human agent callback, preventing hallucinated prices.',
  },
  {
    category: 'compliance',
    q: 'How does the Emergency AI Kill Switch work?',
    a: 'In Settings → AI Governance, platform admins can toggle the AI Kill Switch. When enabled, autonomous AI replies and tool execution are instantly halted across all channels and routed to human sales reps.',
  },
  {
    category: 'compliance',
    q: 'Is PropBot compliant with India DPDP and GDPR?',
    a: 'Yes. All visitor data tracking (IP, location, URL) is opt-in per chatbot. Leads can request data deletion or JSON export at any time via Settings → API & Data Privacy.',
  },
  {
    category: 'billing',
    q: 'What are the limits on AI tokens and conversations?',
    a: 'Limits depend on your subscription tier (Starter, Growth, Enterprise). Check your usage meters in Subscription & Billing. If quota is reached, an alert prompts your admin to upgrade before services pause.',
  },
];

const CATEGORIES = [
  { id: 'all', label: 'All Topics' },
  { id: 'onboarding', label: 'Onboarding' },
  { id: 'ai', label: 'AI Guardrails' },
  { id: 'compliance', label: 'Privacy & DPDP' },
  { id: 'billing', label: 'Billing' },
] as const;

const QUICK_LINKS = [
  {
    icon: BookOpen,
    title: 'Agency Onboarding',
    description: 'Import property inventory, train AI knowledge, and connect WhatsApp step-by-step.',
    linkLabel: 'Launch Chatbot Wizard',
    linkTo: '/chatbots/new',
    color: 'text-accent',
    bg: 'bg-accent/10',
    border: 'border-accent/20',
  },
  {
    icon: ShieldCheck,
    title: 'AI Governance & RLS',
    description: 'Configure permission tiers (T0–T3), human approval queues, and audit logs.',
    linkLabel: 'Manage AI Controls',
    linkTo: '/settings',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  {
    icon: Zap,
    title: 'Webhooks & Outbox',
    description: 'Connect CRM webhooks with HMAC-SHA256 signatures and automated retries.',
    linkLabel: 'View Webhook Logs',
    linkTo: '/webhook-logs',
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/20',
  },
];

export const HelpSupportPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [search, setSearch] = useState('');

  const filteredFaqs = useMemo(() => {
    let list = selectedCategory === 'all' ? FAQS : FAQS.filter(f => f.category === selectedCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(f => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q));
    }
    return list;
  }, [selectedCategory, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent/20 via-accent/5 to-transparent border border-accent/20 p-6">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-accent/10 blur-2xl" />
        <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/20">
              <LifeBuoy className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text">Help & Documentation Center</h1>
              <p className="mt-0.5 text-sm text-text-muted">
                Operational guides, API references, compliance manuals, and technical support
              </p>
            </div>
          </div>
          <a
            href="/api/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 self-start rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-text hover:bg-surface-2 transition-colors"
          >
            <Code2 className="h-3.5 w-3.5 text-accent" />
            OpenAPI Reference
            <ExternalLink className="h-3 w-3 text-text-muted" />
          </a>
        </div>
      </div>

      {/* Quick Launch Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {QUICK_LINKS.map(card => (
          <div key={card.title} className={`rounded-xl border ${card.border} bg-surface p-5 space-y-3 hover:bg-surface-2 transition-colors`}>
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.bg}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text">{card.title}</h3>
              <p className="mt-1 text-xs text-text-muted leading-relaxed">{card.description}</p>
            </div>
            <Link
              to={card.linkTo}
              className={`inline-flex items-center gap-1 text-xs font-semibold ${card.color} hover:opacity-80 transition-opacity`}
            >
              {card.linkLabel}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        ))}
      </div>

      {/* FAQ Section */}
      <div className="rounded-xl border border-border bg-surface">
        {/* FAQ Header */}
        <div className="flex flex-col gap-3 p-5 border-b border-border">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-accent" />
              <h2 className="text-base font-bold text-text">Frequently Asked Questions</h2>
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                {filteredFaqs.length}
              </span>
            </div>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Search questions…"
                value={search}
                onChange={e => { setSearch(e.target.value); setOpenFaqIndex(null); }}
                className="w-full md:w-52 rounded-lg border border-border bg-bg pl-8 pr-3 py-1.5 text-xs text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </div>
          </div>
          {/* Category Pills */}
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => { setSelectedCategory(cat.id); setOpenFaqIndex(null); }}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-accent text-white shadow-sm'
                    : 'bg-bg text-text-muted hover:bg-surface-2 border border-border'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Accordion */}
        <div className="p-4 space-y-2">
          {filteredFaqs.length === 0 ? (
            <div className="py-8 text-center text-sm text-text-muted">
              No results for "{search}" — try a different keyword.
            </div>
          ) : (
            filteredFaqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className={`rounded-xl border transition-colors ${isOpen ? 'border-accent/30 bg-accent/5' : 'border-border bg-bg hover:bg-surface-2'}`}
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left cursor-pointer"
                  >
                    <span className="text-sm font-semibold text-text leading-snug">{faq.q}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pt-0 text-sm text-text-muted leading-relaxed border-t border-accent/20">
                      <p className="pt-3">{faq.a}</p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Support + Compliance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
              <MessageSquare className="h-4 w-4 text-accent" />
            </div>
            <span className="text-sm font-bold text-text">Agency Support Desk</span>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Need emergency support for WhatsApp template approvals, model routing limits, or custom RERA compliance configurations?
          </p>
          <div className="flex items-center justify-between rounded-lg bg-bg border border-border px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-accent" />
              <span className="text-xs font-mono text-text">support@propbotpro.com</span>
            </div>
            <span className="text-xs font-semibold text-emerald-500 bg-emerald-500/10 rounded-full px-2 py-0.5">
              &lt; 2hr SLA
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10">
              <Lock className="h-4 w-4 text-indigo-400" />
            </div>
            <span className="text-sm font-bold text-text">Compliance & Documentation</span>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Review Data Processing Addendum (DPA), architecture security specifications, and export complete tenant data.
          </p>
          <div className="flex items-center gap-4 pt-1">
            <Link
              to="/settings"
              className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:opacity-80 transition-opacity"
            >
              <FileText className="h-3.5 w-3.5" />
              Export Tenant Data
              <ArrowRight className="h-3 w-3" />
            </Link>
            <Link
              to="/settings"
              className="inline-flex items-center gap-1 text-xs font-semibold text-text-muted hover:text-text transition-colors"
            >
              View DPA
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
