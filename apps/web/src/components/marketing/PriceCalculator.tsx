import React, { useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { SUBSCRIPTION_PLANS } from '@propbot/shared';
import { SectionHead } from './Kit.js';
import { scrollToId } from './scroll.js';
import { container, sectionPad } from './styles.js';

/**
 * PriceCalculator (from Cue), on PropBot's real price list. Drag the conversations you expect each month on the tick
 * bar and the smallest plan that covers them lights up on the brushed-silver tabs; tap a plan and the bar settles on
 * what it includes. Monthly or yearly, the total rolls in big digits and the lines below show what it is made of,
 * from the same SUBSCRIPTION_PLANS the app bills with, so nothing here can drift from the real prices. Past the
 * biggest plan the total becomes "Let's talk" and the button jumps to the demo form. Colours come from the site's
 * theme tokens, so light and dark follow it.
 */
const PLAN_IDS = ['starter', 'growth', 'enterprise'] as const;
const PLANS = PLAN_IDS.map(id => SUBSCRIPTION_PLANS[id]!);
const MIN = 100;
const MAX = Math.max(...PLANS.map(p => p.limits.conversationsPerMonth));
const TOP = MAX + 1;                       // one step past the biggest plan = "let's talk"
const TICKS = 48;
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const num = (n: number) => Math.round(n).toLocaleString('en-IN');
const toPos = (n: number) => Math.log(n / MIN) / Math.log(TOP / MIN);
const fromPos = (p: number) => Math.max(MIN, Math.min(TOP, Math.round(MIN * Math.exp(Math.max(0, Math.min(1, p)) * Math.log(TOP / MIN)))));
const snap = (n: number) => (n < 1000 ? Math.round(n / 50) * 50 : Math.round(n / 250) * 250) || MIN;
const cap = (p: (typeof PLANS)[number]) => p.limits.conversationsPerMonth;
const fits = (n: number) => PLANS.findIndex(p => cap(p) >= n);

const includes = (p: (typeof PLANS)[number]) => [
  `${p.limits.chatbots >= 999 ? 'Unlimited' : p.limits.chatbots} chatbots`,
  `${p.limits.users >= 999 ? 'Unlimited' : p.limits.users} team members`,
  p.limits.whatsappNumbers ? `${p.limits.whatsappNumbers} WhatsApp number${p.limits.whatsappNumbers > 1 ? 's' : ''}` : 'Website widget',
  ...(p.limits.features.workflows ? ['Flows and automations'] : []),
  ...(p.limits.features.voice ? ['Voice agents'] : []),
];

// a number whose digits roll to their new value; separators stay put
function Roll({ value, className }: { value: string; className?: string }) {
  return (
    <span className={`pcx-roll${className ? ` ${className}` : ''}`} aria-label={value}>
      {value.split('').map((ch, i) => /\d/.test(ch)
        ? <span key={value.length - i} className="pcx-col" style={{ transform: `translateY(${-Number(ch)}em)` }} aria-hidden="true">{'0123456789'.split('').map(d => <span key={d}>{d}</span>)}</span>
        : <span key={`s${value.length - i}`} aria-hidden="true">{ch}</span>)}
    </span>
  );
}

export const PriceCalculator: React.FC = () => {
  const [volume, setVolume] = useState(1500);
  const [yearly, setYearly] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [text, setText] = useState('1,500');
  const barRef = useRef<HTMLDivElement>(null);

  const custom = volume > MAX;
  const idx = custom ? PLANS.length - 1 : fits(volume);
  const plan = PLANS[idx]!;
  const monthly = yearly ? plan.priceInrAnnually / 12 : plan.priceInrMonthly;
  const yearOff = plan.priceInrMonthly * 12 - plan.priceInrAnnually;
  const lines = useMemo(() => {
    const l = [{ label: `${plan.name} plan · up to ${num(cap(plan))} conversations`, amount: plan.priceInrMonthly }];
    if (yearly && yearOff > 0) l.push({ label: `Yearly billing, ${Math.round((yearOff / (plan.priceInrMonthly * 12)) * 100)}% off`, amount: -(plan.priceInrMonthly - plan.priceInrAnnually / 12) });
    return l;
  }, [plan, yearly, yearOff]);

  const set = (n: number) => { const v = Math.max(MIN, Math.min(TOP, n)); setVolume(v); setText(v > MAX ? `${num(MAX)}+` : num(v)); };
  const setFromX = (x: number) => { const r = barRef.current!.getBoundingClientRect(); const v = fromPos((x - r.left) / r.width); set(v >= TOP ? TOP : snap(v)); };
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId); setFromX(e.clientX); setDragging(true);
    const mv = (ev: PointerEvent) => setFromX(ev.clientX);
    const up = () => { setDragging(false); removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  };
  const onKey = (e: React.KeyboardEvent) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (d) { e.preventDefault(); set(volume >= TOP && d < 0 ? MAX : volume + d * (volume < 1000 ? 50 : 250) * (e.shiftKey ? 10 : 1)); }
    if (e.key === 'Home') set(MIN);
    if (e.key === 'End') set(TOP);
  };
  const pick = (i: number) => { if (custom || cap(PLANS[i]!) < volume || (i > 0 && cap(PLANS[i - 1]!) >= volume)) set(Math.min(Math.max(volume, i ? cap(PLANS[i - 1]!) + 1 : MIN), cap(PLANS[i]!))); };

  const knob = toPos(Math.min(volume, TOP));
  const marks = PLANS.map(p => ({ n: cap(p), label: num(cap(p)) }));
  const next = PLANS[idx + 1];

  return (
    <section id="plan-finder" className={`pcx ${sectionPad}`} aria-labelledby="pcx-title">
      <style>{CSS}</style>
      <div className={container}>
        <SectionHead id="pcx-title" n="12a" label="Plan finder" title="Find the plan that fits your volume" lead="Slide to the conversations you expect in a month. We show the smallest plan that covers them, and what it costs." center />
        <div className="pcx-card mt-12">
          <div className="pcx-l">
            <div className="pcx-sec">
              <div className="pcx-lab"><span>Plan</span></div>
              <div className="pcx-tabs" role="radiogroup" aria-label="Plan" style={{ ['--n' as string]: PLANS.length } as CSSProperties}>
                <i className="ind" style={{ transform: `translateX(${idx * 100}%)` }}><span key={plan.id} className="sh" /></i>
                {PLANS.map((p, i) => (
                  <button key={p.id} type="button" role="radio" aria-checked={i === idx} onClick={() => pick(i)}>
                    <span>{p.name}</span><small>{inr(p.priceInrMonthly)} / mo</small>
                  </button>
                ))}
              </div>
              <div className="pcx-blurb">{plan.tagline}</div>
            </div>

            <div className="pcx-sec">
              <div className="pcx-lab">
                <span>Conversations a month</span>
                <input className="pcx-num" value={text} inputMode="numeric" aria-label="Conversations a month"
                  onChange={e => { setText(e.target.value); const n = parseInt(e.target.value.replace(/\D/g, ''), 10); if (n) setVolume(Math.max(MIN, Math.min(TOP, n))); }}
                  onBlur={() => set(volume)} />
              </div>
              <div ref={barRef} className={`pcx-seats${dragging ? ' drag' : ''}`} role="slider" tabIndex={0} aria-label="Conversations a month" aria-valuemin={MIN} aria-valuemax={MAX}
                aria-valuenow={Math.min(volume, MAX)} aria-valuetext={custom ? `More than ${num(MAX)} conversations` : `${num(volume)} conversations`} onPointerDown={onDown} onKeyDown={onKey}>
                <div className="pcx-ticks" aria-hidden="true">
                  {Array.from({ length: TICKS }, (_, i) => {
                    const at = (i + 0.5) / TICKS, cut = marks.some(m => Math.abs(toPos(m.n) - at) < 0.5 / TICKS);
                    const near = Math.max(0, 1 - (Math.abs(at - knob) * TICKS) / 4), lift = 0.62 + 0.38 * near * near;
                    return <i key={i} className={`${at <= knob ? 'on' : ''}${cut ? ' cut' : ''}`} style={{ transform: `scaleY(${lift + (cut ? 0.08 : 0)})`, ['--k' as string]: knob ? Math.min(1, at / knob) : 1 } as CSSProperties} />;
                  })}
                </div>
                <span className="pcx-knob" style={{ left: `${knob * 100}%` }}><span className="pcx-bub">{custom ? `${num(MAX)}+` : num(volume)}</span></span>
                <div className="pcx-marks" aria-hidden="true">{marks.map(m => <span key={m.n} className={volume >= m.n ? 'on' : undefined} style={{ left: `${toPos(m.n) * 100}%` }}>{m.label}</span>)}</div>
              </div>
              <div className="pcx-step"><span className="d" style={{ background: custom ? 'var(--text-faint)' : undefined }} />
                {custom ? `Over ${num(MAX)} conversations: we will put together a custom plan` : next ? `${plan.name} covers up to ${num(cap(plan))}. Past that, ${next.name} starts at ${inr(next.priceInrMonthly)} a month.` : `${plan.name} covers up to ${num(cap(plan))} conversations a month.`}
              </div>
            </div>

            <div className="pcx-sec">
              <div className="pcx-lab"><span>Billing</span></div>
              <div className="pcx-bill" role="radiogroup" aria-label="Billing">
                <i className="ind" style={{ transform: `translateX(${yearly ? 100 : 0}%)` }}><span key={String(yearly)} className="sh" /></i>
                <button type="button" role="radio" aria-checked={!yearly} className={!yearly ? 'on' : undefined} onClick={() => setYearly(false)}>Monthly</button>
                <button type="button" role="radio" aria-checked={yearly} className={yearly ? 'on' : undefined} onClick={() => setYearly(true)}>Yearly<em>2 months free</em></button>
              </div>
            </div>

            <div className="pcx-sec" style={{ marginBottom: 0 }}>
              <div className="pcx-lab"><span>Included in {plan.name}</span></div>
              <ul className="pcx-inc">{includes(plan).map(f => <li key={f}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>{f}</li>)}</ul>
            </div>
          </div>

          <div className="pcx-r" aria-live="polite">
            <div className="pcx-tl">Total{!custom && yearly ? ', billed yearly' : ''}</div>
            {custom
              ? <div className="pcx-big"><span className="pcx-talk">Let&apos;s talk</span></div>
              : <div className="pcx-big"><span className="cur">₹</span><Roll value={num(monthly)} /></div>}
            <div className="pcx-per">{custom ? `Custom pricing past ${num(MAX)} conversations` : 'per month, GST extra where it applies'}</div>
            {!custom && (
              <div className="pcx-lines">
                {lines.map(l => (
                  <div key={l.label.replace(/[\d,]+/g, '#')} className="pcx-li">
                    <span>{l.label}</span>
                    <span className={l.amount < 0 ? 'neg' : undefined}>{l.amount < 0 ? '−' : ''}₹<Roll className="rollsm" value={num(Math.abs(l.amount))} /></span>
                  </div>
                ))}
              </div>
            )}
            {!custom && (
              <div className="pcx-sum">
                {yearly && <span>{inr(plan.priceInrAnnually)} billed once a year</span>}
                <span className="save"><i />{yearly ? `You save ${inr(yearOff)} a year with yearly billing` : `Switch to yearly and save ${inr(yearOff)} a year`}</span>
              </div>
            )}
            <div className="pcx-grow" />
            {custom
              ? <button type="button" className="pcx-cta" onClick={() => scrollToId('demo')}>Talk to us<Arrow /></button>
              : <Link to="/register" data-burst="money" className="pcx-cta">Start free trial<Arrow /></Link>}
            <div className="pcx-fine">{custom ? 'Book a demo and we will size it with you' : 'Free trial, no card needed, cancel anytime'}</div>
          </div>
        </div>
      </div>
    </section>
  );
};

const Arrow = () => <svg width="13" height="13" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6h7M6.5 3l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;

const CSS = `
.pcx{--card:var(--surface);--ink:var(--text);--sub:var(--text-muted);--mute:var(--text-faint);--line:var(--border);--line2:var(--border);--chip:var(--surface-2);--acc:var(--accent);--good:var(--success);--tick:var(--border)}
.pcx *,.pcx *::before,.pcx *::after{box-sizing:border-box}
.pcx button{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer;text-align:left}
.pcx :focus-visible{outline:2px solid var(--acc);outline-offset:2px}
.pcx-card{position:relative;width:100%;max-width:980px;margin-left:auto;margin-right:auto;background:var(--card);border:1px solid var(--line);border-radius:24px;display:grid;grid-template-columns:1.15fr 1fr;overflow:hidden}
.pcx-l{padding:30px 32px 32px}
.pcx-r{padding:30px 32px 32px;border-left:1px solid var(--line);display:flex;flex-direction:column}
.pcx-sec{margin-bottom:26px}
.pcx-lab{display:flex;justify-content:space-between;align-items:baseline;font-size:12.5px;color:var(--sub);margin-bottom:10px}
.pcx-tabs{position:relative;display:grid;grid-template-columns:repeat(var(--n),1fr);padding:4px;border-radius:14px;background:var(--chip)}
.pcx-tabs .ind{position:absolute;top:4px;bottom:4px;left:4px;width:calc((100% - 8px)/var(--n));border-radius:10px;transition:transform .45s cubic-bezier(.22,1,.36,1)}
.pcx-tabs .ind,.pcx-bill .ind{overflow:hidden;background:repeating-linear-gradient(90deg,rgba(255,255,255,.14) 0 1px,rgba(0,0,0,.025) 1px 2px,rgba(255,255,255,.05) 2px 3px),linear-gradient(160deg,#fbfbfc 0%,#dfe2e7 26%,#f7f8fa 46%,#cfd3da 68%,#eef0f3 86%,#d9dce1 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.95),inset 0 -1px 0 rgba(0,0,0,.12),inset 0 0 0 1px rgba(0,0,0,.06)}
.pcx-tabs .ind .sh,.pcx-bill .ind .sh{position:absolute;top:-20%;bottom:-20%;left:-60%;width:45%;transform:skewX(-18deg);background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.95),rgba(255,255,255,0));animation:pcxSheen 1.1s cubic-bezier(.3,.6,.3,1) both}
@keyframes pcxSheen{from{left:-60%}to{left:120%}}
:is(.dark,[data-theme='dark']) .pcx .pcx-tabs .ind,:is(.dark,[data-theme='dark']) .pcx .pcx-bill .ind{background:repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 1px,rgba(0,0,0,.08) 1px 2px,rgba(255,255,255,.02) 2px 3px),linear-gradient(160deg,#5a5d65 0%,#2e3036 28%,#4c4f57 48%,#26282d 70%,#40434a 88%,#2b2d33 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.22),inset 0 -1px 0 rgba(0,0,0,.4),inset 0 0 0 1px rgba(255,255,255,.06)}
:is(.dark,[data-theme='dark']) .pcx .pcx-tabs .ind .sh,:is(.dark,[data-theme='dark']) .pcx .pcx-bill .ind .sh{background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.35),rgba(255,255,255,0))}
.pcx-tabs button{position:relative;z-index:1;height:54px;border-radius:10px;padding:0 14px;display:grid;align-content:center;gap:2px}
.pcx-tabs button span{font-size:13.5px;font-weight:500}
.pcx-tabs button small{font-size:11.5px;color:var(--mute);font-variant-numeric:tabular-nums}
.pcx-tabs button[aria-checked="true"] span,.pcx-tabs button[aria-checked="true"] small{color:#17181a}
:is(.dark,[data-theme='dark']) .pcx .pcx-tabs button[aria-checked="true"] span{color:#f2f2f3}
:is(.dark,[data-theme='dark']) .pcx .pcx-tabs button[aria-checked="true"] small{color:#b4b4ba}
.pcx-blurb{margin-top:9px;font-size:12px;color:var(--mute);min-height:2.4em}
.pcx-seats{position:relative;height:58px;padding-top:12px;touch-action:none;cursor:pointer;user-select:none;-webkit-user-select:none;outline:none}
.pcx-ticks{position:absolute;left:0;right:0;top:18px;height:26px;display:flex;align-items:flex-end;gap:3px}
.pcx-ticks i{flex:1;height:100%;border-radius:2px;background:var(--tick);transform-origin:bottom;transition:background .2s,transform .35s cubic-bezier(.3,1.4,.5,1)}
.pcx-ticks i.on{background:color-mix(in srgb,var(--acc) calc(45% + 55% * var(--k,1)),color-mix(in srgb,var(--acc) 35%,var(--card)))}
.pcx-ticks i.cut{box-shadow:inset 0 -3px 0 rgba(0,0,0,.08)}
.pcx-knob{position:absolute;top:12px;width:2px;height:38px;margin-left:-1px;border-radius:2px;background:var(--acc);pointer-events:none}
.pcx-knob::after{content:'';position:absolute;left:50%;bottom:-9px;width:16px;height:16px;margin-left:-8px;border-radius:50%;background:var(--card);box-shadow:inset 0 0 0 2.5px var(--acc);transition:transform .2s cubic-bezier(.3,1.5,.5,1)}
.pcx-seats.drag .pcx-knob::after,.pcx-seats:focus-visible .pcx-knob::after{transform:scale(1.18)}
.pcx-bub{position:absolute;top:-22px;left:50%;transform:translate(-50%,4px);padding:4px 8px;border-radius:7px;background:var(--acc);color:var(--on-accent);font:500 11px Inter,sans-serif;font-variant-numeric:tabular-nums;white-space:nowrap;opacity:0;transition:opacity .18s,transform .25s cubic-bezier(.3,1.4,.5,1)}
.pcx-bub::after{content:'';position:absolute;left:50%;bottom:-3px;width:6px;height:6px;margin-left:-3px;background:var(--acc);transform:rotate(45deg);border-radius:1px}
.pcx-seats.drag .pcx-bub,.pcx-seats:hover .pcx-bub,.pcx-seats:focus-visible .pcx-bub{opacity:1;transform:translate(-50%,0)}
.pcx-marks{position:absolute;left:0;right:0;top:56px;height:12px;font-size:10.5px;color:var(--mute);font-variant-numeric:tabular-nums}
.pcx-marks span{position:absolute;transform:translateX(-50%);white-space:nowrap;transition:color .2s}
.pcx-marks span:last-child{transform:translateX(-100%)}
.pcx-marks span.on{color:var(--acc)}
.pcx-step{display:flex;align-items:flex-start;gap:8px;margin-top:24px;font-size:12px;line-height:1.45;color:var(--sub)}
.pcx-step .d{flex:none;margin-top:5px;width:6px;height:6px;border-radius:50%;background:var(--good)}
.pcx-num{width:84px;height:30px;border-radius:8px;border:1px solid var(--line2);background:var(--card);color:var(--ink);text-align:right;padding:0 8px;margin:0;font:500 13px Inter,sans-serif;font-variant-numeric:tabular-nums;outline:none}
.pcx-num:focus{border-color:var(--ink)}
.pcx-bill{display:inline-grid;grid-template-columns:1fr 1fr;position:relative;padding:3px;border-radius:11px;background:var(--chip)}
.pcx-bill .ind{position:absolute;top:3px;bottom:3px;left:3px;width:calc(50% - 3px);border-radius:8px;transition:transform .4s cubic-bezier(.22,1,.36,1)}
.pcx-bill button{position:relative;z-index:1;height:32px;padding:0 16px;font-size:13px;color:var(--sub);transition:color .25s;white-space:nowrap}
.pcx-bill button.on{color:#17181a;font-weight:500}
:is(.dark,[data-theme='dark']) .pcx .pcx-bill button.on{color:#f2f2f3}
.pcx-bill em{font-style:normal;font-size:11px;margin-left:6px;color:var(--good)}
:is(.dark,[data-theme='dark']) .pcx .pcx-bill button.on em{color:#7ee2a8}
.pcx-inc{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:8px 16px}
.pcx-inc li{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--ink)}
.pcx-inc svg{color:var(--acc);flex:none}
.pcx-tl{font-size:12.5px;color:var(--sub)}
.pcx-big{display:flex;align-items:flex-start;gap:2px;margin:8px 0 4px;font:500 56px/1 Inter,sans-serif;letter-spacing:-.045em;font-variant-numeric:tabular-nums;height:58px;color:var(--ink)}
.pcx-big .cur{font-size:28px;margin-top:6px;letter-spacing:0;color:var(--sub)}
.pcx-roll{display:inline-flex;overflow:hidden;height:1em;line-height:1}
.pcx-col{display:inline-flex;flex-direction:column;transition:transform .7s cubic-bezier(.22,1,.36,1)}
.pcx-col span{height:1em}
.pcx-talk{font:500 44px/58px Inter,sans-serif;letter-spacing:-.04em}
.pcx-per{font-size:13px;color:var(--mute)}
.pcx-lines{margin:22px 0 0;padding:16px 0 0;border-top:1px solid var(--line);display:grid;gap:9px;font-size:13px}
.pcx-li{display:flex;justify-content:space-between;gap:12px;animation:pcxIn .35s cubic-bezier(.22,1,.36,1)}
@keyframes pcxIn{from{opacity:0;transform:translateY(-4px)}}
.pcx-li span:first-child{color:var(--sub)}
.pcx-li .neg{color:var(--good)}
.pcx-li span:last-child{display:inline-flex;font-variant-numeric:tabular-nums;color:var(--ink)}
.pcx-li .neg{color:var(--good)}
.pcx-sum{margin-top:14px;padding-top:14px;border-top:1px solid var(--line);display:grid;gap:6px;font-size:12.5px;color:var(--sub)}
.pcx-sum .save{display:flex;align-items:center;gap:6px;color:var(--good)}
.pcx-sum .save i{width:6px;height:6px;border-radius:50%;background:var(--good)}
.pcx-grow{flex:1;min-height:20px}
.pcx .pcx-cta{height:46px;width:100%;border-radius:13px;background:var(--acc);color:var(--on-accent);text-align:center;font-size:14px;font-weight:500;display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;transition:transform .12s,opacity .2s}
.pcx-cta:hover{opacity:.9}
.pcx-cta:active{transform:scale(.98)}
.pcx-fine{margin-top:10px;text-align:center;font-size:11.5px;color:var(--mute)}
@media (max-width:760px){.pcx-card{grid-template-columns:1fr}.pcx-r{border-left:0;border-top:1px solid var(--line)}.pcx-l,.pcx-r{padding:24px 20px}.pcx-tabs button{padding:0 10px}.pcx-big{font-size:46px}.pcx-inc{grid-template-columns:1fr}}
@media (prefers-reduced-motion:reduce){.pcx *{animation:none!important;transition:none!important}}
`;
