import React, { useEffect, useRef } from 'react';
import { SectionHead } from './Kit.js';
import { container, sectionPad } from './styles.js';

/**
 * Four bento cards with a self-running motion loop each (from Cue's "Productivity Features"): ranked lead cards fan
 * out, a phone pops a visit tooltip, avatars spread apart for the handoff, and a flying cursor clicks a stats widget
 * (ripple + green pop). Pure CSS keyframes; an IntersectionObserver reveals the cards and only lets a loop run while
 * its card is on screen. Reduced motion shows the final state. Colours come from the site's theme tokens; the phone
 * screens stay light on purpose, like a real device. Copy and sample data are PropBot's own; avatars are initials,
 * not stock photos.
 */
const CARDS = [
  { title: 'Smart lead ranking', text: 'Every enquiry is scored hot, warm or cold, so your team calls the right buyer first.' },
  { title: 'Site visits that book themselves', text: 'Buyers pick a slot in chat. Reminders go out on WhatsApp so fewer visits are missed.' },
  { title: 'A clean handoff to your team', text: 'The bot passes the buyer to the right agent with the full chat, budget and next step.' },
  { title: 'Real-time alerts', text: 'Get pinged the moment a hot lead lands, a visit is booked or a payment arrives.' },
];

const Check = ({ s = 10 }: { s?: number }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 13l4 4L19 7" /></svg>;
const AVATARS: [string, string][] = [['PS', '#e8634a'], ['AM', '#4a6cf7'], ['RK', '#1f9d55']];

export const ProductivityFeatures: React.FC = () => {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const els = root.current?.querySelectorAll('.pf-rv');
    if (!els) return;
    if (typeof IntersectionObserver === 'undefined') { els.forEach(e => e.classList.add('in')); return; }
    const io = new IntersectionObserver(es => es.forEach(e => { e.target.classList.toggle('in', e.isIntersecting); }), { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    els.forEach(e => io.observe(e));
    return () => io.disconnect();
  }, []);

  return (
    <section ref={root} id="highlights" className={`pf ${sectionPad}`} aria-labelledby="pf-title">
      <style>{CSS}</style>
      <div className={container}>
        <SectionHead id="pf-title" n="08a" label="Highlights" title="Everything your sales desk needs" lead="Four things PropBot does while your team is busy selling." center />
        <div className="pf-grid mt-12">
          {CARDS.map((c, i) => (
            <article key={c.title} className="pf-card pf-rv" style={{ transitionDelay: `${(i % 2) * 0.1}s` }}>
              <div className="pf-zone" aria-hidden>
                {i === 0 && (
                  <div className="pf-fan">
                    <div className="pf-back pf-top"><span className="pf-ok"><Check s={9} /></span>Priya S. · site visit<span className="pf-chip">Sat</span></div>
                    <div className="pf-back pf-bot"><i />Warm · Whitefield</div>
                    <div className="pf-main">
                      <div className="pf-r1"><span className="pf-ok big"><Check s={13} /></span><b>Rahul V. wants a 3 BHK</b><span className="pf-chip blue">Today</span></div>
                      <p className="pf-sub">Whitefield · budget ₹1.5 Cr</p>
                      <p className="pf-pri"><i />Hot lead</p>
                    </div>
                  </div>
                )}
                {i === 1 && (
                  <div className="pf-phone">
                    <div className="pf-notch" />
                    <div className="pf-in">
                      <p className="pf-date">Thu, 12 November</p>
                      <p className="pf-hi">Good morning, Asha 🔥</p>
                      <div className="pf-widget">
                        <div className="pf-wh"><span className="pf-ok sq"><Check s={10} /></span><span><b>Prestige Lakeside</b><em>Site visits</em></span></div>
                        <div className="pf-stats3">{[['Booked', '6'], ['Pending', '2'], ['Total', '9']].map(([a, b]) => <span key={a}><em>{a}</em><b>{b}</b></span>)}</div>
                      </div>
                      <p className="pf-lab">TODAY&apos;S VISITS</p>
                      <div className="pf-task"><span className="pf-ok sm"><Check s={7} /></span><b>Priya S. · 11:00 AM</b><span className="pf-chip red">Today</span></div>
                    </div>
                    <div className="pf-tip"><span className="pf-clock"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></span><span><em>Visit confirmed</em><b>Sat, 11:00 AM</b></span></div>
                  </div>
                )}
                {i === 2 && (
                  <div className="pf-phone shift">
                    <div className="pf-notch" />
                    <div className="pf-in">
                      <p className="pf-hi big">My leads</p>
                      <p className="pf-lab muted">TOP PRIORITY</p>
                      <div className="pf-task tall">
                        <span className="pf-ok sm"><Check s={8} /></span>
                        <span className="pf-col"><b>Rahul Verma<br />wants a 3 BHK</b><em>Whitefield</em><span className="pf-chip red">Hot lead</span></span>
                        <span className="pf-day">Nov<br />12</span>
                      </div>
                    </div>
                    <div className="pf-avs">
                      <div>{AVATARS.map(([t, c], k) => <span key={t} className={`pf-av a${k + 1}`} style={{ background: c, zIndex: 4 - k }}>{t}</span>)}<span className="pf-av a4">+2</span></div>
                    </div>
                  </div>
                )}
                {i === 3 && (
                  <>
                    <div className="pf-ripple" />
                    <div className="pf-wid">
                      <div className="pf-wh big"><span className="pf-bolt"><svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" /></svg></span><span><em>TODAY</em><b>Prestige Realty</b></span></div>
                      <div className="pf-stats3 roomy">{[['Leads', '24', ''], ['Visits', '6', '/9'], ['Booked', '2', '/4']].map(([a, b, s]) => <span key={a}><em>{a}</em><b className="pf-pop">{b}<small>{s}</small></b></span>)}</div>
                    </div>
                    <svg className="pf-cursor" width="24" height="24" viewBox="0 0 24 24"><path d="M4.25 4.25L10.25 19.25L13.25 13.25L19.25 10.25L4.25 4.25Z" fill="#000" stroke="#fff" strokeWidth="2" strokeLinejoin="round" /></svg>
                  </>
                )}
              </div>
              <p className="pf-desc pf-rv" style={{ transitionDelay: `${0.4 + (i % 2) * 0.1}s` }}><strong>{c.title}</strong> {c.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

const CSS = `
.pf{--pf-a:color-mix(in srgb,var(--accent,#0b4f4a) 18%,var(--surface,#fff));--pf-ink:#111827;--pf-mut:#9ca3af}
.pf *{box-sizing:border-box}
.pf-grid{display:grid;grid-template-columns:1fr;gap:12px}
@media (min-width:768px){.pf-grid{grid-template-columns:1fr 1fr}}
.pf-card{height:500px;display:flex;flex-direction:column;overflow:hidden;border-radius:6px;border:1px solid var(--border);background:linear-gradient(to bottom,var(--surface,#fff),var(--pf-a))}
.pf-rv{opacity:0;transform:translateY(32px);transition:opacity .8s cubic-bezier(.22,1,.36,1),transform .8s cubic-bezier(.22,1,.36,1)}
.pf-rv.in{opacity:1;transform:none}
.pf-zone{position:relative;flex:1;display:flex;justify-content:center;align-items:center;padding-top:32px;overflow:hidden;perspective:1000px}
.pf-desc{margin:0;padding:24px 40px 44px;text-align:center;font-size:15px;line-height:1.6;color:var(--text-muted);position:relative;z-index:30}
.pf-desc strong{color:var(--text);font-weight:700}
.pf-ok{width:20px;height:20px;border-radius:50%;background:#10b981;color:#fff;display:grid;place-items:center;flex:none}
.pf-ok.big{width:24px;height:24px}.pf-ok.sm{width:14px;height:14px}.pf-ok.sq{width:20px;height:20px;border-radius:6px;background:#d1fae5;color:#10b981}
.pf-chip{margin-left:auto;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;background:#eff6ff;color:#3b82f6;white-space:nowrap}
.pf-chip.blue{color:#2563eb}.pf-chip.red{background:#fef2f2;color:#ef4444;font-size:9px;font-weight:600;margin:0}
/* card 1: the fan */
.pf-fan{position:relative;width:300px;height:200px;display:flex;align-items:center;justify-content:center}
.pf-back{position:absolute;width:260px;background:rgba(255,255,255,.72);backdrop-filter:blur(4px);border:1px solid #fff;border-radius:16px;padding:14px 16px;font-size:14px;font-weight:500;color:#4b5563;display:flex;align-items:center;gap:10px;color:#4b5563}
.pf-top{top:-4px;animation:pf-top 6s cubic-bezier(.22,1,.36,1) infinite}
.pf-bot{bottom:-14px;opacity:.6;font-size:13px;color:#60a5fa;padding:14px 16px 14px 32px;gap:8px;animation:pf-bot 6s cubic-bezier(.22,1,.36,1) infinite}
.pf-bot i{width:8px;height:8px;border-radius:50%;background:#93c5fd}
.pf-main{position:relative;z-index:10;width:300px;background:#fff;border:1px solid rgba(255,255,255,.8);border-radius:20px;padding:20px;box-shadow:0 20px 40px -10px rgba(0,0,0,.08);color:var(--pf-ink);animation:pf-main 6s cubic-bezier(.22,1,.36,1) infinite}
.pf-r1{display:flex;align-items:center;gap:12px}.pf-r1 b{font-size:15px;font-weight:700;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pf-sub{margin:4px 0 0 36px;font-size:13px;font-weight:500;color:var(--pf-mut)}
.pf-pri{margin:8px 0 0 36px;display:inline-flex;align-items:center;gap:6px;padding:3px 8px;border-radius:6px;background:#f9fafb;font-size:11px;font-weight:600;color:#4b5563}
.pf-pri i{width:6px;height:6px;border-radius:50%;background:#ef4444}
/* phones */
.pf-phone{position:relative;align-self:flex-end;width:220px;height:300px;margin-top:48px;transform:translateY(24px);background:#fff;border:7px solid #111;border-bottom:0;border-radius:36px 36px 0 0;box-shadow:0 20px 40px -10px rgba(0,0,0,.2);-webkit-mask-image:linear-gradient(to bottom,#000 60%,transparent 95%);mask-image:linear-gradient(to bottom,#000 60%,transparent 95%);color:var(--pf-ink);text-align:left}
.pf-phone.shift{transform:translate(-16px,24px)}
.pf-zone:has(.pf-phone){align-items:flex-end;padding-top:48px}
.pf-notch{position:absolute;top:6px;left:50%;transform:translateX(-50%);width:70px;height:18px;background:#111;border-radius:12px;z-index:10}
.pf-in{padding:40px 16px 16px}.pf-in p{margin:0}
.pf-date{font-size:9px;font-weight:500;letter-spacing:.04em;color:var(--pf-mut);margin-bottom:2px!important}
.pf-hi{font-size:14px;font-weight:700;margin-bottom:16px!important}.pf-hi.big{font-size:16px;letter-spacing:-.01em;margin-top:6px!important}
.pf-widget{border:1px solid #f3f4f6;border-radius:12px;padding:12px;margin-bottom:16px;box-shadow:0 1px 2px rgba(0,0,0,.05)}
.pf-wh{display:flex;align-items:center;gap:10px;margin-bottom:12px}.pf-wh span:last-child{display:flex;flex-direction:column}
.pf-wh b{font-size:11px;font-weight:700}.pf-wh em{font-style:normal;font-size:9px;color:var(--pf-mut);margin-top:3px}
.pf-stats3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.pf-stats3 span{display:flex;flex-direction:column;align-items:center;background:#f8fafc;border:1px solid #f3f4f6;border-radius:6px;padding:6px 0}
.pf-stats3 em{font-style:normal;font-size:8px;color:var(--pf-mut)}.pf-stats3 b{font-size:12px;font-weight:700}
.pf-lab{font-size:10px!important;font-weight:700;letter-spacing:.08em;margin-bottom:8px!important}.pf-lab.muted{font-size:9px!important;color:var(--pf-mut);margin-bottom:12px!important}
.pf-task{display:flex;align-items:center;gap:8px;animation:pf-slide 6s cubic-bezier(.22,1,.36,1) infinite}
.pf-task b{font-size:11px;font-weight:700;color:#4b5563;flex:1}
.pf-task.tall{align-items:flex-start}.pf-task .pf-ok.sm{margin-top:2px}
.pf-col{display:flex;flex-direction:column;flex:1;gap:3px}.pf-col b{line-height:1.25;color:var(--pf-ink)}.pf-col em{font-style:normal;font-size:9px;color:var(--pf-mut)}
.pf-day{font-size:9px;font-weight:700;color:var(--pf-mut);background:#f9fafb;padding:3px 5px;border-radius:5px;text-align:center;line-height:1.3}
.pf-tip{position:absolute;right:-14px;top:74px;z-index:30;display:flex;align-items:center;gap:12px;padding:10px 12px;background:#fff;border:1px solid rgba(255,255,255,.6);border-radius:16px;box-shadow:0 15px 35px rgba(0,0,0,.12);opacity:0;transform-origin:left center;animation:pf-tip 6s cubic-bezier(.34,1.56,.64,1) infinite}
.pf-tip span:last-child{display:flex;flex-direction:column}.pf-tip em{font-style:normal;font-size:9px;font-weight:500;color:var(--pf-mut)}.pf-tip b{font-size:13px;font-weight:700;letter-spacing:-.01em;white-space:nowrap}
.pf-clock{width:28px;height:28px;border-radius:50%;background:#000;color:#fff;display:grid;place-items:center}
.pf-avs{position:absolute;right:-22px;top:70px;z-index:30;padding:6px;background:#fff;border:1px solid #fff;border-radius:999px;box-shadow:0 15px 35px rgba(0,0,0,.12)}
.pf-avs>div{display:flex}.pf-av{width:28px;height:28px;border-radius:50%;border:2px solid #fff;color:#fff;font-size:9px;font-weight:700;display:grid;place-items:center;margin-left:-8px;animation-duration:5s;animation-timing-function:cubic-bezier(.34,1.56,.64,1);animation-iteration-count:infinite}
.pf-av:first-child{margin-left:0}.pf-av.a1{animation-name:pf-av1}.pf-av.a2{animation-name:pf-av2}.pf-av.a3{animation-name:pf-av3}
.pf-av.a4{background:#eff6ff;color:#2563eb;z-index:1;animation-name:pf-av4}
/* card 4 */
.pf-ripple{position:absolute;top:100px;width:260px;height:100px;border-radius:20px;background:rgba(220,252,231,.8);filter:blur(24px);opacity:0;animation:pf-rip 6s cubic-bezier(.22,1,.36,1) infinite}
.pf-wid{position:relative;z-index:10;width:290px;margin-top:40px;background:#fff;border:1px solid rgba(255,255,255,.8);border-radius:20px;padding:24px;color:var(--pf-ink);animation:pf-click 6s cubic-bezier(.22,1,.36,1) infinite}
.pf-wh.big{margin-bottom:24px}.pf-wh.big em{font-size:10px;font-weight:700;letter-spacing:.12em;line-height:1;margin:0 0 4px}.pf-wh.big b{font-size:15px;line-height:1}
.pf-bolt{width:32px;height:32px;border-radius:50%;background:#dcfce7;color:#22c55e;display:grid;place-items:center}
.pf-stats3.roomy{gap:12px}.pf-stats3.roomy span{background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.05);border-radius:12px;padding:12px 0}
.pf-stats3.roomy em{font-size:10px;margin-bottom:4px}.pf-stats3.roomy b{font-size:16px}.pf-stats3.roomy small{font-size:11px;font-weight:500;color:var(--pf-mut)}
.pf-pop{display:inline-block;animation:pf-stat 6s cubic-bezier(.34,1.56,.64,1) infinite}
.pf-cursor{position:absolute;right:40px;bottom:24px;z-index:50;filter:drop-shadow(0 2px 3px rgba(0,0,0,.25));opacity:0;animation:pf-cur 6s cubic-bezier(.22,1,.36,1) infinite}
/* loops run only while the card is on screen */
.pf-card:not(.in) *{animation-play-state:paused!important}
@keyframes pf-main{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes pf-top{0%,20%{transform:scale(.95) translateY(10px) rotate(0)}40%,80%{transform:scale(.95) translateY(-35px) rotate(-6deg)}100%{transform:scale(.95) translateY(10px) rotate(0)}}
@keyframes pf-bot{0%,20%{transform:scale(.95) translateY(-10px) rotate(0)}40%,80%{transform:scale(.95) translateY(35px) rotate(6deg)}100%{transform:scale(.95) translateY(-10px) rotate(0)}}
@keyframes pf-tip{0%,20%{transform:scale(.8) translateX(-10px);opacity:0}30%,85%{transform:none;opacity:1}95%,100%{transform:scale(.8) translateX(-10px);opacity:0}}
@keyframes pf-slide{0%,15%{transform:translateX(10px);opacity:0}25%,85%{transform:none;opacity:1}95%,100%{transform:translateX(10px);opacity:0}}
@keyframes pf-av1{0%,20%,100%{transform:none}40%,80%{transform:translateX(-18px)}}
@keyframes pf-av2{0%,20%,100%{transform:none}40%,80%{transform:translateX(-6px)}}
@keyframes pf-av3{0%,20%,100%{transform:none}40%,80%{transform:translateX(6px)}}
@keyframes pf-av4{0%,20%,100%{transform:none}40%,80%{transform:translateX(18px)}}
@keyframes pf-cur{0%,20%{transform:translate(60px,80px) scale(.8);opacity:0}30%,40%{transform:translate(10px,10px);opacity:1}43%,48%{transform:scale(.9);opacity:1}52%,80%{transform:translate(10px,10px);opacity:1}90%,100%{transform:translate(60px,80px) scale(.8);opacity:0}}
@keyframes pf-click{0%,40%{transform:none;box-shadow:0 20px 40px -10px rgba(0,0,0,.08)}43%,48%{transform:scale(.96);box-shadow:0 10px 20px -5px rgba(0,0,0,.1)}52%,100%{transform:none;box-shadow:0 20px 40px -10px rgba(0,0,0,.08)}}
@keyframes pf-rip{0%,43%{transform:scale(.9);opacity:0}48%{transform:scale(1.1);opacity:1}60%,100%{transform:scale(1.3);opacity:0}}
@keyframes pf-stat{0%,45%{transform:scale(1);color:inherit}48%,60%{transform:scale(1.15);color:#10b981}65%,100%{transform:scale(1)}}
@media (prefers-reduced-motion:reduce){.pf *{animation:none!important}.pf-rv{opacity:1;transform:none;transition:none}.pf-tip{opacity:1}.pf-cursor{display:none}}
`;
