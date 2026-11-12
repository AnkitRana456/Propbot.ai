import React, { useCallback, useEffect, useRef, useState, type KeyboardEvent as RKE, type ReactNode } from 'react';
import { container } from './styles.js';

/**
 * PhoneFeatures (from Cue's "Timed Phone Feature List"): a feature list beside an iPhone-style mockup. The active
 * feature opens to show its text with a thin line that fills like a timer; when it fills the next one opens and the
 * phone's screen switches to that feature's app sheet. Click a feature (or use ↑ ↓) to jump; hovering the list pauses
 * the timer. The timer only runs while the section is on screen and never auto-advances with reduced motion.
 * Copy is PropBot's own and describes things the product really does. The band is black on purpose, like a showcase
 * stage, in both themes; the fonts are the site's own.
 */
type IconKey = 'bolt' | 'shield' | 'code' | 'card' | 'users' | 'doc' | 'chat' | 'plug' | 'box' | 'star' | 'clock';
interface Row { icon: IconKey; text: string }
interface Feature { title: string; text: string; icon: IconKey; screen: { title: string; text: string; rows: Row[] } }

const FEATURES: Feature[] = [
  { icon: 'chat', title: 'Answers in seconds', text: 'Replies come from your own brochures and price lists, on your website and on WhatsApp, in the language the buyer writes in.',
    screen: { title: 'Instant replies', text: 'A buyer asks, PropBot answers from your documents, not from guesses.', rows: [{ icon: 'doc', text: 'Reads your brochures' }, { icon: 'chat', text: 'Web chat and WhatsApp' }, { icon: 'star', text: 'English and Hindi' }] } },
  { icon: 'bolt', title: 'Qualifies every buyer', text: 'Budget, timeline and intent are picked up from the chat and every lead is scored hot, warm or cold before your team sees it.',
    screen: { title: 'Lead scored', text: 'Rahul, 3 BHK in Whitefield, ₹1.5 Cr, wants to move in 3 months.', rows: [{ icon: 'box', text: 'Budget and timeline' }, { icon: 'bolt', text: 'Hot lead, score 86' }, { icon: 'users', text: 'Agent alerted' }] } },
  { icon: 'clock', title: 'Books the site visit', text: 'Buyers pick a slot in the chat. The visit lands on your calendar and a WhatsApp reminder goes out before it.',
    screen: { title: 'Visit booked', text: 'Saturday, 11:00 AM at Prestige Lakeside. Reminder set for the morning.', rows: [{ icon: 'clock', text: 'Slot picked in chat' }, { icon: 'plug', text: 'Added to your calendar' }, { icon: 'chat', text: 'WhatsApp reminder' }] } },
  { icon: 'users', title: 'Hands off to your team', text: 'The right agent gets the full conversation, the budget and the next step, so nobody asks the buyer the same thing twice.',
    screen: { title: 'Passed to Asha', text: 'Asha has the whole chat and knows what to ask on the call.', rows: [{ icon: 'doc', text: 'Full chat history' }, { icon: 'users', text: 'Assigned to the right agent' }, { icon: 'clock', text: 'Follow-up reminder set' }] } },
  { icon: 'code', title: 'Follows up on its own', text: 'Flows wait, remind and nudge leads that go quiet, and a daily digest tells you what moved while you were away.',
    screen: { title: 'Follow-ups', text: 'Quiet leads get a nudge. You get one clear summary each morning.', rows: [{ icon: 'code', text: 'Flows with wait steps' }, { icon: 'bolt', text: 'Reminders for stale leads' }, { icon: 'doc', text: 'Daily digest email' }] } },
  { icon: 'shield', title: 'Stays in your control', text: 'Payment links, discounts and price quotes wait for a manager’s yes before they go out, and every action is logged.',
    screen: { title: 'Waiting for you', text: 'Discount of ₹50,000 for Rahul needs your approval.', rows: [{ icon: 'card', text: 'Payment links approved' }, { icon: 'shield', text: 'Discounts need a yes' }, { icon: 'doc', text: 'Every action logged' }] } },
];

const p = (d: ReactNode) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>;
const IC: Record<IconKey, ReactNode> = {
  bolt: p(<path d="M13 3 5 13h6l-1 8 8-10h-6z" />),
  shield: p(<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />),
  code: p(<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14" />),
  card: p(<><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></>),
  users: p(<><circle cx="9" cy="9" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 6.5a3 3 0 0 1 0 5.5M17.5 19a5 5 0 0 0-2.5-4.3" /></>),
  doc: p(<><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></>),
  chat: p(<path d="M5 18l-1 3 3.5-1.6A8 8 0 1 0 4 12a7.9 7.9 0 0 0 1 6z" />),
  plug: p(<path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4" />),
  box: p(<><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M4 7.5 12 12l8-4.5M12 12v9" /></>),
  star: p(<path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.6l5.8-.8z" />),
  clock: p(<><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>),
};

const INTERVAL = 6000;

export const PhoneFeatures: React.FC = () => {
  const [act, setAct] = useState(0);
  const [shown, setShown] = useState(0);        // the screen on the phone; it follows act after a short fade
  const [prog, setProg] = useState(0);
  const paused = useRef(false), visible = useRef(false), t0 = useRef(0), acc = useRef(0);
  const btns = useRef<(HTMLButtonElement | null)[]>([]);
  const root = useRef<HTMLElement>(null);

  const go = useCallback((i: number) => { setAct((i + FEATURES.length) % FEATURES.length); acc.current = 0; t0.current = performance.now(); setProg(0); }, []);
  useEffect(() => { const t = setTimeout(() => setShown(act), 220); return () => clearTimeout(t); }, [act]);

  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === 'undefined') { visible.current = true; return; }
    const io = new IntersectionObserver(([e]) => { visible.current = !!e?.isIntersecting; }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // the timer line fills over INTERVAL, pauses while hovered or off screen, then opens the next feature
  useEffect(() => {
    const reduced = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf = 0; t0.current = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (paused.current || !visible.current || reduced) { t0.current = now; return; }
      acc.current += now - t0.current; t0.current = now;
      const k = Math.min(1, acc.current / INTERVAL); setProg(k);
      if (k >= 1) go(act + 1);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [act, go]);

  const onKey = (e: RKE, i: number) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); const n = (i + 1) % FEATURES.length; go(n); btns.current[n]?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); const n = (i - 1 + FEATURES.length) % FEATURES.length; go(n); btns.current[n]?.focus(); }
  };

  return (
    <section ref={root} id="in-action" className="ph" aria-labelledby="ph-title">
      <style>{CSS}</style>
      <div className={container}>
        <p className="ph-eye">PropBot at work</p>
        <h2 id="ph-title" className="ph-h2">One bot, from the first message to the site visit</h2>
        <div className="ph-body">
          <div className="ph-panel" aria-hidden>
            <div className="ph-phone">
              <i className="ph-btn l1" /><i className="ph-btn l2" /><i className="ph-btn l3" /><i className="ph-btn r1" />
              <div className="ph-scr">
                <div className="ph-island"><i /></div>
                <div className="ph-status">
                  <span>9:41</span>
                  <span>
                    <svg viewBox="0 0 18 12" fill="#fff"><rect x="0" y="8" width="3" height="4" rx=".8" /><rect x="5" y="5.5" width="3" height="6.5" rx=".8" /><rect x="10" y="3" width="3" height="9" rx=".8" /><rect x="15" y="0" width="3" height="12" rx=".8" /></svg>
                    <svg viewBox="0 0 16 12" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round"><path d="M1.5 4.5a9.5 9.5 0 0 1 13 0M4 7.3a6 6 0 0 1 8 0" /><circle cx="8" cy="10" r=".9" fill="#fff" /></svg>
                    <svg viewBox="0 0 26 12" fill="none"><rect x=".7" y=".7" width="22" height="10.6" rx="3" stroke="#fff" strokeOpacity=".45" strokeWidth="1.2" /><rect x="2.4" y="2.4" width="18.6" height="7.2" rx="1.8" fill="#fff" /><path d="M24.4 4.2v3.6" stroke="#fff" strokeOpacity=".45" strokeWidth="1.4" strokeLinecap="round" /></svg>
                  </span>
                </div>
                {FEATURES.map((f, i) => (
                  <div key={f.title} className={'ph-app' + (i === shown ? '' : ' out')}>
                    <div className="ph-top"><span className="ph-x">{p(<path d="M6 6l12 12M18 6 6 18" />)}</span><span className="ph-steps">{FEATURES.map((_, j) => <i key={j} className={j === i ? 'on' : ''} />)}</span></div>
                    <h4>{f.screen.title}</h4><p>{f.screen.text}</p>
                    <div className="ph-rows">{f.screen.rows.map(r => <div key={r.text} className="ph-row"><span className="ph-ri">{IC[r.icon]}</span>{r.text}</div>)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <ul className="ph-list" onMouseEnter={() => { paused.current = true; }} onMouseLeave={() => { paused.current = false; }}>
            {FEATURES.map((f, i) => (
              <li key={f.title} className={'ph-it' + (i === act ? ' on' : '')}>
                <button ref={el => { btns.current[i] = el; }} type="button" className="ph-h" aria-expanded={i === act} onClick={() => go(i)} onKeyDown={e => onKey(e, i)}><span className="ph-ic">{IC[f.icon]}</span>{f.title}</button>
                <div className="ph-d"><div><p><span className="ph-bar"><i style={{ height: `${(i === act ? prog : 0) * 100}%` }} /></span>{f.text}</p></div></div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

const CSS = `
.ph{--ink:var(--text);--dim:var(--text-faint);--line:var(--border);--hi:var(--accent);position:relative;background:var(--surface);border-block:1px solid var(--border);color:var(--ink);padding:clamp(48px,8vw,96px) 0;overflow:hidden}
.ph *,.ph *::before,.ph *::after{box-sizing:border-box}
.ph button{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer;text-align:left}
.ph :focus-visible{outline:2px solid var(--hi);outline-offset:3px}
.ph-eye{margin:0;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--hi)}
.ph-h2{margin:12px 0 0;max-width:20em;font-size:clamp(28px,4vw,44px);line-height:1.1;font-weight:700;letter-spacing:-.03em;color:var(--ink)}
.ph-body{margin-top:clamp(32px,5vw,56px);display:grid;grid-template-columns:minmax(0,.86fr) minmax(0,1.14fr);gap:clamp(24px,4vw,50px);align-items:center}
.ph-panel{position:relative;aspect-ratio:288/330;width:100%;border-radius:10px;overflow:hidden;background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 6%,var(--surface-2)) 0%,color-mix(in srgb,var(--accent) 22%,var(--surface-2)) 30%,color-mix(in srgb,var(--accent) 62%,var(--surface-2)) 62%,color-mix(in srgb,var(--accent) 38%,var(--surface)) 100%);border:1px solid var(--border)}
.ph-phone{position:absolute;left:12%;right:12%;top:7%;aspect-ratio:9/19.3;border-radius:15%/7%;background:#0b0b0c;padding:2.6%;box-shadow:inset 0 0 0 1.4px #4b4b50,inset 0 0 0 2.6px #121214,inset 0 0 0 3.4px #2c2c30}
.ph-btn{position:absolute;width:1.1%;border-radius:2px;background:#2c2c30}
.ph-btn.l1{left:-1%;top:15%;height:4%}.ph-btn.l2{left:-1%;top:22%;height:7.5%}.ph-btn.l3{left:-1%;top:31%;height:7.5%}.ph-btn.r1{right:-1%;top:25%;height:11%}
.ph-scr{position:relative;height:100%;border-radius:12.6%/5.8%;background:#000;overflow:hidden;container-type:inline-size}
.ph-island{position:absolute;left:50%;top:2.2%;width:31%;height:3.4%;margin-left:-15.5%;border-radius:999px;background:#000;z-index:3;box-shadow:0 0 0 1px #0e0e10}
.ph-island i{position:absolute;right:12%;top:50%;width:11cqw;height:11cqw;max-width:9px;max-height:9px;transform:translateY(-50%);border-radius:50%;background:radial-gradient(circle at 35% 35%,#2a3550,#06080d)}
.ph-status{position:absolute;left:0;right:0;top:0;height:9%;display:flex;align-items:center;justify-content:space-between;padding:0 9% 0 13%;font-size:5.2cqw;font-weight:600;z-index:2;color:#fff}
.ph-status svg{height:4.3cqw;width:auto}
.ph-status span:last-child{display:flex;gap:1.6cqw;align-items:center}
.ph-app{position:absolute;inset:0;padding:22cqw 8cqw 0;transition:opacity .45s,transform .55s cubic-bezier(.2,.8,.2,1),filter .45s;color:#fff}
.ph-app.out{opacity:0;transform:translateY(3%);filter:blur(4px);pointer-events:none}
.ph-top{display:flex;align-items:center;justify-content:space-between}
.ph-x{width:11cqw;height:8.4cqw;border-radius:999px;background:#1c1c1f;display:grid;place-items:center}
.ph-x svg{width:4.2cqw;height:4.2cqw}
.ph-steps{display:flex;gap:1.4cqw}
.ph-steps i{display:block;height:1.1cqw;border-radius:1cqw;background:#3a3a3e;width:3.4cqw;transition:width .4s,background .4s}
.ph-steps i.on{width:7cqw;background:#fff}
.ph-app h4{margin:14cqw 0 0;font-size:6.6cqw;font-weight:600;letter-spacing:-.02em;color:#fff}
.ph-app p{margin:2.6cqw 0 0;font-size:3.7cqw;line-height:1.45;color:#d4d4d8}
.ph-rows{margin-top:10cqw;display:grid;gap:4.6cqw}
.ph-row{display:flex;align-items:center;gap:4.4cqw;font-size:3.7cqw;color:#e4e4e7}
.ph-ri{width:10cqw;height:10cqw;border-radius:50%;background:#18181b;display:grid;place-items:center;flex:none;color:#a1a1aa}
.ph-ri svg{width:4.6cqw;height:4.6cqw}
.ph-list{list-style:none;margin:0;padding:0}
.ph-it{position:relative}
.ph-h{display:flex;align-items:center;gap:12px;width:100%;padding:9px 0;font-size:clamp(15px,1.4vw,18px);font-weight:500;letter-spacing:-.01em;color:var(--dim);transition:color .3s}
.ph-h:hover{color:var(--text-muted)}
.ph-it.on .ph-h{color:var(--ink)}
.ph-ic{width:20px;height:20px;border-radius:5px;background:var(--surface-2);display:grid;place-items:center;flex:none;color:var(--text-faint);transition:color .3s,background .3s}
.ph-ic svg{width:12px;height:12px}
.ph-it.on .ph-ic{background:var(--accent-soft);color:var(--hi)}
.ph-d{display:grid;grid-template-rows:0fr;transition:grid-template-rows .5s cubic-bezier(.2,.8,.2,1)}
.ph-it.on .ph-d{grid-template-rows:1fr}
.ph-d>div{overflow:hidden}
.ph-d p{position:relative;margin:0;padding:0 0 14px 32px;max-width:32em;font-size:clamp(13px,1.1vw,14.5px);line-height:1.65;color:var(--text-muted)}
.ph-bar{position:absolute;left:9.5px;top:2px;bottom:16px;width:1px;background:var(--line)}
.ph-bar i{position:absolute;left:0;top:0;width:100%;background:var(--hi)}
@media (max-width:820px){.ph-body{grid-template-columns:1fr;gap:24px}.ph-panel{max-width:340px;justify-self:center}}
@media (prefers-reduced-motion:reduce){.ph *{transition:none!important}}
`;
