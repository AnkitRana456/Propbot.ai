import React, { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useApprovalHistory,
  useApproveActionMutation,
  usePendingApprovals,
  useRejectActionMutation,
  type PendingApprovalItem,
} from '../../services/approvals.service.js';
import { useToast } from '../ui/Toast.js';
import { formatInr } from '../../lib/format.js';

/**
 * The AI approval queue, in the "ToolApproval" design (from Cue): one held action at a time, in full — which agent,
 * what it wants to do, how risky, why, and exactly what will happen (the WhatsApp reply as it will be sent, the
 * payment link with its amount, the discount and the final price, the status change, the visit). Approve runs it
 * (POST /api/approvals/:id/approve), Edit changes the message or the offer first and approves the edited call,
 * Reject tells the agent why. The rest wait below; the server's history sits at the bottom.
 * Keys while the pointer is over it: Enter approves, E edits, R rejects, Escape steps back.
 * Colours come from the app's theme tokens, so light and dark follow the app.
 */

type Risk = 'low' | 'medium' | 'high';
type View = {
  agent: string; color: string; tool: string; source: string; title: string; risk: Risk; why: string;
  kind: 'message' | 'payment' | 'offer' | 'status' | 'visit' | 'call';
  edit?: 'message' | 'offer';
};

const n = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : null);
const s = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const human = (t: string) => t.replace(/[_-]+/g, ' ').replace(/^\w/, c => c.toUpperCase());
const WORDS: Record<string, string> = { ai: 'AI', whatsapp: 'WhatsApp', crm: 'CRM', mcp: 'MCP' };
const agentLabel = (a: string) => (a.startsWith('mcp:') ? `${a.slice(4)} (via MCP)`
  : a.includes('_') ? a.split('_').map((w, i) => WORDS[w.toLowerCase()] ?? (i ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ') : a);
const COLORS = ['#ec8a3c', '#4f7fe0', '#9a6cf0', '#3ccf7d', '#e0567a', '#2bb3b1'];
const colorOf = (a: string) => { let h = 0; for (const c of a) h = (h * 31 + c.charCodeAt(0)) | 0; return COLORS[Math.abs(h) % COLORS.length]!; };

/** what a held action looks like on the card, from its type and arguments */
function viewOf(it: PendingApprovalItem): View {
  const a = it.args ?? {}, who = it.leadName?.trim() || 'the buyer';
  const base = { agent: agentLabel(it.agentName), color: colorOf(it.agentName) };
  switch (it.actionType) {
    case 'send_whatsapp_broadcast':
      return { ...base, tool: 'Send a WhatsApp broadcast', source: 'WhatsApp', title: 'Send a WhatsApp broadcast', risk: 'high', kind: 'message', edit: 'message',
        why: 'One message to many buyers at once. Broadcasts always wait for a person.' };
    case 'assign_agent':
      return { ...base, tool: 'Assign an agent', source: 'CRM', title: `Assign an agent to ${who}`, risk: 'low', kind: 'call', why: s(a.reason) || 'The AI picked the agent best placed to follow up.' };
    case 'create_task':
      return { ...base, tool: 'Create a task', source: 'CRM', title: `${s(a.title) || 'Follow-up task'} for ${who}`, risk: 'low', kind: 'call', why: s(a.description) || 'The AI wants a person to follow up.' };
    case 'offer_special_discount':
    case 'approve_token_discount':
      return { ...base, tool: 'Give a discount', source: 'Deal desk', title: `Discount ${a.unitNumber ? `on ${s(a.unitNumber)} ` : ''}for ${who}`, risk: 'high', kind: 'offer',
        why: s(a.justification ?? a.reason) || 'The agent thinks a small discount closes this deal.' };
    case 'send_whatsapp':
    case 'send_whatsapp_message':
      return { ...base, tool: 'Send WhatsApp reply', source: 'WhatsApp', title: `Reply to ${who} on WhatsApp`, risk: 'medium', kind: 'message', edit: 'message',
        why: 'The AI drafted this answer to the buyer’s last message. Your WhatsApp settings ask for a human check before it goes out.' };
    case 'send_payment_link': {
      const amt = n(a.amount);
      return { ...base, tool: 'Send payment link', source: human(s(a.provider) || 'Razorpay'), title: `Send a ${amt != null ? formatInr(amt) : ''} token link to ${who}`.replace('  ', ' '), risk: 'high', kind: 'payment',
        why: 'The buyer is ready to block the unit. Money requests always wait for a person.' };
    }
    case 'send_price_quote':
      return { ...base, tool: 'Send a price quote', source: 'Deal desk', title: `Special payment plan for ${who}`, risk: 'high', kind: 'offer', edit: 'offer',
        why: s(a.explanation) || 'The buyer asked about payment flexibility. A tailored plan needs a manager’s yes.' };
    case 'update_lead_status':
      return { ...base, tool: 'Change lead status', source: 'CRM', title: `Move ${who} to ${human(s(a.status))}`, risk: 'medium', kind: 'status',
        why: s(a.reason) || 'An outside agent wants to update the pipeline.' };
    case 'schedule_appointment':
      return { ...base, tool: 'Book a site visit', source: 'Calendar', title: `Book a site visit for ${who}`, risk: 'low', kind: 'visit',
        why: s(a.notes) || 'An outside agent wants to put a visit on the calendar.' };
    default:
      return { ...base, tool: human(it.actionType), source: 'PropBot', title: `${human(it.actionType)}${who !== 'the buyer' ? ` for ${who}` : ''}`, risk: it.tier === 'T3' ? 'high' : 'medium', kind: 'call',
        why: s(a.justification ?? a.reason) || 'This action is held for a human check.' };
  }
}

const RISK: Record<Risk, string> = { low: 'Low risk', medium: 'Medium risk', high: 'High risk' };
const dur = (sec: number) => (sec < 60 ? `${Math.floor(sec)}s` : sec < 3600 ? `${Math.floor(sec / 60)}m` : sec < 86400 ? `${Math.floor(sec / 3600)}h` : `${Math.floor(sec / 86400)}d`);
const ago = (iso: string, now: number) => dur(Math.max(0, (now - new Date(iso).getTime()) / 1000));
const left = (iso: string, now: number) => dur(Math.max(0, (new Date(iso).getTime() - now) / 1000));
const QUICK = ['Wrong buyer', 'Not now', 'Check with me first', 'Do it differently'];

const hexMark = (c: string) => (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.8 13.4 4.9v6.2L8 14.2 2.6 11.1V4.9Z" fill={c} fillOpacity=".22" stroke={c} strokeWidth="1.4" strokeLinejoin="round" /><circle cx="8" cy="8" r="1.9" fill={c} /></svg>
);
const I = {
  tick: <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path className="draw" d="m2.5 6.2 2.4 2.4 4.6-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  ring: <svg className="spin" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeOpacity=".25" strokeWidth="1.6" /><path d="M8 2.5A5.5 5.5 0 0 1 13.5 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>,
  done: <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true"><circle cx="17" cy="17" r="15" stroke="currentColor" strokeOpacity=".3" strokeWidth="1.5" /><path className="draw" d="m11 17.5 4 4 8-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  x: <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="m2 2 6 6M8 2 2 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>,
};

export const ToolApproval: React.FC = () => {
  const qc = useQueryClient();
  const toast = useToast();
  const pending = usePendingApprovals({ limit: 50 });
  const history = useApprovalHistory({ limit: 8 });
  const approveM = useApproveActionMutation();
  const rejectM = useRejectActionMutation();

  const [front, setFront] = useState<string | null>(null);
  const [mode, setMode] = useState<'ask' | 'edit' | 'reject' | 'running'>('ask');
  const [draft, setDraft] = useState<{ content?: string; price?: string; terms?: string }>({});
  const [reason, setReason] = useState('');
  const [raw, setRaw] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [runMs, setRunMs] = useState(1200);
  const inside = useRef(false), reasonRef = useRef<HTMLTextAreaElement>(null);

  // pending items, still proposed, with the one you picked in front
  const items = useMemo(() => {
    const list = (pending.data?.items ?? []).filter(i => i.status === 'proposed');
    const at = front ? list.findIndex(i => i.id === front) : -1;
    return at > 0 ? [list[at]!, ...list.filter((_, k) => k !== at)] : list;
  }, [pending.data, front]);
  const cur = items[0];
  const v = cur ? viewOf(cur) : null;

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  // a new action in front: back to asking, with its own draft
  useEffect(() => {
    setMode('ask'); setReason(''); setRaw(false);
    const a = cur?.args ?? {};
    setDraft({ content: s(a.content), price: n(a.offered_price) != null ? String(n(a.offered_price)) : '', terms: s(a.terms) });
  }, [cur?.id]);

  const afterDecision = () => { setFront(null); void qc.invalidateQueries({ queryKey: ['approvals-history'] }); };

  const approve = () => {
    if (!cur || !v || mode === 'running') return;
    const edited = mode === 'edit';
    const editedArgs: Record<string, unknown> | undefined = !edited ? undefined
      : v.edit === 'message' ? { content: draft.content }
      : { ...(draft.price && n(draft.price) != null ? { offered_price: n(draft.price) } : {}), ...(draft.terms ? { terms: draft.terms } : {}) };
    const ms = v.risk === 'high' ? 1500 : 1100;
    setRunMs(ms);
    setMode('running');
    const started = Date.now();
    approveM.mutate({ id: cur.id, editedArgs }, {
      // let the run line finish before the next one rises, so the step reads
      onSuccess: () => setTimeout(() => { toast.success(`${edited ? 'Approved edited' : 'Approved'}: ${v.title}`); afterDecision(); }, Math.max(0, ms - (Date.now() - started))),
      onError: err => { setMode(edited ? 'edit' : 'ask'); toast.error(err instanceof Error ? err.message : 'Could not approve this action.'); },
    });
  };
  const reject = () => {
    if (!cur || !v) return;
    if (mode !== 'reject') { setMode('reject'); setTimeout(() => reasonRef.current?.focus(), 60); return; }
    rejectM.mutate({ id: cur.id, reason: reason.trim() || 'Rejected by a manager' }, {
      onSuccess: () => { toast.success(`Rejected: ${v.title}`); afterDecision(); },
      onError: err => toast.error(err instanceof Error ? err.message : 'Could not reject this action.'),
    });
  };

  // keys while the pointer is over the panel: Enter approves, E edits, R rejects, Escape steps back
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!inside.current || !cur || !v) return;
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !/^(checkbox|radio|button|submit)$/.test((el as HTMLInputElement).type)));
      if (e.key === 'Escape' && mode !== 'running') { e.preventDefault(); setMode('ask'); el?.blur?.(); return; }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || !typing)) { e.preventDefault(); if (mode === 'reject') reject(); else approve(); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === 'e' && v.edit && mode === 'ask') { e.preventDefault(); setMode('edit'); }
      if (e.key.toLowerCase() === 'r' && mode !== 'running') { e.preventDefault(); reject(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const editing = mode === 'edit';
  const preview = (it: PendingApprovalItem, view: View): ReactNode => {
    const a = it.args ?? {};
    if (view.kind === 'message') return (
      <>
        <div className="fields"><span>To</span><div>{it.leadName?.trim() ? `${it.leadName.trim()} · ` : ''}{s(a.toPhone) || it.leadPhone}</div></div>
        {editing
          ? <textarea className="ed box" value={draft.content ?? ''} onChange={e => setDraft(d => ({ ...d, content: e.target.value }))} aria-label="Message" autoFocus />
          : <div className="body">{draft.content || s(a.content)}</div>}
      </>
    );
    if (view.kind === 'payment') return (
      <div className="money">
        <b>{n(a.amount) != null ? formatInr(n(a.amount)) : s(a.amount)}</b>
        <p><span>To </span>{it.leadName?.trim() || 'Buyer'}{it.leadPhone ? ` · ${it.leadPhone}` : ''}</p>
        <p><span>For </span>{a.unit_id ? `Unit ${s(a.unit_id).slice(0, 8)}` : 'Booking token'} · {s(a.currency) || 'INR'} via {human(s(a.provider) || 'razorpay')}</p>
      </div>
    );
    if (view.kind === 'offer') {
      const std = n(a.standardPrice), off = n(a.discountOffered), price = n(a.offered_price);
      if (std != null && off != null) return (
        <div className="money">
          <b>{formatInr(std - off)}</b>
          <p><span>List price </span>{formatInr(std)} <span>· discount </span>{formatInr(off)}</p>
          {a.unitNumber != null && <p><span>Unit </span>{s(a.unitNumber)}</p>}
        </div>
      );
      return editing ? (
        <div className="fields">
          <span>Price</span><div><input className="ed" inputMode="numeric" value={draft.price ?? ''} onChange={e => setDraft(d => ({ ...d, price: e.target.value }))} aria-label="Offered price" autoFocus /></div>
          <span>Terms</span><div><input className="ed" value={draft.terms ?? ''} onChange={e => setDraft(d => ({ ...d, terms: e.target.value }))} aria-label="Terms" /></div>
        </div>
      ) : (
        <div className="money">
          <b>{price != null ? formatInr(price) : '—'}</b>
          <p><span>Terms </span>{draft.terms || s(a.terms) || '—'}</p>
        </div>
      );
    }
    if (view.kind === 'status') return (
      <div className="diff mono">
        <div className="del"><i>−</i>status: current stage</div>
        <div className="add"><i>+</i>status: {s(a.status)}</div>
      </div>
    );
    if (view.kind === 'visit') return (
      <div className="fields">
        <span>When</span><div>{a.scheduledAt ? new Date(s(a.scheduledAt)).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—'}</div>
        <span>Buyer</span><div>{it.leadName?.trim() || '—'}{it.leadPhone ? ` · ${it.leadPhone}` : ''}</div>
        {a.notes != null && <><span>Notes</span><div>{s(a.notes)}</div></>}
      </div>
    );
    return <pre className="args mono" style={{ borderTop: 0 }}>{JSON.stringify(a, null, 2)}</pre>;
  };
  const label = (view: View) => ({ message: 'Message', payment: 'Payment', offer: 'Offer', status: 'Lead status', visit: 'Site visit', call: 'Call' })[view.kind];

  const done = (history.data?.items ?? []).filter(i => i.status !== 'proposed').slice(0, 6);

  return (
    <div className="ta" onPointerEnter={() => { inside.current = true; }} onPointerLeave={() => { inside.current = false; }}>
      <style>{CSS}</style>
      <div className="in">
        <div className="head">
          <h3>Approvals</h3>
          <span className="n"><i className={items.length ? '' : 'calm'} />{pending.isLoading ? 'Loading…' : items.length ? `${items.length} waiting` : 'All clear'}</span>
          <span className="keys"><b>Enter</b> approve · <b>E</b> edit · <b>R</b> reject</span>
        </div>

        {cur && v ? (
          <div className={`card ${editing ? 'editing' : ''}`} key={cur.id}>
            <div className="who">
              {hexMark(v.color)}
              <span><b>{v.agent}</b> wants to <b>{v.tool.toLowerCase()}</b></span>
              <span className={`risk ${v.risk}`}><i />{RISK[v.risk]}</span>
            </div>
            <h4>{v.title}</h4>
            <div className="tool">{v.source} · waiting {ago(cur.createdAt, now)}{cur.expiresAt ? ` · expires in ${left(cur.expiresAt, now)}` : ''}</div>
            <p className="why"><span>Why · </span>{v.why}</p>

            <div className="pv">
              <div className="bar">
                <span>{label(v)}{editing && <> · <b>editing</b>, ⌘⏎ approves</>}</span>
                <button type="button" className="raw" onClick={() => setRaw(x => !x)}>{raw ? 'Hide call' : 'Show call'}</button>
              </div>
              {preview(cur, v)}
              {raw && <pre className="args mono">{`${cur.actionType}(${JSON.stringify(cur.args ?? {}, null, 2)})`}</pre>}
            </div>

            {mode === 'reject' && (
              <div className="rej">
                <textarea ref={reasonRef} value={reason} onChange={e => setReason(e.target.value)} placeholder={`Tell ${v.agent} why, so it can try another way (optional)`} aria-label="Reason" />
                <div className="quick">{QUICK.map(q => <button type="button" key={q} onClick={() => setReason(r => (r ? `${r} ${q}.` : `${q}.`))}>{q}</button>)}</div>
              </div>
            )}

            {mode === 'running' ? (
              <div className="run" style={{ ['--ms' as string]: `${runMs}ms` }}>
                {I.ring}<span>Running {v.tool.toLowerCase()}…</span>
                <span className="track"><i /></span>
              </div>
            ) : (
              <div className="act">
                <span className="lead">{cur.leadIntentScore != null ? `Buyer intent ${cur.leadIntentScore}%` : ''}</span>
                <div className="btns">
                  {mode === 'reject' ? (
                    <>
                      <button type="button" className="b" onClick={() => setMode('ask')}>Back</button>
                      <button type="button" className="b go" disabled={rejectM.isPending} onClick={reject}>Reject {reason.trim() ? 'with reason' : ''}<kbd>⏎</kbd></button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="b no" onClick={reject}>Reject</button>
                      {v.edit && <button type="button" className="b" onClick={() => setMode(editing ? 'ask' : 'edit')}>{editing ? 'Cancel edit' : 'Edit'}</button>}
                      <button type="button" className="b go" onClick={approve}>{editing ? 'Approve edited' : 'Approve'}<kbd>⏎</kbd></button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : !pending.isLoading && (
          <div className="empty">
            {I.done}
            <b>Nothing waiting</b>
            The AI carries on. Anything it needs a yes for shows up here.
          </div>
        )}

        {items.length > 1 && (
          <>
            <div className="sec">Up next · {items.length - 1}</div>
            <div className="list">
              {items.slice(1).map(it => {
                const iv = viewOf(it);
                return (
                  <button type="button" key={it.id} className="item" onClick={() => setFront(it.id)} title="Look at this one first">
                    <span className="d" style={{ background: iv.risk === 'high' ? 'var(--bad)' : iv.risk === 'medium' ? 'var(--med)' : 'var(--ok)' }} />
                    <span className="t">{iv.title}<em>{iv.agent} · {iv.source}</em></span>
                    <span className="w">{ago(it.createdAt, now)}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {done.length > 0 && (
          <>
            <div className="sec">Decided</div>
            <div className="list">
              {done.map(it => {
                const iv = viewOf(it), ok = it.status === 'approved' || it.status === 'executed';
                const why = s((it.result as Record<string, unknown> | null)?.reason ?? (it.result as Record<string, unknown> | null)?.rejectionReason);
                return (
                  <div key={it.id} className="item done">
                    <span className={`st ${ok ? 'ok' : 'no'}`}>{ok ? I.tick : I.x}</span>
                    <span className="t">
                      {ok ? iv.title : `${human(it.status)} · ${iv.title}`}
                      <em>{ok ? (it.status === 'executed' ? 'ran' : 'approved') : why || iv.agent}</em>
                    </span>
                    {/* history items carry no updatedAt: when it ran, else when it was asked */}
                    <span className="w">{ago(s((it.result as Record<string, unknown> | null)?.executedAt) || it.updatedAt || it.createdAt, now)}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/* Cue's card, with its panel, well, text and button colours taken from the app's theme tokens */
const CSS = `
.ta { --bg: var(--surface); --raise: var(--surface-2); --well: color-mix(in srgb, var(--surface-2) 70%, var(--surface)); --ink: var(--text); --txt: color-mix(in srgb, var(--text) 82%, var(--text-muted)); --mute: var(--text-muted); --faint: var(--border); --line: var(--border-subtle, var(--border));
  --ok: var(--success); --bad: var(--danger); --med: var(--warning); --add: color-mix(in srgb, var(--success) 13%, transparent); --del: color-mix(in srgb, var(--danger) 12%, transparent); --btn: var(--accent); --btnink: var(--on-accent, #fff); --mono: var(--font-mono, ui-monospace, monospace);
  container-type: inline-size; position: relative; width: min(720px, 100%); background: var(--bg); border: 1px solid var(--faint); border-radius: 16px; overflow: hidden; font-size: 14px; color: var(--ink); -webkit-font-smoothing: antialiased; text-align: left; }
.ta *, .ta *::before, .ta *::after { box-sizing: border-box; }
.ta button { font: inherit; color: inherit; background: none; border: 0; padding: 0; margin: 0; cursor: pointer; }
.ta button:focus-visible, .ta textarea:focus-visible, .ta input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.ta .mono { font-family: var(--mono); font-size: 12.5px; }
.ta .head { display: flex; align-items: center; gap: 10px; padding: 14px 20px; border-bottom: 1px solid var(--line); }
.ta .head h3 { margin: 0; font-size: 14px; font-weight: 600; }
.ta .head .n { display: inline-flex; align-items: center; gap: 7px; color: var(--mute); font-size: 12.5px; }
.ta .head .n i { width: 6px; height: 6px; border-radius: 50%; background: var(--med); animation: tabeat 1.6s ease-in-out infinite; }
.ta .head .n i.calm { background: var(--faint); animation: none; }
@keyframes tabeat { 50% { opacity: .35; } }
.ta .head .keys { margin-left: auto; color: var(--mute); font-size: 12px; white-space: nowrap; }
.ta .head .keys b { font-weight: 600; color: var(--txt); }
.ta .card { padding: 18px 20px 16px; animation: taup .45s cubic-bezier(.2,.8,.2,1) both; }
@keyframes taup { from { opacity: 0; transform: translateY(10px); } }
.ta .who { display: flex; align-items: center; gap: 8px; color: var(--mute); font-size: 12.5px; }
.ta .who b { font-weight: 600; color: var(--txt); }
.ta .risk { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; white-space: nowrap; }
.ta .risk i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.ta .risk.low { color: var(--ok); } .ta .risk.medium { color: var(--med); } .ta .risk.high { color: var(--bad); }
.ta h4 { margin: 10px 0 0; font-size: 19px; font-weight: 600; letter-spacing: -.015em; line-height: 1.25; }
.ta .tool { margin-top: 4px; color: var(--mute); font-size: 12.5px; }
.ta .why { margin: 12px 0 0; color: var(--txt); font-size: 13.5px; line-height: 1.55; }
.ta .why span { color: var(--mute); }
.ta .pv { margin-top: 14px; border: 1px solid var(--line); border-radius: 11px; background: var(--well); overflow: hidden; }
.ta .pv .bar { display: flex; align-items: center; gap: 8px; height: 34px; padding: 0 12px; border-bottom: 1px solid var(--line); color: var(--mute); font-size: 12px; }
.ta .pv .bar .raw { margin-left: auto; color: var(--mute); font-size: 12px; }
.ta .pv .bar .raw:hover { color: var(--ink); }
.ta .fields { display: grid; grid-template-columns: auto 1fr; font-size: 13px; }
.ta .fields > span { padding: 9px 12px; color: var(--mute); border-bottom: 1px solid var(--line); }
.ta .fields > div { padding: 9px 12px 9px 0; color: var(--ink); border-bottom: 1px solid var(--line); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ta .body { padding: 12px; color: var(--txt); font-size: 13px; line-height: 1.6; white-space: pre-wrap; }
.ta .ed { width: 100%; border: 0; outline: 0; background: transparent; color: var(--ink); font: inherit; padding: 0; resize: none; }
.ta .ed.box { display: block; min-height: 120px; padding: 12px; line-height: 1.6; color: var(--txt); }
.ta .editing .pv { border-color: var(--accent); }
.ta .editing .pv .bar b { font-weight: 600; color: var(--ink); }
.ta .editing .ed { background: var(--raise); border-radius: 6px; }
.ta .editing input.ed { padding: 2px 6px; margin-left: -6px; width: calc(100% + 6px); }
.ta .editing .ed.box { border-radius: 0; }
.ta .money { padding: 16px 14px 14px; }
.ta .money b { display: block; font-size: 30px; font-weight: 600; letter-spacing: -.03em; font-variant-numeric: tabular-nums; }
.ta .money p { margin: 6px 0 0; color: var(--txt); font-size: 13px; }
.ta .money p span { color: var(--mute); }
.ta .diff { padding: 6px 0; overflow-x: auto; }
.ta .diff div { display: flex; gap: 10px; padding: 0 12px; line-height: 22px; white-space: pre; }
.ta .diff div i { font-style: normal; width: 10px; color: var(--mute); flex: none; }
.ta .diff div.add { background: var(--add); } .ta .diff div.add i { color: var(--ok); }
.ta .diff div.del { background: var(--del); } .ta .diff div.del i { color: var(--bad); }
.ta .args { margin: 0; padding: 12px; color: var(--txt); line-height: 1.6; white-space: pre-wrap; border-top: 1px solid var(--line); overflow-x: auto; }
.ta .act { display: flex; align-items: center; gap: 8px; margin-top: 16px; }
.ta .act .lead { color: var(--mute); font-size: 12.5px; }
.ta .btns { margin-left: auto; display: flex; gap: 6px; flex: none; }
.ta .b { height: 34px; padding: 0 14px; border-radius: 9px; font-size: 13px; font-weight: 500; color: var(--txt); transition: background-color .2s, color .2s, filter .2s; display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.ta .b:hover { background: var(--raise); color: var(--ink); }
.ta .b.go { background: var(--btn); color: var(--btnink); font-weight: 600; }
.ta .b.go:hover { filter: brightness(1.08); background: var(--btn); color: var(--btnink); }
.ta .b.no { color: var(--bad); }
.ta .b:disabled { cursor: default; opacity: .6; }
.ta .b kbd { font: 500 11px inherit; opacity: .6; }
.ta .run { display: flex; align-items: center; gap: 10px; margin-top: 16px; height: 34px; color: var(--txt); font-size: 13px; }
.ta .run .track { flex: 1; height: 2px; border-radius: 2px; background: var(--line); overflow: hidden; }
.ta .run .track i { display: block; height: 100%; background: var(--accent); transform-origin: left; animation: tafill var(--ms) linear both; }
@keyframes tafill { from { transform: scaleX(0); } }
.ta .rej { margin-top: 14px; animation: taup .3s cubic-bezier(.2,.8,.2,1) both; }
.ta .rej textarea { display: block; width: 100%; min-height: 64px; padding: 10px 12px; border: 1px solid var(--faint); border-radius: 10px; background: var(--well); color: var(--ink); font: inherit; font-size: 13px; line-height: 1.5; outline: 0; resize: none; }
.ta .rej textarea::placeholder { color: var(--mute); }
.ta .quick { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 9px; font-size: 12.5px; }
.ta .quick button { color: var(--mute); }
.ta .quick button:hover { color: var(--ink); }
.ta .quick button::before { content: '+ '; opacity: .6; }
.ta .sec { display: flex; align-items: center; gap: 8px; padding: 12px 20px 6px; color: var(--mute); font-size: 12px; border-top: 1px solid var(--line); }
.ta .item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 20px; text-align: left; font-size: 13px; transition: background-color .2s; }
.ta button.item:hover { background: var(--raise); }
.ta .item .t { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--txt); }
.ta .item .t em { font-style: normal; color: var(--mute); margin-left: 6px; }
.ta .item .w { color: var(--mute); font-size: 12px; white-space: nowrap; }
.ta .item .d { width: 6px; height: 6px; border-radius: 50%; flex: none; }
.ta .item.done .t { color: var(--mute); }
.ta .item .st { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; white-space: nowrap; }
.ta .item .st.ok { color: var(--ok); } .ta .item .st.no { color: var(--bad); }
.ta .list { padding-bottom: 8px; }
.ta .empty { padding: 44px 20px; text-align: center; color: var(--mute); font-size: 13.5px; animation: taup .4s both; }
.ta .empty b { display: block; color: var(--ink); font-weight: 600; font-size: 15px; margin: 10px 0 4px; }
.ta .empty svg { color: var(--ok); margin: 0 auto; }
.ta .spin { animation: taspin .9s linear infinite; }
@keyframes taspin { to { transform: rotate(360deg); } }
.ta .draw { stroke-dasharray: 20; stroke-dashoffset: 20; animation: tadraw .4s .05s ease-out forwards; }
@keyframes tadraw { to { stroke-dashoffset: 0; } }
@container (max-width: 520px) {
  .ta .in .head .keys, .ta .in .act .lead { display: none; }
  .ta .in .card { padding: 16px 16px 14px; }
  .ta .in h4 { font-size: 17px; }
  .ta .in .act { flex-wrap: wrap; }
  .ta .in .btns { margin-left: 0; width: 100%; }
  .ta .in .btns .b { flex: 1; justify-content: center; }
  .ta .in .b kbd { display: none; }
  .ta .in .item, .ta .in .sec, .ta .in .head { padding-left: 16px; padding-right: 16px; }
  .ta .in .item .t em { display: none; }
}
@media (prefers-reduced-motion: reduce) { .ta *, .ta *::before, .ta *::after { animation: none !important; transition: none !important; } .ta .draw { stroke-dashoffset: 0; } }
`;
