import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Trash2, Plus, Search, Users, Tag as TagIcon, Smile, FlaskConical } from 'lucide-react';
import { GROUP_FIELDS, type GroupRule } from '@propbot/shared';
import {
  useCreateGroup,
  useCreateSurvey,
  useCreateTag,
  useDeleteGroup,
  useDeleteSurvey,
  useDeleteTag,
  useGroupMembers,
  useGroups,
  useKbHistory,
  usePreviewGroup,
  useRefreshGroup,
  useRunKbTest,
  useSurveyStats,
  useSurveys,
  useTags,
} from '../services/intelligence.service.js';
import { useChatbots } from '../services/chatbots.service.js';
import { Badge } from '../components/ui/Badge.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { Skeleton } from '../components/common/Skeleton.js';

type Tab = 'groups' | 'tags' | 'surveys' | 'kb';
const inputCls = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800 dark:text-white';
const btn = 'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-40 cursor-pointer';
const errMsg = (e: unknown, f: string) => (e instanceof Error ? e.message : f);

const FIELD_LABEL: Record<(typeof GROUP_FIELDS)[number], string> = {
  status: 'Pipeline stage',
  intent_label: 'Buying intent',
  intent_score: 'Intent score',
  source: 'Lead source',
  created_days_ago: 'Created within (days)',
  has_visit: 'Has a site visit',
  visit_completed: 'Visited the site',
  has_tag: 'Has tag',
  attribute: 'Collected detail',
};
const OPS_BY_FIELD: Record<(typeof GROUP_FIELDS)[number], GroupRule['op'][]> = {
  status: ['equals', 'not_equals', 'in'],
  intent_label: ['equals', 'in'],
  intent_score: ['gte', 'lte', 'between'],
  source: ['equals', 'contains'],
  created_days_ago: ['lte'],
  has_visit: ['is_true', 'is_false'],
  visit_completed: ['is_true', 'is_false'],
  has_tag: ['equals'],
  attribute: ['equals', 'contains', 'gte', 'lte', 'between', 'is_true'],
};
const OP_LABEL: Record<string, string> = { equals: 'is', not_equals: 'is not', in: 'is any of', gte: 'at least', lte: 'at most', between: 'between', contains: 'contains', is_true: 'yes', is_false: 'no' };

const useRun = () => {
  const [error, setError] = useState<string | null>(null);
  const run = async <T,>(fn: () => Promise<T>) => {
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

const needsValue = (op: string) => op !== 'is_true' && op !== 'is_false';
const parseValue = (r: { op: string; raw: string }): GroupRule['value'] => {
  if (!needsValue(r.op)) return undefined;
  if (r.op === 'in') return r.raw.split(',').map(s => s.trim()).filter(Boolean);
  if (r.op === 'between') return r.raw.split(',').map(s => Number(s.trim()));
  if (['gte', 'lte'].includes(r.op)) return Number(r.raw);
  return r.raw;
};

const GroupsTab: React.FC = () => {
  const { data, isLoading } = useGroups();
  const create = useCreateGroup();
  const refresh = useRefreshGroup();
  const del = useDeleteGroup();
  const preview = usePreviewGroup();
  const { error, run } = useRun();
  const [open, setOpen] = useState<string | null>(null);
  const { data: members } = useGroupMembers(open);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [rows, setRows] = useState<Array<{ field: GroupRule['field']; key: string; op: GroupRule['op']; raw: string }>>([{ field: 'status', key: '', op: 'equals', raw: '' }]);
  const [count, setCount] = useState<number | null>(null);

  const rules = (): GroupRule[] => rows.map(r => ({ field: r.field, ...(r.field === 'attribute' ? { key: r.key } : {}), op: r.op, ...(needsValue(r.op) ? { value: parseValue(r) } : {}) }));
  const patch = (i: number, p: Partial<(typeof rows)[number]>) => {
    setCount(null);
    setRows(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><p className="text-xs text-slate-500">Groups update themselves from rules, e.g. “3 BHK, budget 80 L to 1.2 Cr, no site visit yet”. Use them as campaign audiences.</p><button type="button" onClick={() => setAdding(a => !a)} className={`${btn} bg-accent text-white`}><Plus className="h-4 w-4" /> New group</button></div>
      {adding && (
        <form onSubmit={e => { e.preventDefault(); void run(async () => { await create.mutateAsync({ name, rules: rules(), isDynamic: true }); setAdding(false); setName(''); }); }} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div><label htmlFor="g-name" className="text-xs font-semibold">Name</label><input id="g-name" required minLength={2} value={name} onChange={e => setName(e.target.value)} className={inputCls} /></div>
          <p className="text-xs font-semibold">Everyone who matches all of these:</p>
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-12 items-center gap-2">
              <select aria-label="Field" value={r.field} onChange={e => patch(i, { field: e.target.value as GroupRule['field'], op: OPS_BY_FIELD[e.target.value as GroupRule['field']][0]! })} className={`${inputCls} col-span-3 mt-0`}>{GROUP_FIELDS.map(f => <option key={f} value={f}>{FIELD_LABEL[f]}</option>)}</select>
              {r.field === 'attribute' ? <input aria-label="Detail key" value={r.key} onChange={e => patch(i, { key: e.target.value })} placeholder="bhk, budget…" className={`${inputCls} col-span-2 mt-0 font-mono`} /> : <span className="col-span-2" />}
              <select aria-label="Condition" value={r.op} onChange={e => patch(i, { op: e.target.value as GroupRule['op'] })} className={`${inputCls} col-span-2 mt-0`}>{OPS_BY_FIELD[r.field].map(o => <option key={o} value={o}>{OP_LABEL[o]}</option>)}</select>
              {needsValue(r.op) ? <input aria-label="Value" value={r.raw} onChange={e => patch(i, { raw: e.target.value })} placeholder={r.op === 'between' ? '8000000, 12000000' : r.op === 'in' ? 'a, b' : 'value'} className={`${inputCls} col-span-4 mt-0`} /> : <span className="col-span-4" />}
              <button type="button" aria-label="Remove rule" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="col-span-1 text-slate-400 hover:text-rose-600 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setRows([...rows, { field: 'status', key: '', op: 'equals', raw: '' }])} className={`${btn} bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200`}><Plus className="h-3.5 w-3.5" /> Add rule</button>
            <button type="button" disabled={preview.isPending} onClick={() => void run(async () => setCount((await preview.mutateAsync(rules())).count))} className={`${btn} bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200`}><Search className="h-3.5 w-3.5" /> Preview</button>
            {count !== null && <span className="text-xs text-slate-600" role="status">{count} {count === 1 ? 'person matches' : 'people match'}</span>}
            <button type="submit" disabled={create.isPending} className={`${btn} ml-auto bg-accent text-white`}>Save group</button>
          </div>
        </form>
      )}
      {error && <p className="text-xs text-rose-600" role="alert">{error}</p>}
      {isLoading ? <Skeleton className="h-24 w-full" /> : (data ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700"><EmptyState icon={<Users className="h-7 w-7" />} title="No groups yet" description="Create a rule-based group to target the right buyers." /></div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {(data ?? []).map(g => (
            <li key={g.id} className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2"><span className="truncate font-serif text-sm font-bold text-slate-900 dark:text-white">{g.name}</span><Badge variant="mint" size="sm">{g.memberCount} people</Badge></div>
              <p className="mt-1 text-[11px] text-slate-500">{g.rules.length} rule(s){g.refreshedAt ? ` · updated ${new Date(g.refreshedAt).toLocaleString()}` : ''}</p>
              <div className="mt-3 flex items-center gap-3 text-xs">
                <button type="button" onClick={() => setOpen(open === g.id ? null : g.id)} className="font-bold text-accent cursor-pointer">{open === g.id ? 'Hide people' : 'Show people'}</button>
                <button type="button" disabled={refresh.isPending} onClick={() => void run(() => refresh.mutateAsync(g.id))} className="inline-flex items-center gap-1 text-slate-500 cursor-pointer"><RefreshCw className="h-3.5 w-3.5" /> Refresh</button>
                <button type="button" aria-label={`Delete ${g.name}`} onClick={() => window.confirm(`Delete ${g.name}?`) && void run(() => del.mutateAsync(g.id))} className="ml-auto text-slate-400 hover:text-rose-600 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
              </div>
              {open === g.id && (
                <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-xs">
                  {(members ?? []).map(m => <li key={m.contactId} className="flex items-center gap-2"><Link to={`/contacts/${m.contactId}`} className="font-semibold text-slate-800 hover:text-accent dark:text-slate-200">{m.name}</Link><span className="text-slate-400">{m.status?.replace(/_/g, ' ')}</span></li>)}
                  {(members ?? []).length === 0 && <li className="text-slate-400">Nobody matches right now.</li>}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const TagsTab: React.FC = () => {
  const { data, isLoading } = useTags();
  const create = useCreateTag();
  const del = useDeleteTag();
  const { error, run } = useRun();
  const [f, setF] = useState({ name: '', color: '#0F766E', entityType: 'lead' as 'lead' | 'contact' | 'conversation', aiLabel: '' });
  return (
    <div className="space-y-4">
      <form onSubmit={e => { e.preventDefault(); void run(async () => { await create.mutateAsync({ name: f.name, color: f.color, entityType: f.entityType, autoRule: f.aiLabel ? { aiLabel: f.aiLabel } : null }); setF({ ...f, name: '', aiLabel: '' }); }); }} className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-12">
        <input aria-label="Tag name" required value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Tag name" className={`${inputCls} mt-0 sm:col-span-3`} />
        <input aria-label="Colour" type="color" value={f.color} onChange={e => setF({ ...f, color: e.target.value })} className="h-9 rounded-xl border border-slate-200 sm:col-span-1" />
        <select aria-label="Applies to" value={f.entityType} onChange={e => setF({ ...f, entityType: e.target.value as typeof f.entityType })} className={`${inputCls} mt-0 sm:col-span-2`}><option value="lead">Leads</option><option value="contact">Contacts</option><option value="conversation">Conversations</option></select>
        <select aria-label="Apply automatically when the AI sees" value={f.aiLabel} onChange={e => setF({ ...f, aiLabel: e.target.value })} className={`${inputCls} mt-0 sm:col-span-4`}><option value="">Manual only</option>{['price_enquiry', 'site_visit', 'loan', 'resale', 'rental', 'complaint', 'broker'].map(l => <option key={l} value={l}>Auto-tag: {l.replace(/_/g, ' ')}</option>)}</select>
        <button type="submit" className={`${btn} bg-accent text-white sm:col-span-2`}>Add tag</button>
      </form>
      {error && <p className="text-xs text-rose-600" role="alert">{error}</p>}
      {isLoading ? <Skeleton className="h-16 w-full" /> : (data ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700"><EmptyState icon={<TagIcon className="h-7 w-7" />} title="No tags yet" description="Tags group leads and conversations. They can be applied automatically from AI labels." /></div>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {(data ?? []).map(t => (
            <li key={t.id} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-3 pr-2 text-xs dark:border-slate-800 dark:bg-slate-900">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
              <span className="font-semibold text-slate-800 dark:text-slate-100">{t.name}</span>
              <span className="text-slate-400">{t.entityType} · {t.usageCount}{t.autoRule ? ` · auto: ${t.autoRule.aiLabel.replace(/_/g, ' ')}` : ''}</span>
              <button type="button" aria-label={`Delete tag ${t.name}`} onClick={() => window.confirm(`Delete tag ${t.name}?`) && void run(() => del.mutateAsync(t.id))} className="text-slate-400 hover:text-rose-600 cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const SurveyStatsView: React.FC<{ id: string }> = ({ id }) => {
  const { data } = useSurveyStats(id);
  if (!data) return <Skeleton className="mt-2 h-10 w-full" />;
  return (
    <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
      <p><b>{data.score ?? '-'}</b> {data.kind === 'nps' ? 'NPS' : data.kind === 'csat' ? 'average (of 5)' : ''} · {data.responses} response(s){data.estimated ? ` (${data.estimated} estimated by AI)` : ''}</p>
      {data.kind === 'nps' && data.promoters !== undefined && <p className="text-slate-400">{data.promoters} promoters · {data.passives} passives · {data.detractors} detractors</p>}
    </div>
  );
};

const SurveysTab: React.FC = () => {
  const { data, isLoading } = useSurveys();
  const create = useCreateSurvey();
  const del = useDeleteSurvey();
  const { error, run } = useRun();
  const [f, setF] = useState({ name: '', kind: 'csat' as 'csat' | 'nps', delay: 120 });
  return (
    <div className="space-y-4">
      <form onSubmit={e => { e.preventDefault(); void run(async () => { await create.mutateAsync({ name: f.name, kind: f.kind, trigger: { event: 'visit_completed', delayMinutes: f.delay }, channel: 'whatsapp' }); setF({ ...f, name: '' }); }); }} className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-12">
        <input aria-label="Survey name" required minLength={2} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="e.g. Post-visit satisfaction" className={`${inputCls} mt-0 sm:col-span-5`} />
        <select aria-label="Survey type" value={f.kind} onChange={e => setF({ ...f, kind: e.target.value as typeof f.kind })} className={`${inputCls} mt-0 sm:col-span-3`}><option value="csat">CSAT (1-5)</option><option value="nps">NPS (0-10)</option></select>
        <input aria-label="Send after minutes" type="number" min={0} value={f.delay} onChange={e => setF({ ...f, delay: Number(e.target.value) || 0 })} className={`${inputCls} mt-0 sm:col-span-2`} />
        <button type="submit" className={`${btn} bg-accent text-white sm:col-span-2`}>Add survey</button>
      </form>
      {error && <p className="text-xs text-rose-600" role="alert">{error}</p>}
      {isLoading ? <Skeleton className="h-16 w-full" /> : (data ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700"><EmptyState icon={<Smile className="h-7 w-7" />} title="No surveys yet" description="Measure satisfaction after visits and calls. When a buyer does not answer, the AI estimates a score from the conversation." /></div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {(data ?? []).map(s => (
            <li key={s.id} className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between"><span className="font-serif text-sm font-bold text-slate-900 dark:text-white">{s.name}</span><Badge variant="slate" size="sm">{s.kind.toUpperCase()}</Badge></div>
              <p className="text-[11px] text-slate-500">Sent {s.trigger.delayMinutes} min after {String(s.trigger.event).replace(/_/g, ' ')} via {s.channel}</p>
              <SurveyStatsView id={s.id} />
              <button type="button" aria-label={`Delete ${s.name}`} onClick={() => window.confirm(`Delete ${s.name}?`) && void run(() => del.mutateAsync(s.id))} className="mt-2 text-slate-400 hover:text-rose-600 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const KbTab: React.FC = () => {
  const { data: bots } = useChatbots();
  const { data: history } = useKbHistory();
  const test = useRunKbTest();
  const { error, run } = useRun();
  const [botId, setBotId] = useState('');
  const [q, setQ] = useState('');
  const [last, setLast] = useState<Awaited<ReturnType<typeof test.mutateAsync>> | null>(null);
  const chosen = botId || bots?.chatbots[0]?.id || '';
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">Ask a question the way a buyer would and see exactly which passages your chatbot would find, and how strongly they match. No answer is generated, so it costs nothing.</p>
      <form onSubmit={e => { e.preventDefault(); void run(async () => setLast(await test.mutateAsync({ chatbotId: chosen, question: q }))); }} className="flex flex-wrap gap-2">
        <select aria-label="Chatbot" value={chosen} onChange={e => setBotId(e.target.value)} className={`${inputCls} mt-0 w-48`}>{(bots?.chatbots ?? []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <input aria-label="Question" required minLength={2} value={q} onChange={e => setQ(e.target.value)} placeholder="Is there a swimming pool?" className={`${inputCls} mt-0 min-w-0 flex-1`} />
        <button type="submit" disabled={!chosen || test.isPending} className={`${btn} bg-accent text-white`}><FlaskConical className="h-4 w-4" /> {test.isPending ? 'Searching…' : 'Test'}</button>
      </form>
      {error && <p className="text-xs text-rose-600" role="alert">{error}</p>}
      {last && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900" role="status">
          <p className="text-xs font-semibold">Best match {Math.round(last.bestScore * 100)}% · <span className={last.grounded ? 'text-emerald-600' : 'text-amber-600'}>{last.grounded ? 'the bot can answer this from your knowledge' : 'weak match: add or improve content'}</span></p>
          <ul className="mt-2 space-y-2">{last.results.map((r, i) => <li key={i} className="rounded-xl bg-slate-50 p-2 text-xs dark:bg-slate-800"><span className="font-semibold">{r.sourceTitle}</span> <span className="text-slate-400">{Math.round(r.score * 100)}%</span><p className="mt-0.5 text-slate-600 dark:text-slate-300">{r.snippet}</p></li>)}{last.results.length === 0 && <li className="text-xs text-slate-400">Nothing relevant was found.</li>}</ul>
        </div>
      )}
      <div>
        <h3 className="text-xs font-bold text-slate-900 dark:text-white">Recent tests</h3>
        <ul className="mt-1 space-y-1">{(history ?? []).slice(0, 8).map(h => <li key={h.id} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><Badge variant={h.grounded ? 'mint' : 'gold'} size="sm">{Math.round(h.bestScore * 100)}%</Badge>{h.question}</li>)}{(history ?? []).length === 0 && <li className="text-xs text-slate-400">No tests yet.</li>}</ul>
      </div>
    </div>
  );
};

export const DataHubPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('groups');
  const tabs: Array<[Tab, string]> = [['groups', 'Groups'], ['tags', 'Tags'], ['surveys', 'Surveys'], ['kb', 'Knowledge tester']];
  return (
    <div className="space-y-6 pb-12">
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <h1 className="font-serif text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Data &amp; insights</h1>
        <p className="mt-1 text-xs text-slate-500 sm:text-sm">Segment buyers, label conversations, measure satisfaction and check what your chatbot knows.</p>
      </div>
      <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-800" role="tablist">
        {tabs.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} type="button" onClick={() => setTab(id)} className={`border-b-2 px-4 py-2 text-xs font-semibold cursor-pointer ${tab === id ? 'border-accent text-accent' : 'border-transparent text-slate-500'}`}>{label}</button>)}
      </div>
      {tab === 'groups' ? <GroupsTab /> : tab === 'tags' ? <TagsTab /> : tab === 'surveys' ? <SurveysTab /> : <KbTab />}
    </div>
  );
};
