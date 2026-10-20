import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bot, Hand, Inbox, Send, StickyNote, UserRound, CheckCircle2 } from 'lucide-react';
import { INBOX_PRIORITIES, INBOX_STATUSES, type InboxConversationItem } from '@propbot/shared';
import {
  useAddNote,
  useConversation,
  useHandBack,
  useInbox,
  useInboxCounts,
  useReply,
  useTakeControl,
  useTemplates,
  useUpdateConversation,
} from '../services/omnichannel.service.js';
import { Badge } from '../components/ui/Badge.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { Skeleton } from '../components/common/Skeleton.js';

const CHANNELS = ['web', 'whatsapp', 'instagram', 'messenger', 'email'];
const CHANNEL_TINT: Record<string, string> = {
  web: 'bg-slate-100 text-slate-700',
  whatsapp: 'bg-emerald-100 text-emerald-700',
  instagram: 'bg-pink-100 text-pink-700',
  messenger: 'bg-blue-100 text-blue-700',
  email: 'bg-amber-100 text-amber-700',
};
const STATUS_LABEL: Record<string, string> = { bot: 'AI handling', needs_human: 'Needs a person', open: 'Open', pending: 'Pending', resolved: 'Resolved', closed: 'Closed' };
const selectCls = 'rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-800 dark:text-white';
const errMsg = (e: unknown, f: string) => (e instanceof Error ? e.message : f);

const ago = (iso: string | null) => {
  if (!iso) return '';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.round(m / 60)}h`;
  return `${Math.round(m / 1440)}d`;
};

const ConversationRow: React.FC<{ c: InboxConversationItem; active: boolean; onSelect: () => void }> = ({ c, active, onSelect }) => (
  <li>
    <button type="button" onClick={onSelect} aria-current={active} className={`flex w-full flex-col gap-1 border-b border-slate-100 px-3 py-3 text-left cursor-pointer dark:border-slate-800 ${active ? 'bg-orange-50/70 dark:bg-orange-950/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}>
      <div className="flex items-center gap-2">
        <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">{c.contactName}</span>
        {c.awaitingReply > 0 && <span className="ml-1 rounded-full bg-[#B84A22] px-1.5 text-[10px] font-bold text-white" aria-label={`${c.awaitingReply} awaiting reply`}>{c.awaitingReply}</span>}
        <span className="ml-auto shrink-0 text-[10px] text-slate-400">{ago(c.lastMessageAt)}</span>
      </div>
      <p className="line-clamp-1 text-xs text-slate-500">{c.lastSender && c.lastSender !== 'visitor' ? 'You: ' : ''}{c.lastMessage}</p>
      <div className="flex flex-wrap items-center gap-1">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${CHANNEL_TINT[c.channel] ?? CHANNEL_TINT.web}`}>{c.channel}</span>
        <Badge variant={c.status === 'needs_human' ? 'gold' : c.status === 'bot' ? 'slate' : 'blue'} size="sm">{STATUS_LABEL[c.status] ?? c.status}</Badge>
        {c.priority === 'urgent' || c.priority === 'high' ? <Badge variant="gold" size="sm">{c.priority}</Badge> : null}
      </div>
    </button>
  </li>
);

const Thread: React.FC<{ id: string }> = ({ id }) => {
  const { data, isLoading } = useConversation(id);
  const { data: templates } = useTemplates();
  const reply = useReply();
  const take = useTakeControl();
  const back = useHandBack();
  const update = useUpdateConversation();
  const addNote = useAddNote();
  const [text, setText] = useState('');
  const [template, setTemplate] = useState('');
  const [note, setNote] = useState('');
  const [tab, setTab] = useState<'reply' | 'note'>('reply');
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView?.({ block: 'end' });
  }, [data?.messages.length, id]);

  const approved = useMemo(() => (templates ?? []).filter(t => t.channel === 'whatsapp' && t.status === 'approved'), [templates]);

  if (isLoading || !data) return <Skeleton className="m-4 h-64" />;
  const needsTemplate = data.channel === 'whatsapp' && data.serviceWindowExpired;
  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errMsg(e, 'Something went wrong.'));
    }
  };
  const send = () =>
    run(async () => {
      await reply.mutateAsync({ id, input: { content: text.trim(), ...(template ? { templateName: template } : {}) } });
      setText('');
    });
  const sendNote = () =>
    run(async () => {
      await addNote.mutateAsync({ id, input: { body: note.trim(), mentions: [] } });
      setNote('');
    });

  return (
    <div className="grid h-full min-h-0 grid-cols-1 xl:grid-cols-[1fr_16rem]">
      <section className="flex min-h-0 flex-col" aria-label="Conversation">
        <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-slate-900 dark:text-white">{data.contactName}</h2>
            <p className="text-[11px] text-slate-500">{data.channel} · {STATUS_LABEL[data.status] ?? data.status}{data.assigneeName ? ` · ${data.assigneeName}` : ''}</p>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            {data.aiPaused || data.status === 'open' ? (
              <button type="button" disabled={back.isPending} onClick={() => void run(() => back.mutateAsync(id))} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"><Bot className="h-3.5 w-3.5" /> Hand back to AI</button>
            ) : (
              <button type="button" disabled={take.isPending} onClick={() => void run(() => take.mutateAsync(id))} className="inline-flex items-center gap-1 rounded-lg bg-[#B84A22] px-2.5 py-1.5 text-xs font-semibold text-white cursor-pointer"><Hand className="h-3.5 w-3.5" /> Take control</button>
            )}
            {data.status !== 'resolved' && data.status !== 'closed' && (
              <button type="button" onClick={() => void run(() => update.mutateAsync({ id, input: { status: 'resolved' } }))} className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 cursor-pointer"><CheckCircle2 className="h-3.5 w-3.5" /> Resolve</button>
            )}
          </div>
        </header>
        {data.aiPaused === false && data.status === 'bot' && <p className="bg-slate-50 px-4 py-1.5 text-[11px] text-slate-500 dark:bg-slate-800/50">The AI is answering this conversation. Take control to reply yourself.</p>}

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-slate-50/60 p-4 dark:bg-slate-950/30" aria-live="polite">
          {data.messages.map(m => {
            const mine = m.senderType !== 'visitor';
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-xs ${mine ? (m.senderType === 'bot' ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100' : 'bg-[#B84A22] text-white') : 'bg-white text-slate-800 shadow-sm dark:bg-slate-800 dark:text-slate-100'}`}>
                  {m.content}
                  <span className="mt-1 block text-[9px] opacity-60">{m.senderType === 'bot' ? 'AI' : m.senderType === 'agent' ? 'Team' : 'Visitor'} · {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            );
          })}
          <div ref={bottom} />
        </div>

        <footer className="border-t border-slate-200 p-3 dark:border-slate-800">
          <div className="mb-2 flex gap-1" role="tablist">
            {(['reply', 'note'] as const).map(t => (
              <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => setTab(t)} className={`rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer ${tab === t ? 'bg-slate-900 text-white dark:bg-slate-700' : 'text-slate-500'}`}>{t === 'reply' ? 'Reply' : 'Internal note'}</button>
            ))}
          </div>
          {error && <p className="mb-2 text-[11px] text-rose-600" role="alert">{error}</p>}
          {tab === 'reply' ? (
            <div className="space-y-2">
              {needsTemplate && (
                <div className="rounded-lg bg-amber-50 p-2 text-[11px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                  The 24-hour WhatsApp window has closed. Choose an approved template to message this contact.
                  <select aria-label="Template" value={template} onChange={e => setTemplate(e.target.value)} className={`${selectCls} mt-1 block w-full`}>
                    <option value="">Pick a template…</option>
                    {approved.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                  </select>
                </div>
              )}
              <div className="flex gap-2">
                <textarea aria-label="Reply" rows={2} value={text} onChange={e => setText(e.target.value)} maxLength={4000} placeholder="Type your reply…" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800 dark:text-white" />
                <button type="button" aria-label="Send reply" disabled={!text.trim() || reply.isPending || (needsTemplate && !template)} onClick={() => void send()} className="self-end rounded-xl bg-[#B84A22] p-2.5 text-white disabled:opacity-40 cursor-pointer"><Send className="h-4 w-4" /></button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <textarea aria-label="Internal note" rows={2} value={note} onChange={e => setNote(e.target.value)} maxLength={2000} placeholder="Only your team sees notes…" className="min-w-0 flex-1 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs dark:border-amber-900 dark:bg-amber-950/20 dark:text-white" />
              <button type="button" aria-label="Save note" disabled={!note.trim() || addNote.isPending} onClick={() => void sendNote()} className="self-end rounded-xl bg-amber-500 p-2.5 text-white disabled:opacity-40 cursor-pointer"><StickyNote className="h-4 w-4" /></button>
            </div>
          )}
        </footer>
      </section>

      <aside className="hidden overflow-y-auto border-l border-slate-200 p-4 text-xs dark:border-slate-800 xl:block" aria-label="Contact">
        <div className="flex items-center gap-2"><UserRound className="h-4 w-4 text-slate-400" /><span className="font-semibold text-slate-900 dark:text-white">{data.contactName}</span></div>
        {data.contactPhone && <p className="mt-1 text-slate-500">{data.contactPhone}</p>}
        {data.contact.email && <p className="text-slate-500">{data.contact.email}</p>}
        {data.leadStatus && <p className="mt-2"><Badge variant="blue" size="sm">Stage: {data.leadStatus.replace(/_/g, ' ')}</Badge></p>}
        <dl className="mt-3 space-y-2">
          <div>
            <dt className="font-semibold text-slate-600 dark:text-slate-300">Priority</dt>
            <dd><select aria-label="Priority" value={data.priority} onChange={e => void run(() => update.mutateAsync({ id, input: { priority: e.target.value as (typeof INBOX_PRIORITIES)[number] } }))} className={`${selectCls} mt-1 w-full`}>{INBOX_PRIORITIES.map(p => <option key={p}>{p}</option>)}</select></dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-600 dark:text-slate-300">Status</dt>
            <dd><select aria-label="Status" value={data.status} onChange={e => void run(() => update.mutateAsync({ id, input: { status: e.target.value as (typeof INBOX_STATUSES)[number] } }))} className={`${selectCls} mt-1 w-full`}>{INBOX_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></dd>
          </div>
        </dl>
        {Object.keys(data.contact.attributes).length > 0 && (
          <div className="mt-4">
            <h3 className="font-semibold text-slate-600 dark:text-slate-300">Collected details</h3>
            <ul className="mt-1 space-y-0.5 text-slate-500">{Object.entries(data.contact.attributes).map(([k, v]) => <li key={k}><span className="font-medium">{k.replace(/_/g, ' ')}:</span> {String(v)}</li>)}</ul>
          </div>
        )}
        <div className="mt-4">
          <h3 className="font-semibold text-slate-600 dark:text-slate-300">Notes ({data.notes.length})</h3>
          <ul className="mt-1 space-y-2">{data.notes.map(n => <li key={n.id} className="rounded-lg bg-amber-50 p-2 text-slate-700 dark:bg-amber-950/20 dark:text-slate-200"><span className="block text-[10px] text-slate-400">{n.authorName ?? 'Someone'} · {new Date(n.createdAt).toLocaleString()}</span>{n.body}</li>)}</ul>
        </div>
      </aside>
    </div>
  );
};

export const InboxPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const selected = params.get('conversation');
  const [status, setStatus] = useState('');
  const [channel, setChannel] = useState('');
  const [assignee, setAssignee] = useState('');
  const [search, setSearch] = useState('');
  const { data, isLoading, error } = useInbox({ status, channel, assignee, search });
  const { data: counts } = useInboxCounts();
  const items = data?.items ?? [];

  return (
    <div className="space-y-4 pb-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Inbox</h1>
        {counts?.needs_human ? <Badge variant="gold" size="sm">{counts.needs_human} need a person</Badge> : null}
      </div>
      <div className="grid h-[calc(100vh-13rem)] min-h-[32rem] grid-cols-1 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900 md:grid-cols-[20rem_1fr]">
        <section className="flex min-h-0 flex-col border-r border-slate-200 dark:border-slate-800" aria-label="Conversations">
          <div className="space-y-2 border-b border-slate-200 p-3 dark:border-slate-800">
            <input aria-label="Search conversations" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone, e-mail" className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-800 dark:text-white" />
            <div className="flex flex-wrap gap-2">
              <select aria-label="Filter by status" value={status} onChange={e => setStatus(e.target.value)} className={selectCls}><option value="">All statuses</option>{INBOX_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
              <select aria-label="Filter by channel" value={channel} onChange={e => setChannel(e.target.value)} className={selectCls}><option value="">All channels</option>{CHANNELS.map(c => <option key={c}>{c}</option>)}</select>
              <select aria-label="Filter by owner" value={assignee} onChange={e => setAssignee(e.target.value)} className={selectCls}><option value="">Anyone</option><option value="me">Mine</option><option value="unassigned">Unassigned</option></select>
            </div>
          </div>
          {error && <p className="p-3 text-xs text-rose-600" role="alert">{error.message}</p>}
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {isLoading && <li className="p-3"><Skeleton className="h-16 w-full" /></li>}
            {items.map(c => <ConversationRow key={c.id} c={c} active={c.id === selected} onSelect={() => setParams({ conversation: c.id })} />)}
            {!isLoading && items.length === 0 && <li className="p-6 text-center text-xs text-slate-400">No conversations match.</li>}
          </ul>
        </section>
        <div className="min-h-0">
          {selected ? <Thread key={selected} id={selected} /> : <EmptyState icon={<Inbox className="h-7 w-7" />} title="Pick a conversation" description="Chats from your website, WhatsApp, Instagram, Messenger and e-mail land here." />}
        </div>
      </div>
    </div>
  );
};
