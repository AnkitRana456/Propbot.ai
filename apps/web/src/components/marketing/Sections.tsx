import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BellRing, Calendar, CalendarCheck, Check, Compass, Flame, Hand, Inbox, KanbanSquare, LayoutDashboard, MessageCircle, MousePointerClick, Plus, Sparkles, Users, type LucideIcon } from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '@propbot/shared';
import { BrowserFrame, FloatingCard, PhoneFrame, Reveal, ThemedImage, Tilt } from './Frames.js';
import { DemoForm } from './DemoForm.js';
import { PipelineTower } from './PipelineTower.js';
import { FlipSign, Skyline3D } from './Skyline3D.js';
import { ModelScene } from './ModelScene.js';
import { ApartmentModel, PlotModel, VillaModel } from './PropertyModels.js';
import type { EmojiSet } from './EmojiBurst.js';
import { AUDIENCES, FEATURES, PRODUCTS, USE_CASES, productHref, useCaseHref } from './content.js';
import { followLink } from './MegaNav.js';
import { Fig, Magnetic, Odometer, SectionHead, Wipe } from './Kit.js';
import { btnPrimary, btnSecondary, container, sectionPad } from './styles.js';

// ───────────────────────────────────────────────────────────── hero

export const Hero: React.FC = () => {
  // the headline plays in from CSS; once done it switches class so scroll can drive it
  const [played, setPlayed] = useState(false);
  return (
    <section id="top" className="relative overflow-clip" aria-labelledby="hero-title">
      <div aria-hidden className="aurora pointer-events-none absolute inset-0" />
      <div aria-hidden className="grid-fade pointer-events-none absolute inset-0" />
      <div className={`${container} relative grid items-center gap-6 py-6 sm:gap-8 sm:py-14 lg:grid-cols-[0.92fr_1.08fr] lg:gap-10 lg:py-12`}>
        <div data-hero-copy>
          <Fig n="01" label="AI chatbot and CRM for real estate" />
          <h1 id="hero-title" onAnimationEnd={e => (e.target as Element).classList.contains('text-gradient') && setPlayed(true)} className={`words ${played ? 'in' : 'auto'} text-4xl font-extrabold leading-[1.06] tracking-tight text-text sm:text-5xl lg:text-[3.4rem]`}>
            {['Turn every property', 'enquiry into a'].map((line, i) => (
              <span key={line} className="w !block">
                <span style={{ '--i': i * 3 } as React.CSSProperties}>{line}</span>
              </span>
            ))}
            <span className="w !block">
              <span className="text-gradient" style={{ '--i': 6 } as React.CSSProperties}>
                booked site visit
              </span>
            </span>
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-text-muted sm:mt-6 sm:text-lg">PropBot answers buyers on your website and WhatsApp in seconds, qualifies them, books the visit and hands your team a warm lead, day or night.</p>
          <div className="mt-6 flex flex-wrap items-center gap-3 sm:mt-9">
            <Magnetic>
              <a href="#demo" data-burst="party" data-cursor="Book" className={`${btnPrimary} h-12 px-7`}>
                Book a demo <ArrowRight aria-hidden className="h-4 w-4" />
              </a>
            </Magnetic>
            <Link to="/register" data-burst="home" className={`${btnSecondary} h-12 px-7`}>
              Start free trial
            </Link>
          </div>
          <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-muted sm:mt-8">
            {['Free trial, no card', 'Live in an afternoon', 'English and Hindi'].map(t => (
              <li key={t} className="flex items-center gap-1.5">
                <Check aria-hidden className="h-4 w-4 text-success" />
                {t}
              </li>
            ))}
          </ul>
          <p className="mt-6 hidden max-w-md items-start gap-2 text-sm text-text-muted lg:flex">
            <MousePointerClick aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            The tower is your pipeline: every window is a buyer. Click one to book it, or drag to turn the tower.
          </p>
        </div>

        <div id="pipeline" data-hero-tower>
          <div data-hero-parallax>
            <PipelineTower />
          </div>
        </div>
      </div>
    </section>
  );
};

export const TrustStrip: React.FC = () => (
  <section aria-label="Connections" className="border-y border-border bg-surface">
    <div className={`${container} flex flex-wrap items-center justify-center gap-x-8 gap-y-2.5 py-6 text-sm font-medium`}>
      <span className="text-text-muted">Connects to</span>
      {['Website chat', 'WhatsApp Business', 'Instagram', 'Messenger', 'Google Calendar', 'Stripe', 'Meta Lead Ads', 'Google Ads', '99acres', 'MagicBricks', 'Housing.com'].map(t => (
        <span key={t} className="text-text">
          {t}
        </span>
      ))}
    </div>
  </section>
);

// ───────────────────────────────────────────────────────────── second section: the dashboard

interface TourCard {
  icon: LucideIcon;
  title: string;
  sub: string;
}
interface TourTab {
  id: string;
  label: string;
  icon: LucideIcon;
  title: string;
  body: string;
  alt: string;
  cards: [TourCard, TourCard, TourCard];
}

const TOUR: TourTab[] = [
  {
    id: 'dashboard',
    label: 'Overview',
    icon: LayoutDashboard,
    title: 'Know where every enquiry stands',
    body: "Leads per day, where they come from, today's visits and who needs a call, on one screen.",
    alt: 'Overview dashboard with lead trends and a table of enquiries',
    cards: [
      { icon: Flame, title: 'Hot lead: Priya S.', sub: '3 BHK · ₹1.2 Cr · score 92' },
      { icon: CalendarCheck, title: 'Visit booked', sub: 'Saturday, 11:00 am' },
      { icon: BellRing, title: 'Replied in 4 seconds', sub: 'Website chat' },
    ],
  },
  {
    id: 'kanban',
    label: 'Pipeline',
    icon: KanbanSquare,
    title: 'Move buyers from first chat to booking',
    body: 'Drag leads between New, Qualified, Site visit and Booked. Budgets are shown in lakhs and crores.',
    alt: 'Kanban pipeline of buyer leads',
    cards: [
      { icon: Flame, title: 'Moved to Site visit', sub: 'Priya S. · 3 BHK' },
      { icon: Sparkles, title: 'Hot leads first', sub: 'Sorted by score' },
      { icon: CalendarCheck, title: 'Follow-up due', sub: 'Today, 4:30 pm' },
    ],
  },
  {
    id: 'inbox',
    label: 'Inbox',
    icon: Inbox,
    title: 'WhatsApp and web chat in one inbox',
    body: 'Watch the bot work, or take over any conversation in one click.',
    alt: 'Shared inbox with a WhatsApp conversation',
    cards: [
      { icon: MessageCircle, title: 'WhatsApp reply sent', sub: 'Priya S. · 4 seconds' },
      { icon: Hand, title: 'You took over', sub: 'Hand back any time' },
      { icon: BellRing, title: 'New message', sub: 'Rohan M. on Instagram' },
    ],
  },
  {
    id: 'visits',
    label: 'Visits',
    icon: Calendar,
    title: 'A calendar that fills itself',
    body: "Visits booked by the bot land on your team's calendar, with reminders sent to buyers.",
    alt: 'Week calendar of site visits',
    cards: [
      { icon: CalendarCheck, title: 'Visit booked', sub: 'Sat 11:00 · Priya S.' },
      { icon: BellRing, title: 'Reminder sent', sub: '24 hours before' },
      { icon: Users, title: 'Agent assigned', sub: 'Neha G.' },
    ],
  },
];

export const ProductTour: React.FC = () => {
  const [active, setActive] = useState(0);
  const t = TOUR[active]!;
  const [c1, c2, c3] = t.cards;
  const CardIcon = (icon: LucideIcon) => {
    const I = icon;
    return <I className="h-4 w-4" />;
  };
  return (
    <section id="tour" className={`${sectionPad} relative overflow-clip`} aria-labelledby="tour-title">
      <div aria-hidden className="aurora pointer-events-none absolute inset-0 opacity-70" />
      <div className={`${container} relative`}>
        <SectionHead id="tour-title" n="03" label="The sales desk" title="Your whole sales desk in one dashboard" lead="Take a look around. All of this is in the product on day one." center />
        <div role="tablist" aria-label="Dashboard views" className="mx-auto mt-8 flex w-fit max-w-full flex-wrap justify-center gap-1 rounded-full border border-border bg-surface p-1">
          {TOUR.map((x, i) => {
            const Icon = x.icon;
            return (
              <button
                key={x.id}
                role="tab"
                id={`tour-tab-${x.id}`}
                aria-selected={active === i}
                aria-controls="tour-panel"
                tabIndex={active === i ? 0 : -1}
                onClick={() => setActive(i)}
                onKeyDown={e => {
                  if (e.key === 'ArrowRight') setActive((i + 1) % TOUR.length);
                  if (e.key === 'ArrowLeft') setActive((i + TOUR.length - 1) % TOUR.length);
                }}
                className={`inline-flex items-center gap-2 min-h-10 rounded-full px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${active === i ? 'bg-accent text-on-accent shadow-sm' : 'text-text-muted hover:text-text'}`}
              >
                <Icon aria-hidden className="h-4 w-4" />
                {x.label}
              </button>
            );
          })}
        </div>

        <div id="tour-panel" role="tabpanel" aria-labelledby={`tour-tab-${t.id}`} className="mt-12">
          {/* the dashboard stands up in 3D, with the phone in front and live cards around it */}
          <div data-tour-frame className="relative mx-auto max-w-5xl pb-10">
            <Tilt max={6}>
              <BrowserFrame url={`app.propbot.pro/${t.id === 'dashboard' ? 'overview' : t.id}`}>
                <div key={t.id} className="jpanel">
                  {t.id === 'kanban' ? (
                    <React.Suspense fallback={<div className="aspect-[1200/750] animate-pulse bg-surface-2" />}>
                      <PipelineBoard />
                    </React.Suspense>
                  ) : (
                    <ThemedImage name={t.id} alt={t.alt} width={1200} height={750} />
                  )}
                </div>
              </BrowserFrame>
              <div className={`absolute -bottom-6 right-2 w-32 md:w-40 lg:-right-8 lg:w-44 ${t.id === 'kanban' ? 'hidden' : 'hidden sm:block'}`} style={{ transform: 'translateZ(70px)' }}>
                <PhoneFrame>
                  <ThemedImage name="chat" alt="Chatbot conversation that ends with a booked Saturday site visit" width={390} height={800} />
                </PhoneFrame>
              </div>
            </Tilt>
            {[
              { card: c1, cls: 'absolute -left-2 top-[36%] hidden sm:flex lg:-left-12', slow: false },
              { card: c2, cls: 'absolute -bottom-2 left-6 hidden md:flex lg:left-10', slow: true },
              { card: c3, cls: 'absolute -top-5 left-24 hidden lg:flex', slow: true },
            ].filter(() => t.id !== 'kanban').map(({ card, cls, slow }) => (
              <FloatingCard key={`${t.id}-${card.title}`} slow={slow} className={`${cls} items-center gap-2.5`}>
                <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  {CardIcon(card.icon)}
                </span>
                <span>
                  <span className="block font-semibold text-text">{card.title}</span>
                  <span className="block text-text-muted">{card.sub}</span>
                </span>
              </FloatingCard>
            ))}
          </div>
          <div className="mx-auto mt-4 max-w-xl text-center">
            <h3 className="text-xl font-semibold text-text">{t.title}</h3>
            <p className="mt-1.5 text-sm text-text-muted">{t.body}</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export const ProofBand: React.FC = () => (
  <section aria-labelledby="proof-title" className="border-y border-border">
    <div className={container}>
      <h2 id="proof-title" className="sr-only">
        What agencies typically see
      </h2>
      <ul className="grid grid-cols-2 lg:grid-cols-4">
        {[
          ['< 10 sec', 'first reply, any hour'],
          ['3x', 'more enquiries answered'],
          ['40%', 'more site visits booked'],
          ['24/7', 'always on'],
        ].map(([n, l], i) => (
          <li key={l} className={`px-4 py-10 sm:px-8 sm:py-14 ${i % 2 ? 'border-l border-border' : ''} ${i > 1 ? 'border-t border-border lg:border-t-0' : ''} lg:border-l lg:first:border-l-0`}>
            <p className="mk-mono text-text-muted">0{i + 1}</p>
            <p className="mt-3 text-4xl font-extrabold tracking-tight text-accent sm:text-5xl">{n}</p>
            <p className="mt-2 text-sm text-text-muted">{l}</p>
          </li>
        ))}
      </ul>
      <p className="dim pb-6">Illustrative figures to show what is possible. Your results will vary.</p>
    </div>
  </section>
);

// ───────────────────────────────────────────────────────────── use cases, features, audiences

/** The journey as floors of a building: the headline stays put while the floors scroll past. */
export const UseCases: React.FC = () => (
  <section id="use-cases" className={`${sectionPad} bg-surface`} aria-labelledby="use-title">
    <div className={`${container} grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16`}>
      <SectionHead id="use-title" n="07" label="Floor by floor" title="One assistant for the whole enquiry journey" lead="From the first message to the site visit, nothing waits for someone to be free." className="lg:sticky lg:top-28 lg:self-start" />
      <ol className="ticks pl-0 md:pl-6">
        {USE_CASES.map(({ id, icon: Icon, title, body }, i) => (
          <li key={id} id={useCaseHref(id).slice(1)} data-burst="spark" className="hl-target group grid cursor-pointer grid-cols-[3.5rem_1fr_auto] items-start gap-4 border-t border-border py-6 transition-colors last:border-b hover:bg-bg">
            <span className="mk-mono pt-1.5 text-text-muted">L{String(USE_CASES.length - i).padStart(2, '0')}</span>
            <span>
              <h3 className="text-lg font-semibold text-text">{title}</h3>
              <p className="mt-1.5 max-w-md text-sm text-text-muted">{body}</p>
            </span>
            <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-accent transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 group-hover:border-accent">
              <Icon className="h-5 w-5" />
            </span>
          </li>
        ))}
      </ol>
    </div>
  </section>
);

/** A specification sheet: one outlined drawing with twelve cells, not twelve cards. */
export const FeatureGrid: React.FC = () => (
  <section id="features" className={sectionPad} aria-labelledby="feat-title">
    <div className={container}>
      <SectionHead id="feat-title" n="08" label="Specification" title="The details that make the difference" lead="Twelve features your team will use every day. Open one from the Features menu to jump straight to it." />
      <ul className="s-crop mt-10 grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ id, icon: Icon, title, body, product }, i) => {
          const owner = PRODUCTS.find(p => p.id === product);
          return (
            <li key={id} id={`feat-${id}`} className="hl-target group flex flex-col bg-bg p-6 transition-colors hover:bg-surface">
              <div className="flex items-center justify-between">
                <span className="mk-mono text-text-muted">F-{String(i + 1).padStart(2, '0')}</span>
                <Icon aria-hidden className="h-5 w-5 text-accent transition-transform duration-300 group-hover:scale-125" />
              </div>
              <h3 className="mt-5 text-base font-semibold text-text">{title}</h3>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-text-muted">{body}</p>
              {owner && (
                <a href={productHref(owner.id)} onClick={e => followLink(e, productHref(owner.id))} className="mt-4 inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-accent hover:underline">
                  Part of {owner.name}
                  <ArrowRight aria-hidden className="h-3 w-3" />
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  </section>
);

/** A building directory: who is on which floor. */
export const BuiltFor: React.FC = () => (
  <section id="built-for" className={`${sectionPad} bg-surface`} aria-labelledby="built-title">
    <div className={container}>
      <SectionHead id="built-title" n="09" label="Directory" title="Built for the way Indian real estate sells" />
      <ul className="mt-10 grid sm:grid-cols-2 sm:gap-x-12">
        {AUDIENCES.map((a, i) => (
          <li key={a.id} className="flex items-baseline gap-5 border-t border-border py-6">
            <span className="mk-mono w-8 shrink-0 text-accent">0{i + 1}</span>
            <span>
              <h3 className="text-lg font-semibold text-text">{a.title}</h3>
              <p className="mt-1 text-sm text-text-muted">{a.body}</p>
            </span>
          </li>
        ))}
      </ul>
    </div>
  </section>
);

// ───────────────────────────────────────────────────────────── how it works, pricing, FAQ

const STEPS: Array<{ title: string; body: string; Model: React.FC<{ sold: boolean }>; emojis: EmojiSet; name: string; autoSold?: boolean; anchor: number }> = [
  { title: 'Add your projects', body: 'Upload brochures, price lists and FAQs. PropBot learns them.', Model: PlotModel, emojis: 'land', name: 'A plot of land', anchor: 0.78 },
  { title: 'Match your brand', body: 'Pick colours, a greeting and the questions to ask. Preview it live.', Model: ApartmentModel, emojis: 'tower', name: 'An apartment block', anchor: 0.82 },
  { title: 'Paste one snippet', body: 'Add the widget to your site and connect WhatsApp. Leads start flowing.', Model: VillaModel, emojis: 'home', name: 'A villa', autoSold: true, anchor: 0.82 },
];

export const HowItWorks: React.FC = () => (
  <section id="how" className={sectionPad} aria-labelledby="how-title">
    <div className={container}>
      <SectionHead id="how-title" n="10" label="Setup" title="Live in an afternoon" lead="From an empty plot to a sold home. Tap a scene to see it celebrate." />
      <p aria-hidden className="dim mt-10 hidden md:flex">
        One afternoon
      </p>
      <ol className="mt-6 grid gap-6 md:grid-cols-3 md:items-end">
        {STEPS.map((step, i) => (
          <li key={step.title} className={i === 1 ? 'md:-translate-y-6' : ''}>
            <Reveal delay={i * 80} className="h-full">
              <div className="s-product h-full overflow-clip">
                <ModelScene Model={step.Model} emojis={step.emojis} name={step.name} width={520} height={330} anchor={step.anchor} autoSold={step.autoSold} hint={false} className="bg-gradient-to-b from-accent-soft/40 to-transparent" />
                <div className="p-6 pt-4">
                  <span className="mk-mono text-accent">Step 0{i + 1}</span>
                  <h3 className="mt-2 text-lg font-semibold text-text">{step.title}</h3>
                  <p className="mt-1.5 text-sm text-text-muted">{step.body}</p>
                </div>
              </div>
            </Reveal>
          </li>
        ))}
      </ol>
    </div>
  </section>
);

const PipelineBoard = React.lazy(() => import('./PipelineBoard.js'));

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/** A price list on one sheet: three columns share one outline, the popular one is lifted off the page. */
export const Pricing: React.FC = () => {
  const plans = [SUBSCRIPTION_PLANS.starter!, SUBSCRIPTION_PLANS.growth!, SUBSCRIPTION_PLANS.enterprise!];
  const [annual, setAnnual] = useState(false);
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
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHead id="price-title" n="12" label="Price list" title="Simple pricing in rupees" lead="Start with a free trial. Prices per month, GST extra where it applies." />
          <div role="group" aria-label="Billing period" className="inline-flex gap-1 rounded-full border border-border bg-bg p-1">
            {[false, true].map(a => (
              <button key={String(a)} type="button" aria-pressed={annual === a} onClick={() => setAnnual(a)} className={`min-h-10 rounded-full px-4 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${annual === a ? 'bg-accent text-on-accent' : 'text-text-muted hover:text-text'}`}>
                {a ? 'Yearly, 2 months free' : 'Monthly'}
              </button>
            ))}
          </div>
        </div>
        <ul className="s-crop mt-12 grid bg-bg lg:grid-cols-3">
          {plans.map((p, i) => (
            <li key={p.id} className={`flex flex-col p-7 ${p.highlight ? 's-product relative z-10 lg:-my-5 lg:py-12' : i ? 'border-t border-border lg:border-l lg:border-t-0' : ''}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-text">{p.name}</h3>
                {p.highlight && <span className="rounded-full bg-accent px-3 py-0.5 text-xs font-bold text-on-accent">Most popular</span>}
              </div>
              <p className="mt-6 text-4xl font-extrabold tracking-tight text-text">
                <Odometer value={inr(annual ? Math.round(p.priceInrAnnually / 12) : p.priceInrMonthly)} />
              </p>
              <p className="mt-2 min-h-[1rem] text-xs text-text-muted">per month{annual ? ` · ${inr(p.priceInrAnnually)} billed yearly` : ''}</p>
              <p className="mt-5 min-h-[2.5rem] text-sm text-text-muted">{p.tagline}</p>
              <ul className="mt-5 flex-1 border-t border-border">
                {feats(p).map(f => (
                  <li key={f} className="flex items-center gap-2.5 border-b border-border py-2.5 text-sm text-text">
                    <Check aria-hidden className="h-4 w-4 shrink-0 text-accent" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/register" data-burst="money" className={`${p.highlight ? btnPrimary : btnSecondary} mt-7`}>
                Start free trial
              </Link>
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
      <div className={`${container} grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16`}>
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHead id="faq-title" n="13" label="Questions" title="Questions, answered" />
          <p className="mt-4 text-sm text-text-muted">Something else on your mind? Ask it on a demo call, with your own project on screen.</p>
          <a href="#demo" className="mt-5 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-accent hover:underline">
            Book a demo <ArrowRight aria-hidden className="h-3.5 w-3.5" />
          </a>
        </div>
        <div className="border-b border-border">
          {FAQS.map(([q, a], i) => {
            const isOpen = open === i;
            return (
              <div key={q} className="border-t border-border">
                <h3>
                  <button
                    type="button"
                    id={`faq-q-${i}`}
                    aria-expanded={isOpen}
                    aria-controls={`faq-a-${i}`}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="group flex w-full items-baseline gap-4 py-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <span className="mk-mono w-10 shrink-0 text-text-muted">Q.{String(i + 1).padStart(2, '0')}</span>
                    <span className={`flex-1 text-base font-semibold transition-colors sm:text-lg ${isOpen ? 'text-accent' : 'text-text group-hover:text-accent'}`}>{q}</span>
                    <Plus aria-hidden className={`h-5 w-5 shrink-0 self-center text-text-muted transition-transform duration-300 motion-reduce:transition-none ${isOpen ? 'rotate-45 text-accent' : ''}`} />
                  </button>
                </h3>
                <div id={`faq-a-${i}`} role="region" aria-labelledby={`faq-q-${i}`} aria-hidden={!isOpen} data-open={isOpen} className="acc">
                  <div>
                    <p className="max-w-xl pb-6 pl-14 text-sm leading-relaxed text-text-muted">{a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

// ───────────────────────────────────────────────────────────── closing and footer

export const ClosingDemo: React.FC = () => (
  <section
    id="demo"
    className="relative overflow-clip bg-accent-soft py-16 sm:py-24"
    aria-labelledby="demo-title"
    onPointerMove={e => {
      const r = e.currentTarget.getBoundingClientRect();
      e.currentTarget.style.setProperty('--px', String(((e.clientX - r.left) / r.width - 0.5) * 2));
    }}
  >
    <Skyline3D />
    <div className={`${container} relative grid items-start gap-10 pb-56 lg:grid-cols-2`}>
      <div>
        <SectionHead id="demo-title" n="14" label="Your turn" title="See PropBot answer your buyers" />
        <p className="mt-4 max-w-2xl text-base text-text sm:text-lg">Book a 20 minute demo. We will set it up with one of your own projects so you can see real answers.</p>
        <ul className="mt-6 space-y-2.5 text-sm text-text">
          {['A live walkthrough, no slides', 'Your project loaded before the call', 'Clear pricing, no pressure'].map(t => (
            <li key={t} className="flex items-center gap-2.5">
              <Check aria-hidden className="h-4 w-4 text-accent" />
              {t}
            </li>
          ))}
        </ul>
        <FlipSign />
      </div>
      <DemoForm />
    </div>
  </section>
);

export const MarketingFooter: React.FC = () => (
  <footer className="border-t border-border bg-surface">
    <div className={`${container} pt-12`}>
      <Wipe />
    </div>
    <div className={`${container} grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]`}>
      <div>
        <p className="flex items-center gap-2 font-bold text-text">
          <Compass aria-hidden className="h-5 w-5 text-accent" /> PropBot Pro
        </p>
        <p className="mt-2 max-w-xs text-sm text-text-muted">AI chatbot and CRM for real estate teams.</p>
        <a href="#demo" className={`${btnPrimary} mt-5 h-10`}>
          Book a demo
        </a>
      </div>
      <nav aria-label="Footer: product">
        <h2 className="text-sm font-semibold text-text">Product</h2>
        <ul className="mt-3 text-sm">
          {PRODUCTS.map(p => (
            <li key={p.id}>
              <a href={productHref(p.id)} onClick={e => followLink(e, productHref(p.id))} className="flex min-h-9 items-center text-text-muted hover:text-text">
                {p.name}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <nav aria-label="Footer: use cases">
        <h2 className="text-sm font-semibold text-text">Use cases</h2>
        <ul className="mt-3 text-sm">
          {USE_CASES.map(u => (
            <li key={u.id}>
              <a href={useCaseHref(u.id)} className="flex min-h-9 items-center text-text-muted hover:text-text">
                {u.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <nav aria-label="Footer: company">
        <h2 className="text-sm font-semibold text-text">Company</h2>
        <ul className="mt-3 text-sm">
          {[
            ['Pricing', '#pricing'],
            ['FAQ', '#faq'],
            ['How it works', '#how'],
          ].map(([label, href]) => (
            <li key={href}>
              <a href={href} className="flex min-h-9 items-center text-text-muted hover:text-text">
                {label}
              </a>
            </li>
          ))}
          {[
            ['Log in', '/login'],
            ['Start free trial', '/register'],
            ['Status', '/status'],
            ['Changelog', '/changelog'],
          ].map(([label, to]) => (
            <li key={to}>
              <Link to={to!} className="flex min-h-9 items-center text-text-muted hover:text-text">
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
    <p className={`${container} pb-8 text-xs text-text-muted`}>© {new Date().getFullYear()} PropBot Pro. People, units and numbers on this page are made up.</p>
  </footer>
);
