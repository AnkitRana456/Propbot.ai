import React, { useState } from 'react';
import {
  HelpCircle,
  BookOpen,
  Code2,
  ShieldCheck,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  LifeBuoy,
  FileText,
  Mail,
  Zap,
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
    a: 'Navigate to Chatbots -> Select your bot -> Embed Code. Copy the single script tag and paste it before the closing </body> tag on WordPress, Webflow, React, or custom HTML. The widget is under 60 KB gzipped and renders inside Shadow DOM to avoid CSS conflicts.',
  },
  {
    category: 'onboarding',
    q: 'How does WhatsApp Cloud API integration work?',
    a: 'Open WhatsApp Bot -> Configuration. Enter your Meta Permanent Access Token, Phone Number ID, and Webhook Verify Token. In Meta Developer Console, subscribe to "messages" with your PropBot callback URL.',
  },
  {
    category: 'ai',
    q: 'What happens when an AI bot encounters an unknown question?',
    a: 'PropBot uses strict RAG guardrails. If an answer cannot be grounded in your verified inventory or knowledge base documents, the bot transparently admits it and immediately offers to schedule a human agent callback, preventing hallucinated prices.',
  },
  {
    category: 'compliance',
    q: 'How does the Emergency AI Kill Switch work?',
    a: 'In Settings -> AI Governance, platform admins can toggle the AI Kill Switch. When enabled, autonomous AI replies and tool execution are instantly halted across all channels and routed to human sales reps.',
  },
  {
    category: 'compliance',
    q: 'Is PropBot compliant with India DPDP and GDPR?',
    a: 'Yes. All visitor data tracking (IP, location, URL) is opt-in per chatbot. Leads can request data deletion or JSON export at any time via Settings -> API & Data Privacy.',
  },
  {
    category: 'billing',
    q: 'What are the limits on AI tokens and conversations?',
    a: 'Limits depend on your subscription tier (Starter, Growth, Enterprise). Check your usage meters in Subscription & Billing. If quota is reached, an alert prompts your admin to upgrade before services pause.',
  },
];

export const HelpSupportPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const filteredFaqs =
    selectedCategory === 'all'
      ? FAQS
      : FAQS.filter(item => item.category === selectedCategory);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <LifeBuoy className="h-6 w-6 text-primary" />
            Help & Documentation Center
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Operational guides, API references, compliance manuals, and technical support
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <Code2 className="h-3.5 w-3.5 text-primary" />
            OpenAPI Reference
            <ExternalLink className="h-3 w-3 text-slate-400" />
          </a>
        </div>
      </div>

      {/* Quick Launch Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card space-y-2 border-l-4 border-l-primary dark:border-border-dark dark:bg-surface-dark">
          <div className="flex items-center gap-2 text-primary">
            <BookOpen className="h-4 w-4" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Agency Onboarding</h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Step-by-step walkthrough to import property inventory, train AI knowledge, and connect WhatsApp.
          </p>
          <Link
            to="/chatbots/new"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline pt-1"
          >
            Launch Chatbot Wizard <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="card space-y-2 border-l-4 border-l-emerald-500 dark:border-border-dark dark:bg-surface-dark">
          <div className="flex items-center gap-2 text-emerald-600">
            <ShieldCheck className="h-4 w-4" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">AI Governance & RLS</h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Configure permission tiers (T0–T3), human approval queues for pricing promises, and audit logs.
          </p>
          <Link
            to="/settings"
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:underline pt-1"
          >
            Manage AI Controls <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="card space-y-2 border-l-4 border-l-indigo-500 dark:border-border-dark dark:bg-surface-dark">
          <div className="flex items-center gap-2 text-indigo-600">
            <Zap className="h-4 w-4" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Webhooks & Outbox</h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Connect CRM webhooks (Zoho, HubSpot, Salesforce) with HMAC-SHA256 signatures and automated retries.
          </p>
          <Link
            to="/webhook-logs"
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline pt-1"
          >
            View Webhook Logs <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* FAQ & Knowledge Section */}
      <div className="card space-y-4 dark:border-border-dark dark:bg-surface-dark">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-border-light pb-3 dark:border-border-dark">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-primary" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Frequently Asked Questions
            </h2>
          </div>
          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'all', label: 'All Topics' },
              { id: 'onboarding', label: 'Onboarding' },
              { id: 'ai', label: 'AI Guardrails' },
              { id: 'compliance', label: 'Privacy & DPDP' },
              { id: 'billing', label: 'Billing' },
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Accordion */}
        <div className="space-y-2">
          {filteredFaqs.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div
                key={idx}
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between p-3.5 text-left text-xs font-bold text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                >
                  <span>{faq.q}</span>
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-3.5 pb-3.5 pt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Contact & Support Channels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card space-y-3 dark:border-border-dark dark:bg-surface-dark">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
            <Mail className="h-4 w-4 text-primary" />
            Agency Support Desk
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Need emergency support for WhatsApp template approvals, model routing limits, or custom RERA compliance configurations?
          </p>
          <div className="text-xs font-mono bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
            support@propbotpro.com • Priority SLA: &lt; 2 Hours
          </div>
        </div>

        <div className="card space-y-3 dark:border-border-dark dark:bg-surface-dark">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
            <FileText className="h-4 w-4 text-primary" />
            Compliance & Documentation
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Review Data Processing Addendum (DPA), architecture security specifications, and export complete tenant data.
          </p>
          <div className="flex items-center gap-3 pt-1">
            <Link
              to="/settings"
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              Export Tenant Data <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
