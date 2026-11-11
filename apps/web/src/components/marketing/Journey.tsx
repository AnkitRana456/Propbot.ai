import React, { useEffect, useRef, useState } from 'react';
import { BellRing, CalendarCheck, MessageCircle, Sparkles, UserCheck } from 'lucide-react';
import { SITE } from './config.js';
import { Odometer, SectionHead } from './Kit.js';
import { ScrollTrigger, scrollToId } from './scroll.js';
import { container } from './styles.js';
import { useReducedMotion } from '../../lib/use-reduced-motion.js';

const [ENQ, QUAL, VISIT, BOOKED] = SITE.journey.funnel;

const STEPS = [
  { key: 'Enquiry', icon: Sparkles, count: ENQ, line: 'A buyer asks about a flat at 11:42 pm.' },
  { key: 'Chat', icon: MessageCircle, count: ENQ, line: 'PropBot answers in seconds, from your own price list.' },
  { key: 'Qualified', icon: UserCheck, count: QUAL, line: 'Budget, BHK and timeline are captured and scored.' },
  { key: 'Visit', icon: CalendarCheck, count: VISIT, line: 'A real slot is offered and booked in the chat.' },
  { key: 'Booked', icon: BellRing, count: BOOKED, line: 'Your team gets a warm lead and the unit is booked.' },
] as const;

/** What the product shows at each step. All people and units are made up. */
const Panel: React.FC<{ step: number }> = ({ step }) => {
  if (step === 0)
    return (
      <div className="s-crop p-5">
        <p className="mk-mono text-text-muted">New enquiry · 99acres · 11:42 pm</p>
        <p className="mt-3 text-lg font-semibold text-text">“Is the 3 BHK in Whitefield still available?”</p>
        <p className="mt-3 text-sm text-text-muted">Priya S. · +91 98xxx xx210</p>
      </div>
    );
  if (step === 1)
    return (
      <div className="space-y-2.5">
        {[
          ['buyer', 'Is the 3 BHK in Whitefield still available?'],
          ['bot', 'Yes. Tower B has two 3 BHK homes left, from ₹1.18 Cr. Would you like the floor plan?'],
          ['buyer', 'Yes please. What is the possession date?'],
          ['bot', 'December 2027, RERA registered. I have sent the plan on WhatsApp.'],
        ].map(([who, text], i) => (
          <p key={i} className={`jbubble ${who === 'bot' ? 'bot' : ''}`} style={{ animationDelay: `${i * 0.45}s` }}>
            {text}
          </p>
        ))}
        <p className="jbubble bot jtyping" style={{ animationDelay: '1.9s' }} aria-label="PropBot is typing">
          <i /> <i /> <i />
        </p>
      </div>
    );
  if (step === 2)
    return (
      <div className="s-product flex items-center gap-6 p-5">
        <svg viewBox="0 0 100 100" className="h-28 w-28 shrink-0" role="img" aria-label="Lead score 92 out of 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border)" strokeWidth="8" />
          <circle className="jring" cx="50" cy="50" r="42" fill="none" stroke="var(--brass)" strokeWidth="8" strokeLinecap="round" pathLength={100} strokeDasharray="100" transform="rotate(-90 50 50)" />
          <text x="50" y="57" textAnchor="middle" className="fill-text text-[26px] font-extrabold">
            92
          </text>
        </svg>
        <div>
          <p className="mk-mono text-brass">Hot lead</p>
          <p className="mt-1 text-lg font-semibold text-text">Priya S.</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {['₹1.2 Cr budget', '3 BHK', 'Whitefield', 'Within 60 days', 'Loan pre-approved'].map((c, i) => (
              <li key={c} className="jchip" style={{ animationDelay: `${0.25 + i * 0.12}s` }}>
                {c}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  if (step === 3)
    return (
      <div className="grid grid-cols-3 gap-2">
        {['Qualified', 'Site visit', 'Booked'].map((col, i) => (
          <div key={col} className="min-h-[9.5rem] rounded-lg border border-border bg-bg p-2">
            <p className="mk-mono mb-2 text-text-muted">{col}</p>
            {i === 1 && (
              <div className="jdrop s-product p-2.5">
                <p className="text-sm font-semibold text-text">Priya S.</p>
                <p className="text-xs text-text-muted">3 BHK · ₹1.2 Cr</p>
                <p className="mk-mono mt-2 text-accent">Sat 11:00 am</p>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  return (
    <div className="space-y-3">
      <div className="jbubble bot !max-w-full" style={{ animationDelay: '0s' }}>
        <span className="mk-mono block text-text-muted">WhatsApp · now</span>
        Your visit to Lake View, Tower B is confirmed for Saturday, 11:00 am. Neha from our team will meet you at the gate.
      </div>
      <div className="flex items-center gap-4">
        <span className="stamp flat" data-on="true">
          Booked
        </span>
        <p className="text-sm text-text-muted">
          Unit B-1203 · token received
          <br />
          Handed to Neha G. with the full chat.
        </p>
      </div>
    </div>
  );
};

/**
 * "One enquiry, one journey". On desktop the section pins for a few screens while a lead travels the line;
 * on phones, or with reduced motion, the same five steps are a plain list with nothing pinned.
 */
export const Journey: React.FC = () => {
  const reduced = useReducedMotion();
  const [pinned, setPinned] = useState(false);
  const [step, setStep] = useState(0);
  const section = useRef<HTMLElement>(null);
  const line = useRef<SVGPathElement>(null);
  const dot = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (reduced || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(min-width: 1024px) and (min-height: 640px)');
    const sync = () => setPinned(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [reduced]);

  useEffect(() => {
    if (!pinned || !section.current) return;
    const st = ScrollTrigger.create({
      trigger: section.current,
      start: 'top top',
      end: `+=${SITE.journey.scrollVh}%`,
      pin: true,
      onUpdate: self => {
        const p = self.progress;
        setStep(Math.min(STEPS.length - 1, Math.floor(p * STEPS.length)));
        line.current?.style.setProperty('stroke-dashoffset', String(100 - p * 100));
        dot.current?.style.setProperty('top', `${p * 100}%`);
      },
    });
    return () => st.kill();
  }, [pinned]);

  const head = <SectionHead id="journey-title" n="02" label="One enquiry, one journey" title="Follow one buyer from first message to booked" lead="Scroll to move the lead along. Every step below happens without anyone on your team lifting a finger." />;

  if (!pinned)
    return (
      <section id="journey" className="border-b border-border py-16 sm:py-24" aria-labelledby="journey-title">
        <div className={container}>
          {head}
          <ol className="mt-10 space-y-10">
            {STEPS.map((s, i) => (
              <li key={s.key} className="grid gap-4 border-t border-border pt-6 md:grid-cols-[14rem_1fr]">
                <div>
                  <p className="mk-mono text-accent">
                    0{i + 1} · {s.key}
                  </p>
                  <p className="mt-2 text-sm text-text-muted">{s.line}</p>
                  <p className="mt-3 text-3xl font-extrabold tabular-nums text-text">{s.count}</p>
                </div>
                <div className="jstatic max-w-xl">
                  <Panel step={i} />
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    );

  const current = STEPS[step]!;
  return (
    <section id="journey" ref={section} className="relative flex h-screen items-center overflow-clip border-b border-border" aria-labelledby="journey-title">
      <div aria-hidden className="grid-fade pointer-events-none absolute inset-0" />
      <div className={`${container} relative grid grid-cols-[1fr_1.15fr_9rem] items-center gap-10`}>
        <div>
          {head}
          <div className="relative mt-8 pl-8">
            <svg aria-hidden className="absolute left-2 top-2 h-[calc(100%-1rem)] w-2 overflow-visible" viewBox="0 0 2 100" preserveAspectRatio="none">
              <path d="M1 0V100" stroke="var(--border)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              <path ref={line} d="M1 0V100" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" pathLength={100} strokeDasharray="100" strokeDashoffset="100" />
            </svg>
            <span aria-hidden className="absolute left-2 top-2 h-[calc(100%-1rem)] w-2">
              <span ref={dot} className="jdot" data-booked={step === STEPS.length - 1} />
            </span>
            <ol className="space-y-4">
              {STEPS.map((s, i) => (
                <li key={s.key} aria-current={i === step ? 'step' : undefined} className={`transition-opacity duration-300 ${i === step ? '' : i < step ? 'opacity-60' : 'opacity-35'}`}>
                  <p className={`mk-mono ${i === step ? 'text-accent' : 'text-text-muted'}`}>
                    0{i + 1} · {s.key}
                  </p>
                  <p className="text-sm text-text">{s.line}</p>
                </li>
              ))}
            </ol>
          </div>
          <button type="button" onClick={() => scrollToId('tour')} className="mk-mono mt-8 inline-flex min-h-10 items-center text-text-muted underline underline-offset-4 hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            Skip the journey
          </button>
        </div>

        <div className="min-h-[19rem]" aria-live="polite">
          <div key={step} className="jpanel">
            <Panel step={step} />
          </div>
        </div>

        <div className="text-center">
          <ol aria-hidden className="jtower">
            {STEPS.map((s, i) => (
              <li key={s.key} data-lit={i <= step} data-top={i === STEPS.length - 1}>
                <i /> <i /> <i />
              </li>
            ))}
          </ol>
          <p className="mt-4 text-4xl font-extrabold text-text">
            <Odometer value={String(current.count)} />
          </p>
          <p className="mk-mono mt-1 text-text-muted">{step < 2 ? 'enquiries' : step === 2 ? 'qualified' : step === 3 ? 'site visits' : 'booked'}</p>
        </div>
      </div>
    </section>
  );
};
