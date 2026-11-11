import React, { useId, useState } from 'react';
import { ArrowRight, Check, Clock, TrendingUp, X } from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '@propbot/shared';
import { formatInr } from '../../lib/format.js';
import { Magnetic, Odometer, SectionHead } from './Kit.js';
import { roi, type RoiInput } from './roi.js';
import { btnPrimary, container, sectionPad } from './styles.js';

// ───────────────────────────────────────────────────────────── before and after

const COMPARE: Array<[string, string, string]> = [
  ['First reply', 'Hours later, or the next morning', 'Under 10 seconds, any hour'],
  ['After 8 pm and on Sundays', 'Enquiries wait until someone is in', 'Answered and booked while you sleep'],
  ['Qualifying a buyer', 'Three calls to learn the budget', 'Budget, BHK and timeline captured in the chat'],
  ['Site visits', 'Back-and-forth on WhatsApp', 'Real slots offered, reminders sent'],
  ['Follow-ups', 'Depends on who remembers', 'Run on their own until the buyer replies'],
  ['Knowing what works', 'A spreadsheet nobody trusts', 'Source, funnel and forecast on one screen'],
];

/**
 * Before and after as one sheet with a divider you can drag: pull it left and the PropBot side takes over.
 * Phones and screen readers get the same content as a plain table.
 */
export const Compare: React.FC = () => {
  const [split, setSplit] = useState(50);
  return (
    <section id="compare" className={`${sectionPad} bg-surface`} aria-labelledby="compare-title">
      <div className={container}>
        <SectionHead id="compare-title" n="04" label="Before / after" title="The same enquiry, two outcomes" lead="What changes on the day you switch PropBot on." center />

        {/* the interactive sheet: its rows are decorative for assistive tech, the table below carries the content */}
        <div className="s-crop cmp relative mt-10 hidden bg-bg md:block" data-cursor="Drag" style={{ '--split-n': split / 100 } as React.CSSProperties}>
          <div aria-hidden className="cmp-row cmp-head">
            <span />
            <span className="mk-mono text-text-muted">Without PropBot</span>
            <span className="mk-mono text-accent">With PropBot</span>
          </div>
          {COMPARE.map(([moment, before, after], i) => (
            <div key={moment} aria-hidden className="cmp-row">
              <span className="font-semibold text-text">{moment}</span>
              <span className="cmp-before">
                <Clock className="h-4 w-4 shrink-0" />
                <span className="truncate">{before}</span>
              </span>
              <span className="cmp-after" style={{ '--i': i } as React.CSSProperties}>
                <Check className="h-4 w-4 shrink-0 text-accent" />
                <span className="truncate">{after}</span>
              </span>
            </div>
          ))}
          <span aria-hidden className="cmp-handle">
            <i />
          </span>
          <input
            type="range"
            min={22}
            max={78}
            value={split}
            aria-label="Divider between without and with PropBot"
            aria-valuetext={`${100 - split}% with PropBot`}
            onChange={e => setSplit(Number(e.target.value))}
            className="cmp-range"
          />
        </div>
        <p aria-hidden className="dim mt-4 hidden md:flex">
          Drag the divider
        </p>

        <div className="mt-10 overflow-x-auto md:sr-only">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">An enquiry without PropBot and with PropBot</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-3 pr-3 font-semibold text-text-muted">
                  Moment
                </th>
                <th scope="col" className="px-3 py-3 font-semibold text-text-muted">
                  Without PropBot
                </th>
                <th scope="col" className="bg-accent-soft px-3 py-3 font-bold text-accent">
                  With PropBot
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map(([moment, before, after]) => (
                <tr key={moment} className="border-b border-border align-top last:border-0">
                  <th scope="row" className="py-3 pr-3 font-semibold text-text">
                    {moment}
                  </th>
                  <td className="px-3 py-3 text-text-muted">
                    <X aria-hidden className="mb-1 h-4 w-4 text-danger" />
                    {before}
                  </td>
                  <td className="bg-accent-soft/60 px-3 py-3 font-medium text-text">
                    <Check aria-hidden className="mb-1 h-4 w-4 text-success" />
                    {after}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

// ───────────────────────────────────────────────────────────── ROI calculator

const FIELDS: Array<{ key: keyof RoiInput; label: string; min: number; max: number; step: number; show: (n: number) => string }> = [
  { key: 'enquiries', label: 'Enquiries a month', min: 50, max: 5000, step: 50, show: n => n.toLocaleString('en-IN') },
  { key: 'missedPct', label: 'Missed or answered late today', min: 5, max: 80, step: 5, show: n => `${n}%` },
  { key: 'visitPct', label: 'Answered enquiries that visit', min: 2, max: 40, step: 1, show: n => `${n}%` },
  { key: 'bookingPct', label: 'Visits that book', min: 2, max: 40, step: 1, show: n => `${n}%` },
  { key: 'earnPerBooking', label: 'You earn per booking', min: 25_000, max: 2_000_000, step: 25_000, show: formatInr },
];

/** Largest value each bar can reach with every slider at its maximum; bars use a cube-root scale so small numbers still show. */
const BAR_MAX = [4000, 800, 160];
const barHeight = (value: number, max: number) => `${Math.max(6, Math.round(Math.cbrt(Math.min(1, value / max)) * 100))}%`;

export const RoiCalculator: React.FC = () => {
  const id = useId();
  const [input, setInput] = useState<RoiInput>({ enquiries: 600, missedPct: 40, visitPct: 12, bookingPct: 10, earnPerBooking: 200_000 });
  const out = roi(input);
  const plan = SUBSCRIPTION_PLANS.growth!;
  const multiple = Math.floor(out.revenue / plan.priceInrMonthly);
  const bars: Array<[number, string]> = [
    [out.recovered, 'enquiries answered'],
    [out.visits, 'more site visits'],
    [out.bookings, 'more bookings'],
  ];

  return (
    <section id="roi" className={`${sectionPad} relative overflow-clip`} aria-labelledby="roi-title">
      <div aria-hidden className="aurora pointer-events-none absolute inset-0 opacity-60" />
      <div className={`${container} relative`}>
        <SectionHead id="roi-title" n="11" label="The sum" title="What are slow replies costing you?" lead="Move the sliders to match your agency. The sum is simple, and you can check it yourself." />

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="s-crop space-y-6 bg-surface p-6">
            {FIELDS.map(f => (
              <div key={f.key}>
                <div className="flex items-baseline justify-between gap-3">
                  <label htmlFor={`${id}-${f.key}`} className="text-sm font-medium text-text">
                    {f.label}
                  </label>
                  <output htmlFor={`${id}-${f.key}`} className="text-sm font-bold tabular-nums text-accent">
                    {f.show(input[f.key])}
                  </output>
                </div>
                <input
                  id={`${id}-${f.key}`}
                  type="range"
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  value={input[f.key]}
                  onChange={e => setInput(s => ({ ...s, [f.key]: Number(e.target.value) }))}
                  className="mt-2 h-6 w-full cursor-pointer accent-accent"
                />
              </div>
            ))}
          </div>

          <div className="s-product flex flex-col p-6">
            <p className="flex items-center gap-2 text-sm font-semibold text-text-muted">
              <TrendingUp aria-hidden className="h-4 w-4 text-accent" /> Extra revenue each month
            </p>
            <p className="mt-2 text-5xl font-extrabold tracking-tight text-brass" aria-live="polite">
              <Odometer value={formatInr(out.revenue)} />
            </p>
            {/* three buildings that grow and shrink with the sliders */}
            <dl className="roi-bars mt-6">
              {bars.map(([n, l], i) => (
                <div key={l}>
                  <span aria-hidden className="roi-bar" data-last={i === 2} style={{ height: barHeight(n, BAR_MAX[i]!) }} />
                  <dd className="mt-2 text-xl font-bold tabular-nums text-text">
                    <Odometer value={n.toLocaleString('en-IN')} />
                  </dd>
                  <dt className="mt-0.5 text-xs text-text-muted">{l}</dt>
                </div>
              ))}
            </dl>
            <p className="mt-5 flex-1 text-sm text-text-muted">
              {multiple >= 1
                ? `That is about ${multiple.toLocaleString('en-IN')}x the ${plan.name} plan at ${formatInr(plan.priceInrMonthly)} a month.`
                : `The ${plan.name} plan is ${formatInr(plan.priceInrMonthly)} a month.`}
            </p>
            <Magnetic className="mt-5 !block">
              <a href="#demo" data-burst="money" className={`${btnPrimary} w-full`}>
                Get these visits <ArrowRight aria-hidden className="h-4 w-4" />
              </a>
            </Magnetic>
            <p className="mt-3 text-xs text-text-muted">An estimate from your own numbers, not a promise.</p>
          </div>
        </div>
      </div>
    </section>
  );
};
