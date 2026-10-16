"use client";
/**
 * AnalyticsDashboard — a dark sales-analytics app (Cue content) (React 18/19, no other dependencies, Inter).
 *  Sidebar (workspace switcher, quick actions ⌘K, nav with sub-items, tools, pinned, chats, getting-started checklist,
 *  trial + Upgrade, collapse) and a main view: filters (range, compare, currency, channel) that really change the data,
 *  KPI cards with mini bars, "Total sales over time" with hover crosshair + tooltip and a toggleable previous period,
 *  top products, sessions over time, and an "Ask" assistant panel. Flat, no shadows; fills its container.
 * Kit-ready: the CSS lives in this file (scoped under .ad) and starts with a small kit-shield block.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode } from 'react';

export type AnalyticsDashboardProps = {
  workspace?: string;
  assistant?: string;
  /** Height of the app (it fills its container's width). Default '100vh'. */
  height?: number | string;
  loadFont?: boolean;
  className?: string;
  style?: CSSProperties;
};

type Range = 'Last 7 days' | 'Last 30 days' | 'Last 90 days';
type Cur = 'USD' | 'EUR' | 'INR';
type Channel = 'All channels' | 'Website' | 'X' | 'Product Hunt';
const RANGES: Range[] = ['Last 7 days', 'Last 30 days', 'Last 90 days'];
const CURS: Cur[] = ['USD', 'EUR', 'INR'];
const CHANNELS: Channel[] = ['All channels', 'Website', 'X', 'Product Hunt'];
const RATE: Record<Cur, number> = { USD: 1, EUR: .92, INR: 83.2 };
const SYM: Record<Cur, string> = { USD: '$', EUR: '€', INR: '₹' };
const SHARE: Record<Channel, number> = { 'All channels': 1, Website: .58, X: .29, 'Product Hunt': .13 };
const DAYS: Record<Range, number> = { 'Last 7 days': 7, 'Last 30 days': 30, 'Last 90 days': 90 };

/* deterministic data (seeded), so server and client render the same numbers */
const rng = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
function series(n: number, seed: number, base: number, amp: number) {
  const r = rng(seed); const out: number[] = []; let v = base;
  for (let i = 0; i < n * 4; i++) {                          // 4 points a day, like the reference's jagged line
    const trend = Math.sin((i / (n * 4)) * Math.PI) * amp;   // rises to the middle of the range, then eases off
    v += (r() - .5) * base * .16 + (base + trend - v) * .18;
    out.push(Math.max(base * .35, v));
  }
  return out;
}
const PRODUCTS = [
  { name: 'Lifetime Pro', sales: 7900, units: 100, color: '#d5fe4f' },
  { name: 'Motion Remake skill', sales: 2450, units: 490, color: '#3d50e8' },
  { name: 'Kit Pro yearly', sales: 4680, units: 60, color: '#f2f2f2' },
  { name: 'Prompt pack: Landing', sales: 1740, units: 87, color: '#f0714e' },
  { name: 'Custom component', sales: 990, units: 3, color: '#8fd3c1' },
];

const CSS = `/* kit-shield: undo Tailwind preflight inside the component (Kit) */
:where(.ad) { line-height: normal; color: CanvasText; tab-size: 8; font-feature-settings: normal; font-variation-settings: normal; -webkit-text-size-adjust: auto; -webkit-tap-highlight-color: initial; }
:where(.ad) :where(*), :where(.ad) :where(*)::before, :where(.ad) :where(*)::after { box-sizing: revert; margin: revert; padding: revert; border-width: revert; border-style: revert; border-color: revert; outline-color: revert; }
:where(.ad) :where(ol, ul, menu) { list-style: revert; }
:where(.ad) :where(h1, h2, h3, h4, h5, h6) { font-size: revert; font-weight: revert; }
:where(.ad) :where(a) { color: revert; text-decoration: revert; }
:where(.ad) :where(b, strong) { font-weight: revert; }
:where(.ad) :where(small, sub, sup) { font-size: revert; }
:where(.ad) :where(code, kbd, samp, pre) { font-family: revert; font-size: revert; font-feature-settings: revert; font-variation-settings: revert; }
:where(.ad) :where(img, svg, video, canvas, audio, iframe, embed, object) { display: revert; vertical-align: revert; }
:where(.ad) :where(img, video) { max-width: revert; height: revert; }
:where(.ad) :where(button, input, select, optgroup, textarea) { font: revert; letter-spacing: revert; color: revert; border-radius: revert; background-color: revert; opacity: revert; }
:where(.ad) :where(button, input[type="button"], input[type="reset"], input[type="submit"]) { appearance: revert; }
:where(.ad) :where(textarea) { resize: revert; }
:where(.ad) :where(table) { text-indent: revert; border-color: revert; border-collapse: revert; }
:where(.ad) :where(summary) { display: revert; }
:where(.ad) ::placeholder { color: revert; opacity: revert; }

.ad{position:relative;width:100%;height:100vh;height:100dvh;min-height:560px;box-sizing:border-box;display:flex;background:#141414;color:#e6e6e6;font-family:Inter,system-ui,-apple-system,sans-serif;font-size:13px;-webkit-font-smoothing:antialiased;overflow:hidden}
.ad *,.ad *::before,.ad *::after{box-sizing:border-box}
:where(.ad) button{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer}
.ad-side{width:232px;flex:none;display:flex;flex-direction:column;background:#1a1a1a;border-right:1px solid #262626;padding:10px 8px 8px;transition:width .25s cubic-bezier(.2,.8,.2,1),padding .25s;overflow:hidden}
.ad.collapsed .ad-side{width:56px}
.ad.collapsed .ad-side .lbl,.ad.collapsed .ad-side .sec,.ad.collapsed .ad-side .sub,.ad.collapsed .ad-side .kbd,.ad.collapsed .ad-side .hide-c{display:none}
.ad-ws{display:flex;align-items:center;gap:6px;height:32px;padding:0 6px;border-radius:7px;font-weight:600;font-size:15px;letter-spacing:-.02em;color:#f2f2f2}
.ad-ws .grow{flex:1}
.ad-ib{width:26px;height:26px;display:grid;place-items:center;border-radius:6px;color:#9a9a9a;flex:none}
.ad-ib:hover{background:#262626;color:#f2f2f2}
.ad-item{display:flex;align-items:center;gap:9px;width:100%;height:30px;padding:0 8px;border-radius:7px;color:#b4b4b4;text-align:left;white-space:nowrap;position:relative}
.ad-item:hover{background:#222;color:#f2f2f2}
.ad-item.on{background:#292929;color:#f5f5f5}
.ad-item svg{flex:none}
.ad-item .kbd{margin-left:auto;font-size:11.5px;color:#7a7a7a}
.ad-item.sub{padding-left:31px;height:27px}
.ad-sec{font-size:11.5px;color:#7a7a7a;padding:16px 8px 6px}
.ad-dotico{width:15px;height:15px;border-radius:50%;flex:none}
.ad-nav{flex:1;min-height:0;overflow-y:auto;scrollbar-width:none;margin-top:6px}
.ad-gs{margin-top:8px;border:1px solid #2a2a2a;border-radius:9px;padding:8px 10px;display:flex;align-items:center;gap:9px;color:#e6e6e6;width:100%;text-align:left}
.ad-gs:hover{background:#202020}
.ad-gs small{margin-left:auto;color:#8a8a8a;font-size:11.5px}
.ad-trial{display:flex;align-items:center;gap:9px;padding:10px 8px 2px;color:#e6e6e6;white-space:nowrap}
.ad-trial .up{margin-left:auto;height:26px;padding:0 10px;border-radius:7px;background:#f2f2f2;color:#111;font-weight:500;font-size:12.5px}
.ad-trial .up:hover{background:#fff}
.ad-main{flex:1;min-width:0;display:flex;flex-direction:column;position:relative}
.ad-head{display:flex;align-items:center;gap:8px;height:52px;padding:0 20px;flex:none}
.ad-head h1{margin:0;font-size:15px;font-weight:500;color:#f2f2f2;display:flex;align-items:center;gap:8px}
.ad-head .burger{display:none}
.ad-scroll{flex:1;min-height:0;overflow-y:auto;padding:4px 20px 80px;scrollbar-width:thin;scrollbar-color:#333 transparent}
.ad-filters{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}
.ad-dd{position:relative}
.ad-pill{height:30px;display:flex;align-items:center;gap:7px;padding:0 9px 0 10px;border-radius:8px;background:#1f1f1f;border:1px solid #2a2a2a;color:#e6e6e6;white-space:nowrap}
.ad-pill:hover{background:#252525}
.ad-pill.on{border-color:#3b5f8f;background:#1c2533}
.ad-pill .ud{color:#8a8a8a}
.ad-menu{position:absolute;z-index:30;top:36px;left:0;min-width:180px;background:#1f1f1f;border:1px solid #2f2f2f;border-radius:10px;padding:4px;display:flex;flex-direction:column;animation:ad-pop .15s ease-out}
.ad-menu button{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:7px;text-align:left;color:#d6d6d6;white-space:nowrap}
.ad-menu button:hover,.ad-menu button.on{background:#2a2a2a;color:#fff}
.ad-menu button .ck{margin-left:auto}
@keyframes ad-pop{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
.ad-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:12px}
@media (max-width:1180px){.ad-kpis{grid-template-columns:repeat(2,1fr)}}
.ad-card{background:#1c1c1c;border:1px solid #2a2a2a;border-radius:12px;padding:14px 14px 14px}
.ad-card h3{margin:0 0 10px;font-size:12.5px;font-weight:400;color:#a3a3a3;display:flex;align-items:center;gap:7px}
.ad-kpi{display:flex;align-items:flex-end;gap:8px}
.ad-kpi b{font-size:21px;font-weight:500;color:#f5f5f5;letter-spacing:-.01em;font-variant-numeric:tabular-nums}
.ad-kpi .chg{font-size:11.5px;padding-bottom:4px}
.up{color:#4ade80}.dn{color:#f87171}
.ad-kpi .bars{margin-left:auto;display:flex;align-items:flex-end;gap:3px;height:26px}
.ad-kpi .bars i{width:6px;border-radius:1.5px;background:#3a3a3a;transition:height .4s cubic-bezier(.2,.8,.2,1)}
.ad-big{margin-bottom:12px;padding:14px 16px 12px}
.ad-big .total{font-size:22px;font-weight:500;color:#f5f5f5;margin:-2px 0 10px;font-variant-numeric:tabular-nums}
.ad-chart{position:relative;width:100%}
.ad-chart svg{display:block;width:100%;overflow:visible}
.ad-chart text{fill:#8a8a8a;font-size:11px;font-family:Inter,system-ui,sans-serif}
.ad-tip{position:absolute;pointer-events:none;background:#232323;border:1px solid #333;border-radius:8px;padding:7px 9px;font-size:12px;color:#e6e6e6;white-space:nowrap;transform:translate(-50%,-100%);z-index:5}
.ad-tip .r{display:flex;align-items:center;gap:6px;margin-top:3px;color:#bdbdbd}
.ad-tip .r i{width:6px;height:6px;border-radius:50%}
.ad-tip b{font-weight:500;color:#fff;margin-left:auto;padding-left:12px;font-variant-numeric:tabular-nums}
.ad-legend{display:flex;justify-content:center;gap:16px;margin-top:6px}
.ad-legend button{display:flex;align-items:center;gap:6px;font-size:12px;color:#a3a3a3;padding:3px 6px;border-radius:6px}
.ad-legend button:hover{background:#242424}
.ad-legend button.off{opacity:.4}
.ad-legend i{width:6px;height:6px;border-radius:50%}
.ad-row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.ad-prod{display:flex;flex-direction:column;gap:12px}
.ad-prod .p{display:grid;grid-template-columns:1fr auto 40px;align-items:center;gap:6px 14px;font-size:12.5px;color:#d6d6d6;width:100%;text-align:left;border-radius:6px;padding:2px 0}
.ad-prod .p:hover .tr i{background:#2a8bf0}
.ad-prod .p .n{display:flex;align-items:center;gap:8px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ad-prod .p .n span{width:13px;height:13px;border-radius:3px;flex:none}
.ad-prod .p .v{color:#d6d6d6;font-variant-numeric:tabular-nums}
.ad-prod .p .u{color:#8a8a8a;text-align:right;font-variant-numeric:tabular-nums}
.ad-prod .tr{grid-column:1/-1;height:8px;border-radius:4px;background:transparent}
.ad-prod .tr i{display:block;height:100%;border-radius:4px;background:#0b74e5;transition:width .5s cubic-bezier(.2,.8,.2,1),background .15s}
.ad-ask{position:absolute;right:20px;bottom:18px;z-index:20;height:34px;display:flex;align-items:center;gap:8px;padding:0 14px 0 11px;border-radius:17px;background:#232323;border:1px solid #333;color:#f2f2f2;font-weight:500}
.ad-ask:hover{background:#2a2a2a}
.ad-ask .orb{width:14px;height:14px;border-radius:50%;background:#7c5cff;box-shadow:inset -3px -3px 0 #4b33c9}
.ad-panel{position:absolute;right:20px;bottom:62px;z-index:25;width:min(360px,calc(100% - 40px));height:min(440px,calc(100% - 90px));background:#1c1c1c;border:1px solid #2f2f2f;border-radius:14px;display:flex;flex-direction:column;animation:ad-pop .2s ease-out;overflow:hidden}
.ad-panel .ph{display:flex;align-items:center;gap:8px;padding:12px 12px 10px;border-bottom:1px solid #262626;font-weight:500}
.ad-panel .ph .grow{flex:1}
.ad-panel .msgs{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px;scrollbar-width:thin;scrollbar-color:#333 transparent}
.ad-msg{max-width:85%;padding:8px 10px;border-radius:10px;line-height:1.45;font-size:12.5px;animation:ad-pop .2s ease-out;white-space:pre-wrap}
.ad-msg.me{align-self:flex-end;background:#2a2a2a;color:#f2f2f2}
.ad-msg.ai{align-self:flex-start;background:#20232b;color:#d6dbe6}
.ad-sugg{display:flex;flex-wrap:wrap;gap:6px;padding:0 12px 8px}
.ad-sugg button{height:26px;padding:0 9px;border-radius:13px;border:1px solid #2f2f2f;color:#c9c9c9;font-size:12px}
.ad-sugg button:hover{background:#252525;color:#fff}
.ad-panel form{display:flex;gap:6px;padding:10px;border-top:1px solid #262626}
.ad-panel input{flex:1;min-width:0;height:32px;border-radius:8px;border:1px solid #2f2f2f;background:#161616;color:#f2f2f2;font:inherit;padding:0 10px;outline:none}
.ad-panel input:focus{border-color:#3b5f8f}
.ad-panel form button{height:32px;padding:0 12px;border-radius:8px;background:#f2f2f2;color:#111;font-weight:500}
.ad-panel form button:disabled{opacity:.35;cursor:default}
.ad-dots span{display:inline-block;width:5px;height:5px;margin:0 1.5px;border-radius:50%;background:#8a96b3;animation:ad-blink 1s infinite}
.ad-dots span:nth-child(2){animation-delay:.15s}.ad-dots span:nth-child(3){animation-delay:.3s}
@keyframes ad-blink{0%,80%,100%{opacity:.25}40%{opacity:1}}
.ad-gsp{position:absolute;left:8px;bottom:84px;z-index:30;width:216px;background:#1f1f1f;border:1px solid #2f2f2f;border-radius:10px;padding:10px;animation:ad-pop .15s ease-out}
.ad-gsp h4{margin:0 0 8px;font-size:12.5px;font-weight:500}
.ad-gsp label{display:flex;align-items:center;gap:8px;padding:5px 2px;font-size:12.5px;color:#d6d6d6;cursor:pointer}
.ad-gsp input{accent-color:#4ade80}
.ad-gsp label.done{color:#7a7a7a;text-decoration:line-through}
.ad-ring{width:15px;height:15px;flex:none}
.ad-toast{position:absolute;left:50%;bottom:24px;transform:translateX(-50%);z-index:40;background:#f2f2f2;color:#111;padding:8px 14px;border-radius:9px;font-weight:500;animation:ad-pop .2s ease-out;white-space:nowrap}
.ad-empty{display:grid;place-items:center;height:60%;color:#8a8a8a;text-align:center;line-height:1.6}
.ad-empty b{display:block;color:#e6e6e6;font-weight:500;font-size:15px}
.ad-live{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#4ade80}
.ad-live i{width:7px;height:7px;border-radius:50%;background:#4ade80;animation:ad-blink 1.4s infinite}
.ad-scrim{display:none}
.ad button:focus-visible,.ad input:focus-visible{outline:2px solid #3d6fd8;outline-offset:1px}
@media (max-width:860px){
  .ad-side{position:absolute;left:0;top:0;bottom:0;z-index:50;transform:translateX(-100%);transition:transform .25s cubic-bezier(.2,.8,.2,1);width:248px!important}
  .ad.drawer .ad-side{transform:none}
  .ad.drawer .ad-scrim{display:block;position:absolute;inset:0;z-index:45;background:rgba(0,0,0,.45)}
  .ad-head .burger{display:grid}
  .ad-head .collapse{display:none}
  .ad-row2{grid-template-columns:1fr}
  .ad-kpis{grid-template-columns:1fr 1fr;gap:10px}
  .ad-kpi{flex-wrap:wrap}
  .ad-kpi .bars{display:none}
  .ad-card{padding:12px}
  .ad-scroll{padding:4px 14px 80px}
  .ad-head{padding:0 14px}
}
@media (prefers-reduced-motion:reduce){.ad *{animation:none!important;transition:none!important}}
`;

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const I = {
  side: <svg width="15" height="15" viewBox="0 0 16 16" {...S}><rect x="2" y="2.5" width="12" height="11" rx="2" /><path d="M6 2.5v11" /></svg>,
  cmd: <svg width="15" height="15" viewBox="0 0 16 16" {...S}><path d="M6 6V4.5A1.5 1.5 0 1 0 4.5 6H6zm0 0h4M6 6v4m4-4V4.5A1.5 1.5 0 1 1 11.5 6H10zm0 0v4m0 0h1.5A1.5 1.5 0 1 1 10 11.5V10zm0 0H6m0 0v1.5A1.5 1.5 0 1 1 4.5 10H6z" /></svg>,
  home: <svg width="15" height="15" viewBox="0 0 16 16" {...S}><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="9" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="2.5" y="9" width="4.5" height="4.5" rx="1" /><rect x="9" y="9" width="4.5" height="4.5" rx="1" /></svg>,
  chart: <svg width="15" height="15" viewBox="0 0 16 16" {...S}><path d="M2.5 13.5h11M4.5 11V7.5M8 11V4M11.5 11V6" /></svg>,
  plan: <svg width="15" height="15" viewBox="0 0 16 16" {...S}><path d="M3 4.5h6M3 8h4M3 11.5h7M11 3l2 2-2 2M13 5H9.5" /></svg>,
  apps: <svg width="15" height="15" viewBox="0 0 16 16" {...S}><circle cx="5" cy="5" r="2.2" /><circle cx="11" cy="5" r="2.2" /><circle cx="5" cy="11" r="2.2" /><path d="M11 8.8v4.4M8.8 11h4.4" /></svg>,
  pin: <svg width="15" height="15" viewBox="0 0 16 16" {...S}><path d="M2.8 8a5.2 5.2 0 1 1 1.6 3.8L2.5 13.5l.8-2.5" /></svg>,
  mega: <svg width="15" height="15" viewBox="0 0 16 16" {...S}><path d="M2.5 6.5v3h2l5 3v-9l-5 3h-2zM12 6a2.5 2.5 0 0 1 0 4M5 9.5l.8 3.5" /></svg>,
  rocket: <svg width="15" height="15" viewBox="0 0 16 16" {...S}><path d="M9.5 2.5c2.5 0 4 1.5 4 4L9 11l-4-4 4.5-4.5zM5 7 3 7.5 2.5 9.5 5 9M9 11l-.5 2-2 .5-.5-2.5M10.2 5.8h.1" /></svg>,
  ud: <svg width="11" height="11" viewBox="0 0 12 12" {...S}><path d="M3.5 4.5 6 2l2.5 2.5M3.5 7.5 6 10l2.5-2.5" /></svg>,
  cal: <svg width="14" height="14" viewBox="0 0 16 16" {...S}><rect x="2.5" y="3.5" width="11" height="10" rx="2" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" /></svg>,
  cmp: <svg width="14" height="14" viewBox="0 0 16 16" {...S}><rect x="2.5" y="3" width="11" height="10" rx="2" /><path d="M8 3v10" /></svg>,
  coin: <svg width="14" height="14" viewBox="0 0 16 16" {...S}><circle cx="8" cy="8" r="5.5" /><path d="M9.6 6.2C9.3 5.6 8.7 5.3 8 5.3c-1 0-1.7.6-1.7 1.3 0 1.7 3.4.9 3.4 2.7 0 .8-.8 1.4-1.7 1.4-.8 0-1.4-.4-1.7-1M8 4.3v1M8 10.7v1" /></svg>,
  layers: <svg width="14" height="14" viewBox="0 0 16 16" {...S}><path d="M8 2.5 13.5 5.5 8 8.5 2.5 5.5zM2.5 8.5 8 11.5l5.5-3M2.5 11 8 14l5.5-3" /></svg>,
  globe: <svg width="13" height="13" viewBox="0 0 16 16" {...S}><circle cx="8" cy="8" r="5.5" /><path d="M2.5 8h11M8 2.5c1.6 1.7 2.3 3.6 2.3 5.5S9.6 11.8 8 13.5C6.4 11.8 5.7 9.9 5.7 8S6.4 4.2 8 2.5" /></svg>,
  close: <svg width="14" height="14" viewBox="0 0 16 16" {...S}><path d="M4 4l8 8M12 4l-8 8" /></svg>,
  burger: <svg width="16" height="16" viewBox="0 0 16 16" {...S}><path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" /></svg>,
  check: <svg width="12" height="12" viewBox="0 0 12 12" {...S}><path d="M2.5 6.2 5 8.5l4.5-5" /></svg>,
  chev: <svg width="12" height="12" viewBox="0 0 12 12" {...S}><path d="M3 4.5 6 7.5l3-3" /></svg>,
};

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) close(); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('pointerdown', off); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', off); document.removeEventListener('keydown', esc); };
  }, [open, close]);
  return ref;
}
function Select<T extends string>({ value, options, onChange, icon }: { value: T; options: readonly T[]; onChange: (v: T) => void; icon: ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useOutside(open, close);
  return (
    <div className="ad-dd" ref={ref}>
      <button className="ad-pill" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>{icon}{value}<span className="ud">{I.ud}</span></button>
      {open && <div className="ad-menu" role="menu">{options.map((o) => <button key={o} role="menuitemradio" aria-checked={o === value} className={o === value ? 'on' : ''} onClick={() => { onChange(o); setOpen(false); }}>{o}{o === value && <span className="ck">{I.check}</span>}</button>)}</div>}
    </div>
  );
}

/* line chart with hover crosshair + tooltip */
function LineChart({ a, b, showB, labels, yMax, fmt, h = 200, dates }: { a: number[]; b: number[]; showB: boolean; labels: string[]; yMax: number; fmt: (v: number) => string; h?: number; dates: (i: number) => [string, string] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  const [hi, setHi] = useState<number | null>(null);
  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth || 600)); ro.observe(el); setW(el.clientWidth || 600);
    return () => ro.disconnect();
  }, []);
  const L = 38, R = 6, T = 14, B = 26, iw = Math.max(10, w - L - R), ih = h - T - B;
  const x = (i: number, n: number) => L + (i / (n - 1)) * iw, y = (v: number) => T + ih - (v / yMax) * ih;
  const path = (d: number[]) => d.map((v, i) => `${i ? 'L' : 'M'}${x(i, d.length).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const ticks = [0, .25, .5, .75, 1].map((f) => f * yMax);
  const move = (e: RPointerEvent) => {
    const r = wrap.current!.getBoundingClientRect(); const px = e.clientX - r.left;
    setHi(Math.max(0, Math.min(a.length - 1, Math.round(((px - L) / iw) * (a.length - 1)))));
  };
  const [da, db] = hi != null ? dates(hi) : ['', ''];
  return (
    <div className="ad-chart" ref={wrap} onPointerMove={move} onPointerLeave={() => setHi(null)}>
      <svg height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Line chart">
        {ticks.map((t) => <g key={t}><line x1={L} x2={w - R} y1={y(t)} y2={y(t)} stroke="#262626" /><text x={0} y={y(t) + 4}>{fmt(t)}</text></g>)}
        {labels.map((l, i) => <text key={l + i} x={L + (i + .5) * (iw / labels.length)} y={h - 6} textAnchor="middle">{l}</text>)}
        {showB && <path d={path(b)} fill="none" stroke="#2f5f9e" strokeWidth="1.3" />}
        <path d={path(a)} fill="none" stroke="#4a8fe7" strokeWidth="1.5" strokeLinejoin="round" />
        {hi != null && <g>
          <line x1={x(hi, a.length)} x2={x(hi, a.length)} y1={T} y2={T + ih} stroke="#3a3a3a" strokeDasharray="3 3" />
          {showB && <circle cx={x(hi, b.length)} cy={y(b[hi]!)} r="3.5" fill="#2f5f9e" stroke="#1c1c1c" strokeWidth="2" />}
          <circle cx={x(hi, a.length)} cy={y(a[hi]!)} r="4" fill="#4a8fe7" stroke="#1c1c1c" strokeWidth="2" />
        </g>}
      </svg>
      {hi != null && (
        <div className="ad-tip" style={{ left: Math.min(Math.max(x(hi, a.length), 90), w - 90), top: Math.min(y(a[hi]!), showB ? y(b[hi]!) : 1e9) - 10 }}>
          <div className="r"><i style={{ background: '#4a8fe7' }} />{da}<b>{fmt(a[hi]!)}</b></div>
          {showB && <div className="r"><i style={{ background: '#2f5f9e' }} />{db}<b>{fmt(b[hi]!)}</b></div>}
        </div>
      )}
    </div>
  );
}

type Msg = { me: boolean; text: string };
export default function AnalyticsDashboard({ workspace = 'Cue.', assistant = 'Cue AI', height = '100vh', loadFont = true, className, style }: AnalyticsDashboardProps) {
  const [range, setRange] = useState<Range>('Last 30 days');
  const [cur, setCur] = useState<Cur>('USD');
  const [chan, setChan] = useState<Channel>('All channels');
  const [compare, setCompare] = useState(true);
  const [page, setPage] = useState('Analytics');
  const [collapsed, setCollapsed] = useState(false), [drawer, setDrawer] = useState(false);
  const [ws, setWs] = useState(workspace), [wsOpen, setWsOpen] = useState(false);
  const [gsOpen, setGsOpen] = useState(false);
  const [steps, setSteps] = useState([true, false, false, false, false]);
  const [ask, setAsk] = useState(false), [msgs, setMsgs] = useState<Msg[]>([]), [draft, setDraft] = useState(''), [typing, setTyping] = useState(false);
  const [toast, setToast] = useState('');
  const [live, setLive] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const wsRef = useOutside(wsOpen, useCallback(() => setWsOpen(false), []));
  const gsRef = useOutside(gsOpen, useCallback(() => setGsOpen(false), []));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    if (!loadFont || document.getElementById('ad-fonts')) return;
    const l = document.createElement('link'); l.id = 'ad-fonts'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap'; document.head.appendChild(l);
  }, [loadFont]);
  // ⌘K / Ctrl+K opens the assistant
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setAsk(true); } };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  }, []);
  // live view: visitors tick
  useEffect(() => { if (page !== 'Live view') return; const id = setInterval(() => setLive((v) => v + 1), 1600); return () => clearInterval(id); }, [page]);
  const flash = (t: string) => { setToast(t); timers.current.push(setTimeout(() => setToast(''), 1800)); };

  const d = DAYS[range], f = SHARE[chan] * RATE[cur], seed = d * 7 + CHANNELS.indexOf(chan) * 101;
  const data = useMemo(() => {
    // the line shows daily sales: scaled so the days add up to the period's total (and the previous total)
    const norm = (arr: number[], sum: number) => { const t = arr.reduce((x, y) => x + y, 0) / 4; return arr.map((v) => (v * sum) / t); };
    const tot = 18420 * (d / 30) * f;
    const a = norm(series(d, 11 + seed, 7600, 3800), tot);
    const b = norm(series(d, 97 + seed, 6900, 1400), tot / 1.47);
    const sa = series(d, 5 + seed, 5200, 2600).map((v) => v * SHARE[chan]);
    const sb = series(d, 61 + seed, 4600, 900).map((v) => v * SHARE[chan]);
    return { a, b, sa, sb };
  }, [d, f, seed, chan]);
  const scaleRange = d / 30, total = 18420 * scaleRange * f, prevTotal = total / 1.47;
  const money = (v: number, short = false) => {
    const s = SYM[cur];
    if (short) return v >= 1e6 ? `${s}${+(v / 1e6).toFixed(1)}m` : v >= 1000 ? `${s}${+(v / 1000).toFixed(1)}k` : `${s}${Math.round(v)}`;
    return s + Math.round(v).toLocaleString('en-US');
  };
  // round axis: 4 equal steps of 1 / 2 / 2.5 / 5 × 10ⁿ
  const nice = (max: number) => { const raw = max / 4, p10 = 10 ** Math.floor(Math.log10(raw)); const st = [1, 2, 2.5, 5, 10].map((m) => m * p10).find((v) => v >= raw) || raw; return st * 4; };
  const yMax = nice(Math.max(...data.a, ...(compare ? data.b : [0])));
  const sMax = nice(Math.max(...data.sa, ...(compare ? data.sb : [0])));
  const labels = d === 7 ? ['Jul 18', 'Jul 19', 'Jul 20', 'Jul 21', 'Jul 22', 'Jul 23', 'Jul 24'] : d === 30 ? ['Jul 1', 'Jul 7', 'Jul 14', 'Jul 21', 'Jul 28'] : ['May', 'Jun', 'Jul'];
  const dateAt = (i: number, n: number): [string, string] => {
    const day = Math.floor((i / n) * d); const dt = new Date(2026, 6, 24 - d + 1 + day); const pv = new Date(dt); pv.setFullYear(2025);
    const o: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    return [dt.toLocaleDateString('en-US', o), pv.toLocaleDateString('en-US', o)];
  };
  const kpiBars = (s: number) => { const r = rng(s); return Array.from({ length: 10 }, () => 6 + r() * 20); };
  const kpis = [
    { t: 'Gross Sales', v: money(total), c: 47, bars: kpiBars(seed + 1) },
    { t: 'Returning customer rate', v: `${Math.round(27 * (chan === 'X' ? 1.2 : 1))}%`, c: -23, bars: kpiBars(seed + 2) },
    { t: 'Pro sales', v: String(Math.max(1, Math.round(212 * scaleRange * SHARE[chan]))), c: 47, bars: kpiBars(seed + 3) },
    { t: 'Conversion rate', v: `${(3.4 * (chan === 'Product Hunt' ? 1.6 : 1)).toFixed(1)}%`, c: 12, bars: kpiBars(seed + 4) },
  ];
  const maxP = Math.max(...PRODUCTS.map((p) => p.sales));

  const reply = (q: string) => {
    const l = q.toLowerCase();
    if (/best|top|product|lifetime|pro/.test(l)) return `Lifetime Pro leads with ${money(7900 * scaleRange * f)} from 100 sales. The Motion Remake skill sells the most units, at a lower price.`;
    if (/why|drop|returning|spike|x /.test(l)) return 'Returning buyers fell 23%: most one-time skill buyers never came back for Pro. A 14-day follow-up with a Pro discount would help. The X spike came from the Card Sphere video post.';
    if (/forecast|next|predict/.test(l)) return `At this pace you'll land around ${money(total * 1.18)} next ${range.replace('Last ', '')}, if the mid-month peak repeats.`;
    return `Over the ${range.toLowerCase()} gross sales were ${money(total)}, up 47% on the previous period (${money(prevTotal)}). Sales peaked around the middle of the range.`;
  };
  const send = (q?: string) => {
    const text = (q ?? draft).trim(); if (!text || typing) return;
    setMsgs((m) => [...m, { me: true, text }]); setDraft(''); setTyping(true);
    timers.current.push(setTimeout(() => { setTyping(false); setMsgs((m) => [...m, { me: false, text: reply(text) }]); }, 900));
  };
  const nav = (p: string) => { setPage(p); setDrawer(false); };
  const done = steps.filter(Boolean).length;
  const NavBtn = ({ p, icon, sub }: { p: string; icon?: ReactNode; sub?: boolean }) => (
    <button className={'ad-item' + (sub ? ' sub' : '') + (page === p ? ' on' : '')} aria-current={page === p ? 'page' : undefined} onClick={() => nav(p)} title={p}>{icon}<span className="lbl">{p}</span></button>
  );

  return (
    <div className={['ad', collapsed ? 'collapsed' : '', drawer ? 'drawer' : '', className].filter(Boolean).join(' ')} style={{ ...(height !== '100vh' ? { height } : null), ...style }}>
      <style>{CSS}</style>
      <div className="ad-scrim" onClick={() => setDrawer(false)} />
      {/* ---------------- sidebar ---------------- */}
      <aside className="ad-side" aria-label="Sidebar">
        <div className="ad-dd" ref={wsRef}>
          <div className="ad-ws">
            <button className="ad-ws" style={{ padding: 0, height: 'auto', flex: 1, minWidth: 0 }} onClick={() => setWsOpen(!wsOpen)} aria-expanded={wsOpen}>
              <span className="lbl" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ws.endsWith('.') ? <>{ws.slice(0, -1)}<span style={{ color: '#3d50e8' }}>.</span></> : ws}</span><span className="lbl">{I.chev}</span>
            </button>
            <button className="ad-ib hide-c" aria-label="Collapse sidebar" onClick={() => setCollapsed(true)}>{I.side}</button>
          </div>
          {wsOpen && <div className="ad-menu">{[workspace, 'Cue Kit', 'Mockup Studio'].map((w) => <button key={w} className={w === ws ? 'on' : ''} onClick={() => { setWs(w); setWsOpen(false); flash(`Switched to ${w}`); }}>{w}{w === ws && <span className="ck">{I.check}</span>}</button>)}</div>}
        </div>
        {collapsed && <button className="ad-item" aria-label="Expand sidebar" onClick={() => setCollapsed(false)}>{I.side}</button>}
        <button className="ad-item" style={{ marginTop: 4 }} onClick={() => setAsk(true)} title="Quick actions">{I.cmd}<span className="lbl">Quick actions</span><span className="kbd">K</span></button>
        <nav className="ad-nav">
          <NavBtn p="Home" icon={I.home} />
          <NavBtn p="Analytics" icon={I.chart} />
          {!collapsed && <><NavBtn p="Reports" sub /><NavBtn p="Live view" sub /></>}
          <NavBtn p="Plan" icon={I.plan} />
          <NavBtn p="Apps" icon={I.apps} />
          <div className="ad-sec sec">Tools</div>
          {([['Components', '#d5fe4f'], ['Prompts', '#5a8cf0'], ['Kit', '#3fc28a'], ['Mockup Studio', '#a46cf0']] as const).map(([n, c]) => (
            <button key={n} className={'ad-item' + (page === n ? ' on' : '')} onClick={() => nav(n)} title={n}><span className="ad-dotico" style={{ background: c }} /><span className="lbl">{n}</span></button>
          ))}
          <div className="ad-sec sec">Pinned</div>
          <button className="ad-item" onClick={() => { setAsk(true); send('Write the launch post for Card Sphere'); }} title="Launch post">{I.pin}<span className="lbl" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Write the launch post for Card Sphere</span></button>
          <button className="ad-item" onClick={() => nav('Components')} title="October drop">{I.mega}<span className="lbl">October component drop</span></button>
          <div className="ad-sec sec">Chat</div>
          {['Plan the next 10 components', 'Draft the pricing FAQ', 'Why did X traffic spike?', 'Ideas for the Kit newsletter'].map((c) => (
            <button key={c} className="ad-item hide-c" onClick={() => { setAsk(true); send(c); }}><span className="lbl" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{c}</span></button>
          ))}
        </nav>
        <div className="ad-dd" ref={gsRef}>
          {gsOpen && (
            <div className="ad-gsp">
              <h4>Getting started</h4>
              {['Connect payments', 'Publish 10 components', 'Add a Kit preview', 'Set a monthly goal', 'Ask Cue AI a question'].map((t, i) => (
                <label key={t} className={steps[i] ? 'done' : ''}><input type="checkbox" checked={steps[i]} onChange={() => setSteps((s) => s.map((v, j) => (j === i ? !v : v)))} />{t}</label>
              ))}
            </div>
          )}
          <button className="ad-gs" onClick={() => setGsOpen(!gsOpen)} aria-expanded={gsOpen} title="Getting started">
            <svg className="ad-ring" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="#333" strokeWidth="2" /><circle cx="8" cy="8" r="6" fill="none" stroke="#4a8fe7" strokeWidth="2" strokeDasharray={`${(done / 5) * 37.7} 40`} transform="rotate(-90 8 8)" strokeLinecap="round" /></svg>
            <span className="lbl">Getting started</span><small className="lbl">{done} of 5</small>
          </button>
        </div>
        <div className="ad-trial">{I.rocket}<span className="lbl">14 days left</span><button className="up lbl" onClick={() => flash('Upgrade: Pro plan selected')}>Upgrade</button></div>
      </aside>

      {/* ---------------- main ---------------- */}
      <main className="ad-main">
        <div className="ad-head">
          <button className="ad-ib burger" aria-label="Open menu" onClick={() => setDrawer(true)}>{I.burger}</button>
          <h1>{page === 'Analytics' || page === 'Reports' || page === 'Live view' ? I.chart : I.home}{page}</h1>
          {page === 'Live view' && <span className="ad-live" style={{ marginLeft: 8 }}><i />{18 + (live % 7)} visitors now</span>}
        </div>
        <div className="ad-scroll">
          {page === 'Analytics' || page === 'Reports' || page === 'Live view' ? (
            <>
              <div className="ad-filters">
                <Select value={range} options={RANGES} onChange={setRange} icon={I.cal} />
                <button className={'ad-pill' + (compare ? ' on' : '')} aria-pressed={compare} onClick={() => setCompare(!compare)}>{I.cmp}Compare<span className="ud">{I.ud}</span></button>
                <Select value={cur} options={CURS} onChange={setCur} icon={I.coin} />
                <Select value={chan} options={CHANNELS} onChange={setChan} icon={I.layers} />
              </div>
              <div className="ad-kpis">
                {kpis.map((k) => (
                  <div className="ad-card" key={k.t}>
                    <h3>{I.globe}{k.t}</h3>
                    <div className="ad-kpi"><b>{k.v}</b><span className={'chg ' + (k.c >= 0 ? 'up' : 'dn')}>{k.c >= 0 ? '+' : ''}{k.c}%</span>
                      <span className="bars" aria-hidden>{k.bars.map((h, i) => <i key={i} style={{ height: h }} />)}</span></div>
                  </div>
                ))}
              </div>
              <div className="ad-card ad-big">
                <h3>{I.globe}Total sales over time</h3>
                <div className="total">{money(total)}</div>
                <LineChart a={data.a} b={data.b} showB={compare} labels={labels} yMax={yMax} fmt={(v) => money(v, true)} h={220} dates={(i) => dateAt(i, data.a.length)} />
                <div className="ad-legend">
                  <button><i style={{ background: '#4a8fe7' }} />{range}</button>
                  <button className={compare ? '' : 'off'} onClick={() => setCompare(!compare)}><i style={{ background: '#2f5f9e' }} />Previous period</button>
                </div>
              </div>
              <div className="ad-row2">
                <div className="ad-card">
                  <h3>{I.globe}Top products</h3>
                  <div className="ad-prod">
                    {PRODUCTS.map((p) => (
                      <button key={p.name} className="p" onClick={() => { setAsk(true); send(`How is ${p.name} doing?`); }}>
                        <span className="n"><span style={{ background: p.color }} />{p.name}</span>
                        <span className="v">{money(p.sales * scaleRange * f)}</span>
                        <span className="u">{Math.round(p.units * scaleRange * SHARE[chan])}</span>
                        <span className="tr"><i style={{ width: `${(p.sales / maxP) * 100}%` }} /></span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="ad-card">
                  <h3>{I.globe}Sessions over time</h3>
                  <div className="total" style={{ fontSize: 18 }}>{Math.round(data.sa.reduce((s, v) => s + v, 0) / 4).toLocaleString('en-US')}</div>
                  <LineChart a={data.sa} b={data.sb} showB={compare} labels={labels.length > 3 ? [labels[0]!, labels[Math.floor(labels.length / 2)]!, labels[labels.length - 1]!] : labels} yMax={sMax} fmt={(v) => (v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : String(Math.round(v)))} h={170} dates={(i) => dateAt(i, data.sa.length)} />
                </div>
              </div>
            </>
          ) : (
            <div className="ad-empty"><div><b>{page}</b>Nothing here yet. Ask {assistant} to set it up.</div></div>
          )}
        </div>
        <button className="ad-ask" onClick={() => setAsk(!ask)} aria-expanded={ask}><span className="orb" />Ask {assistant}</button>
        {ask && (
          <div className="ad-panel" role="dialog" aria-label={`Ask ${assistant}`}>
            <div className="ph"><span className="orb" style={{ width: 14, height: 14, borderRadius: '50%', background: '#7c5cff' }} /><span className="grow">Ask {assistant}</span><button className="ad-ib" aria-label="Close" onClick={() => setAsk(false)}>{I.close}</button></div>
            <div className="msgs">
              {!msgs.length && <div className="ad-msg ai">Hi! I can explain your numbers. Try one of these.</div>}
              {msgs.map((m, i) => <div key={i} className={'ad-msg ' + (m.me ? 'me' : 'ai')}>{m.text}</div>)}
              {typing && <div className="ad-msg ai ad-dots"><span /><span /><span /></div>}
            </div>
            {!msgs.length && <div className="ad-sugg">{['Summarise this period', 'Best product?', 'Why did returning drop?', 'Forecast next month'].map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}</div>}
            <form onSubmit={(e) => { e.preventDefault(); send(); }}>
              <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask about your sales…" aria-label="Message" />
              <button type="submit" disabled={!draft.trim() || typing}>Send</button>
            </form>
          </div>
        )}
        {toast && <div className="ad-toast" role="status">{toast}</div>}
      </main>
    </div>
  );
}
