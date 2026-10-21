import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bot, PhoneCall, PhoneOff, Plus, Send, Trash2, Volume2, Pause, Play, X } from 'lucide-react';
import { VOICE_LANGUAGES, type CallCampaignItem, type VoiceAgentItem } from '@propbot/shared';
import {
  useAddDnd,
  useAddNumber,
  useAssignNumber,
  useCallTurn,
  useCampaignStatus,
  useCampaigns,
  useCreateCampaign,
  useCreateVoiceAgent,
  useDeleteNumber,
  useDeleteVoiceAgent,
  useDndList,
  useEndCall,
  useRemoveDnd,
  useStartTestCall,
  useUpdateVoiceAgent,
  useVoiceAgents,
  useVoiceAnalytics,
  useVoiceCall,
  useVoiceCalls,
  useVoiceNumbers,
} from '../services/voice.service.js';
import { useAgents } from '../services/agents.service.js';
import { useChatbots } from '../services/chatbots.service.js';
import { apiRequest } from '../services/api-client.js';
import { Badge } from '../components/ui/Badge.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { Skeleton } from '../components/common/Skeleton.js';

type Tab = 'agents' | 'numbers' | 'campaigns' | 'calls' | 'analytics';
const inputCls = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800 dark:text-white';
const btn = 'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-40 cursor-pointer';
const errMsg = (e: unknown, f: string) => (e instanceof Error ? e.message : f);
const OUTCOME_VARIANT: Record<string, 'mint' | 'gold' | 'slate' | 'blue'> = { qualified: 'mint', visit_booked: 'mint', connected: 'blue', not_interested: 'slate', dnd: 'gold', no_answer: 'slate', busy: 'slate', failed: 'gold' };

const useRun = () => {
  const [error, setError] = useState<string | null>(null);
  const run = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(errMsg(e, 'Action failed.'));
      return undefined;
    }
  };
  return { error, run };
};

// ---------------------------------------------------------------------------- test call
const TestCallPanel: React.FC<{ agent: VoiceAgentItem; onClose: () => void }> = ({ agent, onClose }) => {
  const start = useStartTestCall();
  const turn = useCallTurn();
  const end = useEndCall();
  const [callId, setCallId] = useState<string | null>(null);
  const [lines, setLines] = useState<Array<{ who: 'agent' | 'caller'; text: string }>>([]);
  const [draft, setDraft] = useState('');
  const [speak, setSpeak] = useState(false);
  const [result, setResult] = useState<{ outcome: string | null; escalated: boolean } | null>(null);
  const { error, run } = useRun();
  const bottom = useRef<HTMLDivElement>(null);

  const say = (text: string) => {
    if (speak && typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  };
  useEffect(() => bottom.current?.scrollIntoView?.({ block: 'end' }), [lines.length]);
  useEffect(() => () => void window.speechSynthesis?.cancel?.(), []);

  const begin = () =>
    run(async () => {
      const r = await start.mutateAsync(agent.id);
      setCallId(r.callId);
      setLines([{ who: 'agent', text: r.greeting }]);
      setResult(null);
      say(r.greeting);
    });
  const send = () =>
    run(async () => {
      if (!callId || !draft.trim()) return;
      const text = draft.trim();
      setDraft('');
      setLines(l => [...l, { who: 'caller', text }]);
      const r = await turn.mutateAsync({ callId, utterance: text });
      setLines(l => [...l, { who: 'agent', text: r.reply }]);
      say(r.reply);
      if (r.ended) {
        setResult({ outcome: r.outcome, escalated: r.escalated });
        setCallId(null);
      }
    });
  const hangUp = () =>
    run(async () => {
      if (!callId) return;
      const r = await end.mutateAsync(callId);
      setResult({ outcome: r.outcome, escalated: false });
      setCallId(null);
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" role="dialog" aria-modal="true" aria-label="Test call">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between p-5 pb-2">
          <div><h2 className="font-serif text-lg font-bold text-slate-900 dark:text-white">Test call with {agent.name}</h2><p className="text-[11px] text-slate-500">You play the caller by typing. Nothing is dialled and no lead is touched.</p></div>
          <button type="button" aria-label="Close" onClick={onClose} className="text-slate-400 cursor-pointer"><X className="h-4 w-4" /></button>
        </div>
        <div className="min-h-40 flex-1 space-y-2 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950/40" aria-live="polite">
          {lines.length === 0 && <p className="text-xs text-slate-400">Press “Start call” to hear the greeting.</p>}
          {lines.map((l, i) => (
            <div key={i} className={`flex ${l.who === 'caller' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs ${l.who === 'caller' ? 'bg-accent text-white' : 'bg-white text-slate-800 shadow-sm dark:bg-slate-800 dark:text-slate-100'}`}>{l.text}</div>
            </div>
          ))}
          <div ref={bottom} />
        </div>
        {result && <p className="px-5 pt-2 text-xs text-slate-600" role="status">Call ended. Outcome: <b>{result.outcome?.replace(/_/g, ' ') ?? 'n/a'}</b>{result.escalated ? ' · handed to a person' : ''}</p>}
        {error && <p className="px-5 pt-2 text-xs text-rose-600" role="alert">{error}</p>}
        <div className="flex flex-wrap items-center gap-2 p-5">
          {callId ? (
            <>
              <input aria-label="Caller says" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && void send()} placeholder="Say something as the caller…" className={`${inputCls} mt-0 min-w-0 flex-1`} />
              <button type="button" aria-label="Send" disabled={!draft.trim() || turn.isPending} onClick={() => void send()} className={`${btn} bg-slate-900 text-white dark:bg-slate-700`}><Send className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => void hangUp()} className={`${btn} bg-rose-600 text-white`}><PhoneOff className="h-3.5 w-3.5" /> Hang up</button>
            </>
          ) : (
            <button type="button" disabled={start.isPending} onClick={() => void begin()} className={`${btn} bg-emerald-600 text-white`}><PhoneCall className="h-3.5 w-3.5" /> {lines.length ? 'Start a new call' : 'Start call'}</button>
          )}
          <label className="ml-auto flex items-center gap-1 text-[11px] text-slate-500"><input type="checkbox" checked={speak} onChange={e => setSpeak(e.target.checked)} /> <Volume2 className="h-3 w-3" /> Speak replies</label>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------- agents
const AgentForm: React.FC<{ agent: VoiceAgentItem | null; onClose: () => void }> = ({ agent, onClose }) => {
  const create = useCreateVoiceAgent();
  const update = useUpdateVoiceAgent();
  const { data: brains } = useAgents();
  const { data: bots } = useChatbots();
  const { error, run } = useRun();
  const [f, setF] = useState({
    name: agent?.name ?? '',
    agentId: agent?.agentId ?? '',
    chatbotId: agent?.chatbotId ?? '',
    language: agent?.voice.language ?? 'en-IN',
    tone: agent?.voice.tone ?? 'warm',
    speed: agent?.voice.speed ?? 1,
    greeting: agent?.greeting ?? '',
    closing: agent?.closing ?? '',
    consent: agent?.recordingConsentScript ?? 'This call may be recorded for quality purposes.',
    keywords: (agent?.escalationRules.keywords ?? ['speak to a person', 'human', 'manager']).join(', '),
    onPrice: agent?.escalationRules.onPriceNegotiation ?? true,
    transfer: agent?.escalationRules.transferNumber ?? '',
    maxSeconds: agent?.maxCallSeconds ?? 600,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const base = {
      name: f.name,
      agentId: f.agentId || null,
      chatbotId: f.chatbotId || null,
      voice: { provider: 'gemini' as const, voiceId: 'default', language: f.language as (typeof VOICE_LANGUAGES)[number], accent: 'Indian English', speed: f.speed, pitch: 0, tone: f.tone as 'warm' | 'professional' | 'energetic' },
      greeting: f.greeting || null,
      closing: f.closing || null,
      recordingConsentScript: f.consent || null,
      escalationRules: { keywords: f.keywords.split(',').map(s => s.trim()).filter(Boolean), onPriceNegotiation: f.onPrice, negativeTurns: 2, transferNumber: f.transfer || null },
      maxCallSeconds: f.maxSeconds,
    };
    const ok = await run(() => (agent ? update.mutateAsync({ id: agent.id, input: base }) : create.mutateAsync(base)));
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" role="dialog" aria-modal="true" aria-label="Voice agent">
      <form onSubmit={submit} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between"><h2 className="font-serif text-lg font-bold text-slate-900 dark:text-white">{agent ? 'Edit voice agent' : 'New voice agent'}</h2><button type="button" aria-label="Close" onClick={onClose} className="text-slate-400 cursor-pointer"><X className="h-4 w-4" /></button></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div><label htmlFor="va-name" className="text-xs font-semibold">Name</label><input id="va-name" required minLength={2} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className={inputCls} /></div>
          <div><label htmlFor="va-lang" className="text-xs font-semibold">Language</label><select id="va-lang" value={f.language} onChange={e => setF({ ...f, language: e.target.value as typeof f.language })} className={inputCls}>{VOICE_LANGUAGES.map(l => <option key={l}>{l}</option>)}</select></div>
          <div><label htmlFor="va-brain" className="text-xs font-semibold">AI agent (what it knows and how it behaves)</label><select id="va-brain" value={f.agentId} onChange={e => setF({ ...f, agentId: e.target.value })} className={inputCls}><option value="">Generic real-estate advisor</option>{(brains ?? []).filter(b => b.activeVersion).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
          <div><label htmlFor="va-bot" className="text-xs font-semibold">Knowledge from chatbot</label><select id="va-bot" value={f.chatbotId} onChange={e => setF({ ...f, chatbotId: e.target.value })} className={inputCls}><option value="">None</option>{(bots?.chatbots ?? []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
          <div><label htmlFor="va-tone" className="text-xs font-semibold">Tone</label><select id="va-tone" value={f.tone} onChange={e => setF({ ...f, tone: e.target.value as typeof f.tone })} className={inputCls}><option>warm</option><option>professional</option><option>energetic</option></select></div>
          <div><label htmlFor="va-speed" className="text-xs font-semibold">Speaking speed: {f.speed.toFixed(2)}x</label><input id="va-speed" type="range" min={0.7} max={1.3} step={0.05} value={f.speed} onChange={e => setF({ ...f, speed: Number(e.target.value) })} className="mt-2 w-full" /></div>
        </div>
        <label htmlFor="va-greet" className="mt-3 block text-xs font-semibold">Greeting (must identify the AI; {'{{name}}'} and {'{{company}}'} are filled in)</label>
        <textarea id="va-greet" rows={2} value={f.greeting} onChange={e => setF({ ...f, greeting: e.target.value })} className={inputCls} placeholder="Hello {{name}}, this is Riya, an AI assistant from {{company}}. Is this a good time?" />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div><label htmlFor="va-consent" className="text-xs font-semibold">Recording notice</label><input id="va-consent" value={f.consent} onChange={e => setF({ ...f, consent: e.target.value })} className={inputCls} /></div>
          <div><label htmlFor="va-close" className="text-xs font-semibold">Closing line</label><input id="va-close" value={f.closing} onChange={e => setF({ ...f, closing: e.target.value })} className={inputCls} /></div>
          <div className="sm:col-span-2"><label htmlFor="va-kw" className="text-xs font-semibold">Hand over to a person when the caller says (comma separated)</label><input id="va-kw" value={f.keywords} onChange={e => setF({ ...f, keywords: e.target.value })} className={inputCls} /></div>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={f.onPrice} onChange={e => setF({ ...f, onPrice: e.target.checked })} /> Hand over on discount / negotiation</label>
          <div><label htmlFor="va-xfer" className="text-xs font-semibold">Transfer number (optional)</label><input id="va-xfer" value={f.transfer} onChange={e => setF({ ...f, transfer: e.target.value })} className={inputCls} placeholder="+91…" /></div>
          <div><label htmlFor="va-max" className="text-xs font-semibold">Max call length (seconds)</label><input id="va-max" type="number" min={30} max={3600} value={f.maxSeconds} onChange={e => setF({ ...f, maxSeconds: Number(e.target.value) || 600 })} className={inputCls} /></div>
        </div>
        {error && <p className="mt-3 text-xs text-rose-600" role="alert">{error}</p>}
        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} className={`${btn} text-slate-600`}>Cancel</button><button type="submit" disabled={create.isPending || update.isPending} className={`${btn} bg-gradient-to-r from-accent to-accent-hover text-white`}>Save voice agent</button></div>
      </form>
    </div>
  );
};

const AgentsTab: React.FC = () => {
  const { data, isLoading } = useVoiceAgents();
  const update = useUpdateVoiceAgent();
  const del = useDeleteVoiceAgent();
  const { error, run } = useRun();
  const [editing, setEditing] = useState<VoiceAgentItem | 'new' | null>(null);
  const [testing, setTesting] = useState<VoiceAgentItem | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><p className="text-xs text-slate-500">A voice agent is how your AI sounds and when it hands a call to a person. Every call starts with an AI disclosure.</p><button type="button" onClick={() => setEditing('new')} className={`${btn} bg-accent text-white`}><Plus className="h-4 w-4" /> New voice agent</button></div>
      {error && <p className="text-xs text-rose-600" role="alert">{error}</p>}
      {isLoading ? <Skeleton className="h-32 w-full" /> : (data ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700"><EmptyState icon={<Bot className="h-7 w-7" />} title="No voice agents yet" description="Create one, then try it with a test call." actionLabel="New voice agent" onAction={() => setEditing('new')} /></div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(data ?? []).map(a => (
            <li key={a.id} className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2"><span className="truncate font-serif text-sm font-bold text-slate-900 dark:text-white">{a.name}</span><Badge variant={a.status === 'active' ? 'mint' : 'slate'} size="sm">{a.status}</Badge></div>
              <p className="mt-1 text-[11px] text-slate-500">{a.voice.language} · {a.voice.tone} · max {Math.round(a.maxCallSeconds / 60)} min</p>
              <p className="mt-2 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">{a.greeting || 'Default greeting'}</p>
              <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <button type="button" onClick={() => setTesting(a)} className="inline-flex items-center gap-1 text-xs font-bold text-accent cursor-pointer"><PhoneCall className="h-3.5 w-3.5" /> Test call</button>
                <button type="button" onClick={() => setEditing(a)} className="text-xs text-slate-500 cursor-pointer">Edit</button>
                <button type="button" onClick={() => void run(() => update.mutateAsync({ id: a.id, input: { status: a.status === 'active' ? 'paused' : 'active' } }))} className="text-xs text-slate-500 cursor-pointer">{a.status === 'active' ? 'Pause' : 'Resume'}</button>
                <button type="button" aria-label={`Delete ${a.name}`} onClick={() => window.confirm(`Delete ${a.name}?`) && void run(() => del.mutateAsync(a.id))} className="ml-auto text-slate-400 hover:text-rose-600 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && <AgentForm agent={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {testing && <TestCallPanel agent={testing} onClose={() => setTesting(null)} />}
    </div>
  );
};

// ---------------------------------------------------------------------------- numbers
const NumbersTab: React.FC = () => {
  const { data: numbers } = useVoiceNumbers();
  const { data: agents } = useVoiceAgents();
  const { data: dnd } = useDndList();
  const add = useAddNumber();
  const assign = useAssignNumber();
  const del = useDeleteNumber();
  const addDnd = useAddDnd();
  const rmDnd = useRemoveDnd();
  const { error, run } = useRun();
  const [n, setN] = useState({ provider: 'exotel' as 'exotel' | 'plivo' | 'twilio', number: '' });
  const [dndText, setDndText] = useState('');
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">Phone numbers</h2>
        <form onSubmit={e => { e.preventDefault(); void run(async () => { await add.mutateAsync({ provider: n.provider, number: n.number.trim(), direction: 'both' }); setN({ ...n, number: '' }); }); }} className="flex gap-2">
          <select aria-label="Provider" value={n.provider} onChange={e => setN({ ...n, provider: e.target.value as typeof n.provider })} className={`${inputCls} mt-0 w-28`}><option>exotel</option><option>plivo</option><option>twilio</option></select>
          <input aria-label="Phone number" required value={n.number} onChange={e => setN({ ...n, number: e.target.value })} placeholder="+918040001000" className={`${inputCls} mt-0 flex-1`} />
          <button type="submit" className={`${btn} bg-accent text-white`}>Add</button>
        </form>
        {error && <p className="text-xs text-rose-600" role="alert">{error}</p>}
        <ul className="space-y-2">
          {(numbers ?? []).map(x => (
            <li key={x.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-900">
              <span className="font-mono font-semibold">{x.number}</span><Badge variant="slate" size="sm">{x.provider}</Badge>
              <select aria-label={`Voice agent for ${x.number}`} value={x.voiceAgentId ?? ''} onChange={e => void run(() => assign.mutateAsync({ id: x.id, voiceAgentId: e.target.value || null }))} className={`${inputCls} mt-0 ml-auto w-40`}><option value="">No agent</option>{(agents ?? []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
              <button type="button" aria-label={`Remove ${x.number}`} onClick={() => void run(() => del.mutateAsync(x.id))} className="text-slate-400 hover:text-rose-600 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
          {(numbers ?? []).length === 0 && <li className="text-xs text-slate-400">No numbers yet. Add the numbers you bought from your telephony provider.</li>}
        </ul>
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">Do-not-disturb list</h2>
        <p className="text-[11px] text-slate-500">Numbers here are never called by campaigns or callbacks, even if the lead gave consent. Callers who ask to stop are added automatically.</p>
        <textarea aria-label="Numbers to block" rows={2} value={dndText} onChange={e => setDndText(e.target.value)} placeholder="One number per line or comma separated" className={inputCls} />
        <button type="button" disabled={!dndText.trim() || addDnd.isPending} onClick={() => void run(async () => { await addDnd.mutateAsync({ phones: dndText.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean), reason: 'imported' }); setDndText(''); })} className={`${btn} bg-slate-900 text-white dark:bg-slate-700`}>Add to DND</button>
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {(dnd ?? []).map(d => <li key={d.id} className="flex items-center gap-2 text-xs"><span className="font-mono">{d.phone}</span><span className="text-slate-400">{d.reason}</span><button type="button" aria-label={`Remove ${d.phone} from DND`} onClick={() => void run(() => rmDnd.mutateAsync(d.id))} className="ml-auto text-slate-400 hover:text-rose-600 cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button></li>)}
          {(dnd ?? []).length === 0 && <li className="text-xs text-slate-400">Nobody is blocked.</li>}
        </ul>
      </section>
    </div>
  );
};

// ---------------------------------------------------------------------------- campaigns
interface SegmentLite { id: string; name: string; cachedCount: number }
const CampaignsTab: React.FC = () => {
  const { data, isLoading } = useCampaigns();
  const { data: agents } = useVoiceAgents();
  const { data: segs } = useQuery({ queryKey: ['segments'], queryFn: () => apiRequest<SegmentLite[]>('/api/growth/segments'), enabled: typeof window !== 'undefined' && Boolean(localStorage.getItem('propbot_access_token')) });
  const create = useCreateCampaign();
  const setStatus = useCampaignStatus();
  const { error, run } = useRun();
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: '', voiceAgentId: '', segmentId: '', start: 9, end: 20, concurrency: 3, attempts: 3, gap: 120 });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await run(() => create.mutateAsync({ name: f.name, voiceAgentId: f.voiceAgentId, segmentId: f.segmentId, callingWindow: { days: [1, 2, 3, 4, 5, 6], startHour: f.start, endHour: f.end, timezone: 'Asia/Kolkata' }, retryPolicy: { maxAttempts: f.attempts, gapMinutes: f.gap }, concurrency: f.concurrency }));
    if (ok) setAdding(false);
  };
  const bar = (c: CallCampaignItem) => {
    const t = Math.max(1, c.progress.total);
    return Math.round(((c.progress.done + c.progress.failed + c.progress.skipped) / t) * 100);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><p className="text-xs text-slate-500">Calls only consenting leads who are not on the DND list, inside your calling hours (IST by default), with retries for no-answers.</p><button type="button" onClick={() => setAdding(a => !a)} className={`${btn} bg-accent text-white`}><Plus className="h-4 w-4" /> New campaign</button></div>
      {adding && (
        <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2">
          <div><label htmlFor="cp-name" className="text-xs font-semibold">Name</label><input id="cp-name" required minLength={2} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className={inputCls} /></div>
          <div><label htmlFor="cp-agent" className="text-xs font-semibold">Voice agent</label><select id="cp-agent" required value={f.voiceAgentId} onChange={e => setF({ ...f, voiceAgentId: e.target.value })} className={inputCls}><option value="">Choose…</option>{(agents ?? []).filter(a => a.status === 'active').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
          <div className="sm:col-span-2"><label htmlFor="cp-seg" className="text-xs font-semibold">Audience (saved segment)</label><select id="cp-seg" required value={f.segmentId} onChange={e => setF({ ...f, segmentId: e.target.value })} className={inputCls}><option value="">Choose…</option>{(segs ?? []).map(s => <option key={s.id} value={s.id}>{s.name} ({s.cachedCount})</option>)}</select></div>
          <div><label htmlFor="cp-start" className="text-xs font-semibold">Call from (hour)</label><input id="cp-start" type="number" min={0} max={23} value={f.start} onChange={e => setF({ ...f, start: Number(e.target.value) })} className={inputCls} /></div>
          <div><label htmlFor="cp-end" className="text-xs font-semibold">Call until (hour)</label><input id="cp-end" type="number" min={1} max={24} value={f.end} onChange={e => setF({ ...f, end: Number(e.target.value) })} className={inputCls} /></div>
          <div><label htmlFor="cp-conc" className="text-xs font-semibold">Calls at once</label><input id="cp-conc" type="number" min={1} max={20} value={f.concurrency} onChange={e => setF({ ...f, concurrency: Number(e.target.value) || 1 })} className={inputCls} /></div>
          <div><label htmlFor="cp-att" className="text-xs font-semibold">Attempts per person / gap (min)</label><div className="flex gap-2"><input id="cp-att" type="number" min={1} max={6} value={f.attempts} onChange={e => setF({ ...f, attempts: Number(e.target.value) || 1 })} className={inputCls} /><input aria-label="Gap minutes" type="number" min={5} value={f.gap} onChange={e => setF({ ...f, gap: Number(e.target.value) || 5 })} className={inputCls} /></div></div>
          <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={() => setAdding(false)} className={`${btn} text-slate-600`}>Cancel</button><button type="submit" disabled={create.isPending} className={`${btn} bg-accent text-white`}>Create campaign</button></div>
        </form>
      )}
      {error && <p className="text-xs text-rose-600" role="alert">{error}</p>}
      {isLoading ? <Skeleton className="h-24 w-full" /> : (data ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700"><EmptyState icon={<PhoneCall className="h-7 w-7" />} title="No campaigns yet" description="Pick a saved segment and let the AI call warm leads during your calling hours." /></div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {(data ?? []).map(c => (
            <li key={c.id} className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2"><span className="truncate font-serif text-sm font-bold text-slate-900 dark:text-white">{c.name}</span><Badge variant={c.status === 'running' ? 'mint' : c.status === 'completed' ? 'blue' : 'slate'} size="sm">{c.status}</Badge></div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="progressbar" aria-valuenow={bar(c)} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-accent" style={{ width: `${bar(c)}%` }} /></div>
              <p className="mt-2 text-[11px] text-slate-500">{c.progress.total} people · {c.progress.pending} waiting · {c.progress.calling} on a call · {c.progress.done} done · {c.progress.skipped} skipped (DND / no consent) · {c.progress.failed} unreachable</p>
              <p className="text-[11px] text-slate-400">{Object.entries(c.stats).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(' · ') || 'No results yet'}</p>
              <div className="mt-3 flex gap-2">
                {(c.status === 'draft' || c.status === 'paused') && <button type="button" onClick={() => void run(() => setStatus.mutateAsync({ id: c.id, status: 'running' }))} className={`${btn} bg-emerald-600 text-white`}><Play className="h-3.5 w-3.5" /> Start</button>}
                {c.status === 'running' && <button type="button" onClick={() => void run(() => setStatus.mutateAsync({ id: c.id, status: 'paused' }))} className={`${btn} bg-amber-500 text-white`}><Pause className="h-3.5 w-3.5" /> Pause</button>}
                {c.status !== 'completed' && c.status !== 'cancelled' && <button type="button" onClick={() => window.confirm('Cancel this campaign? Remaining calls are dropped.') && void run(() => setStatus.mutateAsync({ id: c.id, status: 'cancelled' }))} className={`${btn} bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200`}>Cancel</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------- calls
const CallsTab: React.FC = () => {
  const [outcome, setOutcome] = useState('');
  const { data, isLoading } = useVoiceCalls(outcome || undefined);
  const [open, setOpen] = useState<string | null>(null);
  const { data: detail } = useVoiceCall(open);
  return (
    <div className="space-y-4">
      <select aria-label="Filter by outcome" value={outcome} onChange={e => setOutcome(e.target.value)} className={`${inputCls} mt-0 w-48`}><option value="">All outcomes</option>{['qualified', 'connected', 'not_interested', 'dnd', 'no_answer', 'busy', 'failed'].map(o => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}</select>
      {isLoading ? <Skeleton className="h-32 w-full" /> : (data ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700"><EmptyState icon={<PhoneCall className="h-7 w-7" />} title="No calls yet" description="Calls from campaigns, callbacks and test calls appear here with their transcript." /></div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400 dark:border-slate-800"><tr>{['Who', 'Type', 'Outcome', 'Duration', 'When'].map(h => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
            <tbody>
              {(data ?? []).map(c => (
                <tr key={c.id} onClick={() => setOpen(c.id)} className="cursor-pointer border-b border-slate-50 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white"><button type="button" onClick={() => setOpen(c.id)} className="cursor-pointer">{c.contactName ?? c.toNumber}</button></td>
                  <td className="px-4 py-3 text-slate-500">{c.direction.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3">{c.outcome ? <Badge variant={OUTCOME_VARIANT[c.outcome] ?? 'slate'} size="sm">{c.outcome.replace(/_/g, ' ')}</Badge> : <span className="text-slate-400">{c.status}</span>}{c.escalatedToHuman && <Badge variant="gold" size="sm">handed over</Badge>}</td>
                  <td className="px-4 py-3 text-slate-500">{c.durationSeconds}s</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(c.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50" role="dialog" aria-modal="true" aria-label="Call detail">
          <div className="h-full w-full max-w-lg overflow-y-auto bg-white p-5 shadow-2xl dark:bg-slate-900">
            <div className="flex items-start justify-between"><h2 className="font-serif text-lg font-bold text-slate-900 dark:text-white">{detail?.contactName ?? detail?.toNumber ?? 'Call'}</h2><button type="button" aria-label="Close" onClick={() => setOpen(null)} className="text-slate-400 cursor-pointer"><X className="h-4 w-4" /></button></div>
            {!detail ? <Skeleton className="mt-4 h-40 w-full" /> : (
              <div className="mt-3 space-y-3 text-xs">
                {detail.summary && <p className="rounded-xl bg-slate-50 p-3 text-slate-700 dark:bg-slate-800 dark:text-slate-200"><b>Summary:</b> {detail.summary}</p>}
                {detail.recordingUrl && <audio controls src={detail.recordingUrl} className="w-full" />}
                <ol className="space-y-2">
                  {detail.events.map(e => (
                    <li key={e.id} className={e.type === 'utterance' ? `flex ${e.speaker === 'caller' ? 'justify-end' : 'justify-start'}` : ''}>
                      {e.type === 'utterance' ? (
                        <span className={`max-w-[85%] rounded-2xl px-3 py-2 ${e.speaker === 'caller' ? 'bg-accent text-white' : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'}`}>{String((e.payload as { text?: string }).text ?? '')}</span>
                      ) : e.type === 'sentiment' ? null : (
                        <span className="block text-center text-[10px] text-slate-400">{e.type === 'transfer' ? `Handed to a person (${String(e.payload.reason)})` : `${String(e.payload.type)}: ${String(e.payload.value)}`}</span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------- analytics
const AnalyticsTab: React.FC = () => {
  const { data, isLoading } = useVoiceAnalytics();
  if (isLoading || !data) return <Skeleton className="h-40 w-full" />;
  const max = Math.max(1, ...data.byDay.map(d => d.calls));
  const stat = (label: string, value: string | number) => (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900"><p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 font-serif text-2xl font-bold text-slate-900 dark:text-white">{value}</p></div>
  );
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {stat('Calls (30 days)', data.totalCalls)}
        {stat('Connected', `${data.connectedRate}%`)}
        {stat('Avg. talk time', `${data.avgDurationSeconds}s`)}
        {stat('Qualified', data.qualifiedCount)}
        {stat('Handed to a person', data.escalatedCount)}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section><h2 className="text-sm font-bold text-slate-900 dark:text-white">Outcomes</h2><ul className="mt-2 space-y-1.5">{Object.entries(data.byOutcome).map(([k, v]) => <li key={k} className="flex items-center gap-2 text-xs"><span className="w-28 shrink-0 text-slate-600 dark:text-slate-300">{k.replace(/_/g, ' ')}</span><span className="h-2 rounded-full bg-accent" style={{ width: `${(v / Math.max(1, data.totalCalls)) * 100}%`, minWidth: 4 }} /><span className="text-slate-500">{v}</span></li>)}{Object.keys(data.byOutcome).length === 0 && <li className="text-xs text-slate-400">No calls yet.</li>}</ul></section>
        <section><h2 className="text-sm font-bold text-slate-900 dark:text-white">Calls per day</h2><div className="mt-2 flex h-32 items-end gap-1">{data.byDay.map(d => <div key={d.day} title={`${d.day}: ${d.calls}`} className="flex-1 rounded-t bg-accent/80" style={{ height: `${(d.calls / max) * 100}%`, minHeight: 4 }} />)}</div></section>
      </div>
    </div>
  );
};

export const VoicePage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('agents');
  const tabs: Array<[Tab, string]> = [['agents', 'Voice agents'], ['numbers', 'Numbers & DND'], ['campaigns', 'Campaigns'], ['calls', 'Calls'], ['analytics', 'Analytics']];
  return (
    <div className="space-y-6 pb-12">
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <h1 className="font-serif text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Voice</h1>
        <p className="mt-1 text-xs text-slate-500 sm:text-sm">AI phone agents that call new leads within a minute, qualify them, and hand over to your team when it matters.</p>
      </div>
      <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-800" role="tablist">
        {tabs.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} type="button" onClick={() => setTab(id)} className={`border-b-2 px-4 py-2 text-xs font-semibold cursor-pointer ${tab === id ? 'border-accent text-accent' : 'border-transparent text-slate-500'}`}>{label}</button>)}
      </div>
      {tab === 'agents' ? <AgentsTab /> : tab === 'numbers' ? <NumbersTab /> : tab === 'campaigns' ? <CampaignsTab /> : tab === 'calls' ? <CallsTab /> : <AnalyticsTab />}
    </div>
  );
};
