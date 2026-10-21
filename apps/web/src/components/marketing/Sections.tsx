import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, Check, ChevronDown, Compass, Menu, MessageCircle, PhoneCall, Sparkles, Users, X, Zap } from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '@propbot/shared';
import { ThemeToggle } from '../ui/ThemeToggle.js';
import { useAuth } from '../../contexts/AuthContext.js';
import { BrowserFrame, PhoneFrame, Reveal, ThemedImage } from './Frames.js';
import { DemoForm } from './DemoForm.js';

const container = 'mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8';
const sectionPad = 'py-16 sm:py-24';
const h2 = 'text-3xl font-bold tracking-tight text-text sm:text-4xl';
const lead = 'mt-3 max-w-2xl text-base text-text-muted sm:text-lg';
const btnPrimary = 'inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-accent px-6 text-sm font-semibold text-on-accent hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg';
const btnSecondary = 'inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-6 text-sm font-semibold text-text hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg';

const NAV = [
  { label: 'Use cases', href: '#use-cases' },
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

export const MarketingNav: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur">
      <div className={`${container} flex h-16 items-center justify-between gap-4`}>
        <Link to="/" className="flex items-center gap-2.5 whitespace-nowrap font-bold text-text">
          <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-on-accent"><Compass className="h-[18px] w-[18px]" /></span>
          PropBot Pro
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-6 lg:flex">
          {NAV.map(n => <a key={n.href} href={n.href} className="text-sm font-medium text-text-muted hover:text-text">{n.label}</a>)}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle className="hidden sm:inline-flex" />
          {isAuthenticated ? (
            <Link to="/dashboard" className={`${btnPrimary} h-10 whitespace-nowrap px-4`}>Dashboard</Link>
          ) : (
            <>
              <Link to="/login" className="hidden px-3 text-sm font-semibold text-text hover:text-accent sm:inline">Log in</Link>
              <a href="#demo" className={`${btnPrimary} h-10 whitespace-nowrap px-4`}>Book a demo</a>
            </>
          )}
          <button type="button" className="rounded-lg p-2 text-text lg:hidden" aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(o => !o)}>
            {open ? <X aria-hidden className="h-5 w-5" /> : <Menu aria-hidden className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-border bg-surface lg:hidden">
          <ul className={`${container} space-y-1 py-3`}>
            {NAV.map(n => (
              <li key={n.href}><a href={n.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-text hover:bg-surface-2">{n.label}</a></li>
            ))}
            <li className="flex items-center justify-between px-3 pt-2"><Link to="/login" className="text-sm font-semibold text-accent">Log in</Link><ThemeToggle /></li>
          </ul>
        </nav>
      )}
    </header>
  );
};

export const Hero: React.FC = () => (
  <section className="relative overflow-hidden" aria-labelledby="hero-title">
    <div className={`${container} grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-2`}>
      <div>
        <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-accent"><Sparkles aria-hidden className="h-3.5 w-3.5" /> AI chatbot and CRM for real estate</p>
        <h1 id="hero-title" className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-text sm:text-5xl lg:text-[3.4rem]">Turn every property enquiry into a booked site visit</h1>
        <p className="mt-5 max-w-xl text-lg text-text-muted">PropBot answers buyers on your website and WhatsApp in seconds, qualifies them, books the visit and hands your team a warm lead, day or night.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="#demo" className={btnPrimary}>Book a demo <ArrowRight aria-hidden className="h-4 w-4" /></a>
          <Link to="/register" className={btnSecondary}>Start free trial</Link>
        </div>
        <p className="mt-4 text-sm text-text-muted">Free trial. No card needed.</p>
      </div>
      <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
        <BrowserFrame><ThemedImage name="dashboard" alt="PropBot dashboard with a 30-day leads chart and a table of buyer enquiries" width={1200} height={750} priority /></BrowserFrame>
        <div className="absolute -bottom-8 right-2 hidden w-32 sm:block md:w-40 lg:-right-4">
          <PhoneFrame><ThemedImage name="chat" alt="Chatbot conversation that ends with a booked Saturday site visit" width={390} height={800} priority /></PhoneFrame>
        </div>
      </div>
    </div>
  </section>
);

export const TrustStrip: React.FC = () => (
  <section aria-label="Channels" className="border-y border-border bg-surface">
    <div className={`${container} flex flex-wrap items-center justify-center gap-x-10 gap-y-3 py-6 text-sm font-medium text-text-muted`}>
      <span>Works with</span>
      {['Your website', 'WhatsApp Business', 'Google Calendar', 'Razorpay and Stripe', 'Facebook Lead Ads'].map(t => <span key={t} className="text-text">{t}</span>)}
    </div>
  </section>
);

export const ProofBand: React.FC = () => (
  <section aria-labelledby="proof-title" className={sectionPad}>
    <div className={container}>
      <h2 id="proof-title" className="sr-only">What agencies typically see</h2>
      <ul className="grid grid-cols-2 gap-6 text-center lg:grid-cols-4">
        {[['< 10 sec', 'first reply, any hour'], ['3x', 'more enquiries answered'], ['40%', 'more site visits booked'], ['24/7', 'always on']].map(([n, l]) => (
          <li key={l}><Reveal><p className="text-4xl font-extrabold tracking-tight text-accent">{n}</p><p className="mt-1 text-sm text-text-muted">{l}</p></Reveal></li>
        ))}
      </ul>
      <p className="mt-6 text-center text-xs text-text-muted">Illustrative figures to show what is possible. Your results will vary.</p>
    </div>
  </section>
);

const USE_CASES = [
  { icon: MessageCircle, title: 'Answer instantly', body: 'Price, floor plans, possession dates and locality questions, answered from your own project data.' },
  { icon: Users, title: 'Qualify buyers', body: 'Budget, BHK, timeline and loan status captured in a natural chat, then scored hot, warm or cold.' },
  { icon: Calendar, title: 'Book site visits', body: 'Offers real slots from your calendar and confirms with a WhatsApp reminder.' },
  { icon: PhoneCall, title: 'Hand off warm leads', body: 'Your agent gets the full chat, the buyer profile and a suggested next step.' },
  { icon: Zap, title: 'Follow up automatically', body: 'Nudges quiet leads, reminds no-shows and re-engages old enquiries without extra work.' },
  { icon: Sparkles, title: 'Learn what sells', body: 'See which projects, sources and questions turn into bookings.' },
];

export const UseCases: React.FC = () => (
  <section id="use-cases" className={`${sectionPad} bg-surface`} aria-labelledby="use-title">
    <div className={container}>
      <h2 id="use-title" className={h2}>One assistant for the whole enquiry journey</h2>
      <p className={lead}>From the first message to the site visit, nothing waits for someone to be free.</p>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {USE_CASES.map(({ icon: Icon, title, body }, i) => (
          <li key={title}><Reveal delay={i * 60}><div className="h-full rounded-xl border border-border bg-bg p-6">
            <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent"><Icon className="h-5 w-5" /></span>
            <h3 className="mt-4 text-lg font-semibold text-text">{title}</h3>
            <p className="mt-1.5 text-sm text-text-muted">{body}</p>
          </div></Reveal></li>
        ))}
      </ul>
    </div>
  </section>
);

const FEATURES = [
  { title: 'A CRM built for buyers, not forms', body: 'Every lead shows budget, preferred locality, score and the full chat. Edit anything inline, filter in a click and export when you need to.', bullets: ['Spreadsheet-style table with keyboard shortcuts', 'Status pipeline from New to Booked', 'Assign leads to agents in one step'], image: 'dashboard', alt: 'Leads table with status chips and budgets in lakhs and crores', phone: false },
  { title: 'Chat that feels like your best agent', body: 'Trained on your projects, prices and policies. It says when it does not know and hands over to a person.', bullets: ['Website widget and WhatsApp in one inbox', 'Speaks English, Hindi and more', 'Human takeover at any moment'], image: 'chat', alt: 'Phone showing a chatbot booking a site visit', phone: true },
];

export const FeatureRows: React.FC = () => (
  <section id="features" className={sectionPad} aria-labelledby="feat-title">
    <div className={`${container} space-y-20`}>
      <h2 id="feat-title" className="sr-only">Features</h2>
      {FEATURES.map((f, i) => (
        <Reveal key={f.title}>
          <div className={`grid items-center gap-10 lg:grid-cols-2 ${i % 2 ? 'lg:[&>*:first-child]:order-2' : ''}`}>
            <div>
              <h3 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">{f.title}</h3>
              <p className="mt-3 text-text-muted">{f.body}</p>
              <ul className="mt-5 space-y-2.5">
                {f.bullets.map(b => <li key={b} className="flex items-start gap-2.5 text-sm text-text"><Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-success" />{b}</li>)}
              </ul>
            </div>
            <div className={f.phone ? 'mx-auto w-56 sm:w-64' : ''}>
              {f.phone
                ? <PhoneFrame><ThemedImage name={f.image} alt={f.alt} width={390} height={800} /></PhoneFrame>
                : <BrowserFrame url="app.propbot.pro/leads"><ThemedImage name={f.image} alt={f.alt} width={1200} height={750} /></BrowserFrame>}
            </div>
          </div>
        </Reveal>
      ))}
    </div>
  </section>
);

export const BuiltFor: React.FC = () => (
  <section className={`${sectionPad} bg-surface`} aria-labelledby="built-title">
    <div className={container}>
      <h2 id="built-title" className={h2}>Built for the way Indian real estate sells</h2>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[['Developers', 'Launch campaigns without a call-centre.'], ['Brokerages', 'Give every agent the same fast first reply.'], ['Channel partners', 'Capture and route enquiries across projects.'], ['Rental and resale', 'Match tenants and buyers to the right listing.']].map(([t, b]) => (
          <li key={t} className="rounded-xl border border-border bg-bg p-5"><h3 className="font-semibold text-text">{t}</h3><p className="mt-1 text-sm text-text-muted">{b}</p></li>
        ))}
      </ul>
    </div>
  </section>
);

export const HowItWorks: React.FC = () => (
  <section id="how" className={sectionPad} aria-labelledby="how-title">
    <div className={container}>
      <h2 id="how-title" className={h2}>Live in an afternoon</h2>
      <ol className="mt-10 grid gap-6 md:grid-cols-3">
        {[['Add your projects', 'Upload brochures, price lists and FAQs. PropBot learns them.'], ['Match your brand', 'Pick colours, a greeting and the questions to ask. Preview it live.'], ['Paste one snippet', 'Add the widget to your site and connect WhatsApp. Leads start flowing.']].map(([t, b], i) => (
          <li key={t}><Reveal delay={i * 80}><div className="h-full rounded-xl border border-border bg-surface p-6">
            <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-accent font-bold text-on-accent">{i + 1}</span>
            <h3 className="mt-4 text-lg font-semibold text-text">{t}</h3><p className="mt-1.5 text-sm text-text-muted">{b}</p>
          </div></Reveal></li>
        ))}
      </ol>
    </div>
  </section>
);

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export const Pricing: React.FC = () => {
  const plans = [SUBSCRIPTION_PLANS.starter!, SUBSCRIPTION_PLANS.growth!, SUBSCRIPTION_PLANS.enterprise!];
  const feats = (p: (typeof plans)[number]) => [
    `${p.limits.chatbots >= 999 ? 'Unlimited' : p.limits.chatbots} chatbots`,
    `${p.limits.conversationsPerMonth.toLocaleString('en-IN')} conversations a month`,
    `${p.limits.users >= 999 ? 'Unlimited' : p.limits.users} team members`,
    p.limits.whatsappNumbers ? `${p.limits.whatsappNumbers} WhatsApp number${p.limits.whatsappNumbers > 1 ? 's' : ''}` : 'Website widget',
    ...(p.limits.features.workflows ? ['Flows and automations'] : []),
    ...(p.limits.features.voice ? ['Voice agents'] : []),
  ];
  return (
    <section id="pricing" className={`${sectionPad} bg-surface`} aria-labelledby="price-title">
      <div className={container}>
        <h2 id="price-title" className={h2}>Simple pricing in rupees</h2>
        <p className={lead}>Start with a free trial. Prices per month, GST extra where it applies.</p>
        <ul className="mt-10 grid gap-6 lg:grid-cols-3">
          {plans.map(p => (
            <li key={p.id} className={`flex flex-col rounded-2xl border bg-bg p-6 ${p.highlight ? 'border-accent shadow-float' : 'border-border'}`}>
              {p.highlight && <span className="mb-3 w-fit rounded-full bg-accent px-3 py-0.5 text-xs font-bold text-on-accent">Most popular</span>}
              <h3 className="text-xl font-bold text-text">{p.name}</h3>
              <p className="mt-1 min-h-[3rem] text-sm text-text-muted">{p.tagline}</p>
              <p className="mt-4 text-4xl font-extrabold tracking-tight text-text">{inr(p.priceInrMonthly)}<span className="text-base font-medium text-text-muted"> /month</span></p>
              <ul className="mt-5 flex-1 space-y-2.5">
                {feats(p).map(f => <li key={f} className="flex items-start gap-2.5 text-sm text-text"><Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-success" />{f}</li>)}
              </ul>
              <Link to="/register" className={`${p.highlight ? btnPrimary : btnSecondary} mt-6`}>Start free trial</Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

const FAQS = [
  ['Will it make things up about my projects?', 'PropBot answers from the documents and data you give it. When it is not sure, it says so and offers to connect the buyer with your team.'],
  ['Does it work on WhatsApp?', 'Yes. The same assistant answers on your website and on your WhatsApp Business number, and every conversation lands in one inbox.'],
  ['How long does setup take?', 'Most agencies are live within an afternoon: upload your project details, pick your look and paste one snippet on your site.'],
  ['Can my team take over a chat?', 'Any time. You see the conversation live and can reply yourself, then hand back to the bot.'],
  ['Which languages does it speak?', 'English and Hindi work well today, and it follows the buyer into other Indian languages.'],
  ['Is our data safe?', 'Each agency has its own isolated workspace. Data is encrypted in transit and you control who on your team sees what.'],
  ['What happens after the free trial?', 'Pick a plan or stop. We never charge without you choosing a plan first.'],
  ['Do you integrate with our CRM or calendar?', 'Google Calendar is built in. Webhooks and an API let you send leads to other systems.'],
];

export const Faq: React.FC = () => {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className={sectionPad} aria-labelledby="faq-title">
      <div className={`${container} max-w-3xl`}>
        <h2 id="faq-title" className={h2}>Questions, answered</h2>
        <div className="mt-8 divide-y divide-border rounded-xl border border-border bg-surface">
          {FAQS.map(([q, a], i) => {
            const isOpen = open === i;
            return (
              <div key={q}>
                <h3>
                  <button type="button" id={`faq-q-${i}`} aria-expanded={isOpen} aria-controls={`faq-a-${i}`} onClick={() => setOpen(isOpen ? null : i)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-base font-semibold text-text hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent">
                    {q}<ChevronDown aria-hidden className={`h-5 w-5 shrink-0 text-text-muted transition-transform motion-reduce:transition-none ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                </h3>
                <div id={`faq-a-${i}`} role="region" aria-labelledby={`faq-q-${i}`} hidden={!isOpen} className="px-5 pb-5 text-sm text-text-muted">{a}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export const ClosingDemo: React.FC = () => (
  <section id="demo" className="bg-accent-soft py-16 sm:py-24" aria-labelledby="demo-title">
    <div className={`${container} grid items-start gap-10 lg:grid-cols-2`}>
      <div>
        <h2 id="demo-title" className={h2}>See PropBot answer your buyers</h2>
        <p className="mt-3 max-w-2xl text-base text-text sm:text-lg">Book a 20 minute demo. We will set it up with one of your own projects so you can see real answers.</p>
        <ul className="mt-6 space-y-2.5 text-sm text-text">
          {['A live walkthrough, no slides', 'Your project loaded before the call', 'Clear pricing, no pressure'].map(t => <li key={t} className="flex items-center gap-2.5"><Check aria-hidden className="h-4 w-4 text-success" />{t}</li>)}
        </ul>
      </div>
      <DemoForm />
    </div>
  </section>
);

export const MarketingFooter: React.FC = () => (
  <footer className="border-t border-border bg-surface">
    <div className={`${container} flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between`}>
      <div>
        <p className="flex items-center gap-2 font-bold text-text"><Compass aria-hidden className="h-5 w-5 text-accent" /> PropBot Pro</p>
        <p className="mt-1 text-sm text-text-muted">AI chatbot and CRM for real estate teams.</p>
      </div>
      <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {NAV.map(n => <a key={n.href} href={n.href} className="text-text-muted hover:text-text">{n.label}</a>)}
        <Link to="/login" className="text-text-muted hover:text-text">Log in</Link>
        <Link to="/status" className="text-text-muted hover:text-text">Status</Link>
        <Link to="/changelog" className="text-text-muted hover:text-text">Changelog</Link>
      </nav>
    </div>
    <p className={`${container} pb-8 text-xs text-text-muted`}>© {new Date().getFullYear()} PropBot Pro. Demo data on this page is fictional.</p>
  </footer>
);
