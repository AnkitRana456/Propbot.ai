import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BellRing, Calendar, CalendarCheck, Check, ChevronDown, Compass, Flame, Hand, Inbox, KanbanSquare, LayoutDashboard, MessageCircle, MousePointerClick, Sparkles, Users, type LucideIcon } from 'lucide-react';
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
import { btnPrimary, btnSecondary, container, h2, lead, sectionPad } from './styles.js';

// ───────────────────────────────────────────────────────────── hero

export const Hero: React.FC = () => (
  <section id="top" className="relative overflow-clip" aria-labelledby="hero-title">
    <div aria-hidden className="aurora pointer-events-none absolute inset-0" />
    <div aria-hidden className="grid-fade pointer-events-none absolute inset-0" />
    <div aria-hidden className="drift pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
    <div aria-hidden className="drift pointer-events-none absolute -right-16 bottom-10 h-64 w-64 rounded-full bg-brass/20 blur-3xl [animation-delay:-6s]" />
    <div className={`${container} relative grid items-center gap-8 py-10 sm:py-14 lg:grid-cols-[0.92fr_1.08fr] lg:gap-10 lg:py-12`}>
      <div>
        <p className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold text-accent">
          <Sparkles aria-hidden className="h-3.5 w-3.5" /> AI chatbot and CRM for real estate
        </p>
        <h1 id="hero-title" className="mt-6 text-4xl font-extrabold leading-[1.06] tracking-tight text-text sm:text-5xl lg:text-[3.4rem]">
          Turn every property enquiry into a <span className="text-gradient">booked site visit</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-text-muted">PropBot answers buyers on your website and WhatsApp in seconds, qualifies them, books the visit and hands your team a warm lead, day or night.</p>
        <div className="mt-9 flex flex-wrap gap-3">
          <a href="#demo" data-burst="party" className={`${btnPrimary} h-12 px-7 shadow-float`}>
            Book a demo <ArrowRight aria-hidden className="h-4 w-4" />
          </a>
          <Link to="/register" data-burst="home" className={`${btnSecondary} h-12 px-7`}>
            Start free trial
          </Link>
        </div>
        <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-muted">
          {['Free trial, no card', 'Live in an afternoon', 'English and Hindi'].map(t => (
            <li key={t} className="flex items-center gap-1.5">
              <Check aria-hidden className="h-4 w-4 text-success" />
              {t}
            </li>
          ))}
        </ul>
        <p className="mt-6 flex max-w-md items-start gap-2 text-sm text-text-muted">
          <MousePointerClick aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          The tower is your pipeline: every window is a buyer. Click one to book it, or drag to turn the tower.
        </p>
      </div>

      <div id="pipeline">
        <PipelineTower />
      </div>
    </div>
  </section>
);

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
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="tour-title" className={h2}>
            Your whole sales desk in one dashboard
          </h2>
          <p className={`${lead} mx-auto`}>Take a look around. All of this is in the product on day one.</p>
        </div>
        <div role="tablist" aria-label="Dashboard views" className="mx-auto mt-8 flex w-fit max-w-full flex-wrap justify-center gap-1 rounded-xl border border-border bg-surface p-1">
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
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${active === i ? 'bg-accent text-on-accent shadow-sm' : 'text-text-muted hover:text-text'}`}
              >
                <Icon aria-hidden className="h-4 w-4" />
                {x.label}
              </button>
            );
          })}
        </div>

        <div id="tour-panel" role="tabpanel" aria-labelledby={`tour-tab-${t.id}`} className="mt-12">
          {/* the dashboard stands up in 3D, with the phone in front and live cards around it */}
          <div className="relative mx-auto max-w-5xl pb-10">
            <Tilt max={6}>
              <BrowserFrame url={`app.propbot.pro/${t.id === 'dashboard' ? 'overview' : t.id}`}>
                <ThemedImage key={t.id} name={t.id} alt={t.alt} width={1200} height={750} />
              </BrowserFrame>
              <div className="absolute -bottom-6 right-2 hidden w-32 sm:block md:w-40 lg:-right-8 lg:w-44" style={{ transform: 'translateZ(70px)' }}>
                <PhoneFrame>
                  <ThemedImage name="chat" alt="Chatbot conversation that ends with a booked Saturday site visit" width={390} height={800} />
                </PhoneFrame>
              </div>
            </Tilt>
            {[
              { card: c1, cls: 'absolute -left-2 top-[36%] hidden sm:flex lg:-left-12', slow: false },
              { card: c2, cls: 'absolute -bottom-2 left-6 hidden md:flex lg:left-10', slow: true },
              { card: c3, cls: 'absolute -top-5 left-24 hidden lg:flex', slow: true },
            ].map(({ card, cls, slow }) => (
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
  <section aria-labelledby="proof-title" className={sectionPad}>
    <div className={container}>
      <h2 id="proof-title" className="sr-only">
        What agencies typically see
      </h2>
      <ul className="grid grid-cols-2 gap-6 text-center lg:grid-cols-4">
        {[
          ['< 10 sec', 'first reply, any hour'],
          ['3x', 'more enquiries answered'],
          ['40%', 'more site visits booked'],
          ['24/7', 'always on'],
        ].map(([n, l]) => (
          <li key={l}>
            <Reveal>
              <p className="text-4xl font-extrabold tracking-tight text-accent">{n}</p>
              <p className="mt-1 text-sm text-text-muted">{l}</p>
            </Reveal>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-center text-xs text-text-muted">Illustrative figures to show what is possible. Your results will vary.</p>
    </div>
  </section>
);

// ───────────────────────────────────────────────────────────── use cases, features, audiences

export const UseCases: React.FC = () => (
  <section id="use-cases" className={`${sectionPad} bg-surface`} aria-labelledby="use-title">
    <div className={container}>
      <h2 id="use-title" className={h2}>
        One assistant for the whole enquiry journey
      </h2>
      <p className={lead}>From the first message to the site visit, nothing waits for someone to be free.</p>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {USE_CASES.map(({ id, icon: Icon, title, body }, i) => (
          <li key={id}>
            <Reveal delay={i * 60} className="h-full">
              <div
                id={useCaseHref(id).slice(1)}
                data-burst="spark"
                className="hl-target group h-full cursor-pointer rounded-xl border border-border bg-bg p-6 transition duration-300 hover:-translate-y-1.5 hover:border-accent/50 hover:shadow-float motion-reduce:hover:translate-y-0"
              >
                <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-110">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-text">{title}</h3>
                <p className="mt-1.5 text-sm text-text-muted">{body}</p>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
    </div>
  </section>
);

export const FeatureGrid: React.FC = () => (
  <section id="features" className={sectionPad} aria-labelledby="feat-title">
    <div className={container}>
      <div className="max-w-2xl">
        <h2 id="feat-title" className={h2}>
          The details that make the difference
        </h2>
        <p className={lead}>Twelve features your team will use every day. Open one from the Features menu to jump straight to it.</p>
      </div>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ id, icon: Icon, title, body, product }, i) => {
          const owner = PRODUCTS.find(p => p.id === product);
          return (
            <li key={id}>
              <Reveal delay={(i % 3) * 60} className="h-full">
                <div id={`feat-${id}`} className="hl-target group h-full rounded-xl border border-border bg-surface p-5 transition duration-300 hover:-translate-y-1 hover:shadow-float motion-reduce:hover:translate-y-0">
                  <div className="flex items-center gap-3">
                    <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="text-base font-semibold text-text">{title}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-text-muted">{body}</p>
                  {owner && (
                    <a href={productHref(owner.id)} onClick={e => followLink(e, productHref(owner.id))} className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
                      Part of {owner.name}
                      <ArrowRight aria-hidden className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </Reveal>
            </li>
          );
        })}
      </ul>
    </div>
  </section>
);

export const BuiltFor: React.FC = () => (
  <section id="built-for" className={`${sectionPad} bg-surface`} aria-labelledby="built-title">
    <div className={container}>
      <h2 id="built-title" className={h2}>
        Built for the way Indian real estate sells
      </h2>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {AUDIENCES.map(a => (
          <li key={a.id} className="rounded-xl border border-border bg-bg p-5">
            <h3 className="font-semibold text-text">{a.title}</h3>
            <p className="mt-1 text-sm text-text-muted">{a.body}</p>
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
      <h2 id="how-title" className={h2}>
        Live in an afternoon
      </h2>
      <p className={lead}>From an empty plot to a sold home. Tap a scene to see it celebrate.</p>
      <ol className="mt-10 grid gap-6 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.title}>
            <Reveal delay={i * 80} className="h-full">
              <div className="h-full overflow-clip rounded-xl border border-border bg-surface">
                <ModelScene Model={step.Model} emojis={step.emojis} name={step.name} width={520} height={330} anchor={step.anchor} autoSold={step.autoSold} hint={false} className="bg-gradient-to-b from-accent-soft/40 to-transparent" />
                <div className="p-6 pt-4">
                  <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-accent font-bold text-on-accent">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-text">{step.title}</h3>
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
        <h2 id="price-title" className={h2}>
          Simple pricing in rupees
        </h2>
        <p className={lead}>Start with a free trial. Prices per month, GST extra where it applies.</p>
        <ul className="mt-10 grid gap-6 lg:grid-cols-3">
          {plans.map(p => (
            <li key={p.id}>
              <Tilt max={3} wrapperClassName="h-full" className="h-full">
                <div className={`flex h-full flex-col rounded-2xl border bg-bg p-6 ${p.highlight ? 'border-accent shadow-float' : 'border-border'}`}>
                  {p.highlight && <span className="mb-3 w-fit rounded-full bg-accent px-3 py-0.5 text-xs font-bold text-on-accent">Most popular</span>}
                  <h3 className="text-xl font-bold text-text">{p.name}</h3>
                  <p className="mt-1 min-h-[3rem] text-sm text-text-muted">{p.tagline}</p>
                  <p className="mt-4 text-4xl font-extrabold tracking-tight text-text">
                    {inr(p.priceInrMonthly)}
                    <span className="text-base font-medium text-text-muted"> /month</span>
                  </p>
                  <ul className="mt-5 flex-1 space-y-2.5">
                    {feats(p).map(f => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-text">
                        <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link to="/register" data-burst="money" className={`${p.highlight ? btnPrimary : btnSecondary} mt-6`}>
                    Start free trial
                  </Link>
                </div>
              </Tilt>
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
        <h2 id="faq-title" className={h2}>
          Questions, answered
        </h2>
        <div className="mt-8 divide-y divide-border rounded-xl border border-border bg-surface">
          {FAQS.map(([q, a], i) => {
            const isOpen = open === i;
            return (
              <div key={q}>
                <h3>
                  <button
                    type="button"
                    id={`faq-q-${i}`}
                    aria-expanded={isOpen}
                    aria-controls={`faq-a-${i}`}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-base font-semibold text-text hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                  >
                    {q}
                    <ChevronDown aria-hidden className={`h-5 w-5 shrink-0 text-text-muted transition-transform motion-reduce:transition-none ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                </h3>
                <div id={`faq-a-${i}`} role="region" aria-labelledby={`faq-q-${i}`} hidden={!isOpen} className="px-5 pb-5 text-sm text-text-muted">
                  {a}
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
        <h2 id="demo-title" className={h2}>
          See PropBot answer your buyers
        </h2>
        <p className="mt-3 max-w-2xl text-base text-text sm:text-lg">Book a 20 minute demo. We will set it up with one of your own projects so you can see real answers.</p>
        <ul className="mt-6 space-y-2.5 text-sm text-text">
          {['A live walkthrough, no slides', 'Your project loaded before the call', 'Clear pricing, no pressure'].map(t => (
            <li key={t} className="flex items-center gap-2.5">
              <Check aria-hidden className="h-4 w-4 text-success" />
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
        <ul className="mt-3 space-y-2 text-sm">
          {PRODUCTS.map(p => (
            <li key={p.id}>
              <a href={productHref(p.id)} onClick={e => followLink(e, productHref(p.id))} className="text-text-muted hover:text-text">
                {p.name}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <nav aria-label="Footer: use cases">
        <h2 className="text-sm font-semibold text-text">Use cases</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {USE_CASES.map(u => (
            <li key={u.id}>
              <a href={useCaseHref(u.id)} className="text-text-muted hover:text-text">
                {u.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <nav aria-label="Footer: company">
        <h2 className="text-sm font-semibold text-text">Company</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {[
            ['Pricing', '#pricing'],
            ['FAQ', '#faq'],
            ['How it works', '#how'],
          ].map(([label, href]) => (
            <li key={href}>
              <a href={href} className="text-text-muted hover:text-text">
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
              <Link to={to!} className="text-text-muted hover:text-text">
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
