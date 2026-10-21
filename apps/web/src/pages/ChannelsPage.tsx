import React, { useState } from 'react';
import { Plus, Trash2, Plug, FileText, LayoutTemplate, Send, CheckCircle2 } from 'lucide-react';
import { CONNECTABLE_CHANNELS } from '@propbot/shared';
import {
  useConnections,
  useCreateConnection,
  useCreateTemplate,
  useCreateWidget,
  useDeleteConnection,
  useDeleteTemplate,
  useDeleteWidget,
  useSubmitTemplate,
  useTemplates,
  useTestConnection,
  useWidgets,
} from '../services/omnichannel.service.js';
import { useChatbots } from '../services/chatbots.service.js';
import { Badge } from '../components/ui/Badge.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { Skeleton } from '../components/common/Skeleton.js';

type Tab = 'connections' | 'templates' | 'widgets';
const inputCls = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800 dark:text-white';
const btn = 'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-40 cursor-pointer';
const errMsg = (e: unknown, f: string) => (e instanceof Error ? e.message : f);
const STATUS_VARIANT: Record<string, 'mint' | 'gold' | 'slate' | 'blue'> = { connected: 'mint', error: 'gold', pending: 'blue', approved: 'mint', rejected: 'gold', draft: 'slate', disconnected: 'slate', paused: 'slate' };

const useRun = () => {
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(errMsg(e, 'Action failed.'));
      return false;
    }
  };
  return { error, run, setError };
};

const Connections: React.FC = () => {
  const { data, isLoading } = useConnections();
  const { data: bots } = useChatbots();
  const create = useCreateConnection();
  const test = useTestConnection();
  const del = useDeleteConnection();
  const { error, run } = useRun();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ channel: 'instagram' as (typeof CONNECTABLE_CHANNELS)[number], name: '', account: '', token: '', appSecret: '', chatbotId: '' });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await run(() => create.mutateAsync({ channel: form.channel, name: form.name, externalAccountId: form.account || null, chatbotId: form.chatbotId || null, config: {}, secrets: { ...(form.token ? { accessToken: form.token } : {}), ...(form.appSecret ? { appSecret: form.appSecret } : {}) } }));
    if (ok) {
      setAdding(false);
      setForm({ ...form, name: '', account: '', token: '', appSecret: '' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">WhatsApp is set up on its own page. Connect Instagram, Messenger and e-mail here. Tokens are stored encrypted.</p>
        <button type="button" onClick={() => setAdding(a => !a)} className={`${btn} bg-accent text-white`}><Plus className="h-4 w-4" /> Connect</button>
      </div>
      {adding && (
        <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2">
          <div><label htmlFor="cc-ch" className="text-xs font-semibold">Channel</label><select id="cc-ch" value={form.channel} onChange={e => setForm({ ...form, channel: e.target.value as typeof form.channel })} className={inputCls}>{CONNECTABLE_CHANNELS.map(c => <option key={c}>{c}</option>)}</select></div>
          <div><label htmlFor="cc-name" className="text-xs font-semibold">Name</label><input id="cc-name" required minLength={2} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} /></div>
          <div><label htmlFor="cc-acct" className="text-xs font-semibold">Page / account ID</label><input id="cc-acct" value={form.account} onChange={e => setForm({ ...form, account: e.target.value })} className={inputCls} /></div>
          <div><label htmlFor="cc-bot" className="text-xs font-semibold">Chatbot</label><select id="cc-bot" value={form.chatbotId} onChange={e => setForm({ ...form, chatbotId: e.target.value })} className={inputCls}><option value="">First chatbot</option>{(bots?.chatbots ?? []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
          <div><label htmlFor="cc-tok" className="text-xs font-semibold">Access token</label><input id="cc-tok" type="password" autoComplete="off" value={form.token} onChange={e => setForm({ ...form, token: e.target.value })} className={inputCls} /></div>
          <div><label htmlFor="cc-sec" className="text-xs font-semibold">App secret (verifies webhooks)</label><input id="cc-sec" type="password" autoComplete="off" value={form.appSecret} onChange={e => setForm({ ...form, appSecret: e.target.value })} className={inputCls} /></div>
          <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={() => setAdding(false)} className={`${btn} text-slate-600`}>Cancel</button><button type="submit" disabled={create.isPending} className={`${btn} bg-accent text-white`}>Save connection</button></div>
        </form>
      )}
      {error && <p className="text-xs text-rose-600" role="alert">{error}</p>}
      {isLoading ? <Skeleton className="h-24 w-full" /> : (data ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700"><EmptyState icon={<Plug className="h-7 w-7" />} title="No channels connected" description="Connect Instagram or Messenger to answer DMs from the inbox." /></div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {(data ?? []).map(c => (
            <li key={c.id} className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-bold text-slate-900 dark:text-white">{c.name}</span><Badge variant={STATUS_VARIANT[c.status] ?? 'slate'} size="sm">{c.status}</Badge></div>
              <p className="mt-1 text-[11px] text-slate-500">{c.channel}{c.externalAccountId ? ` · ${c.externalAccountId}` : ''} · secrets: {c.secretKeys.join(', ') || 'none'}</p>
              {c.lastError && <p className="mt-1 text-[11px] text-rose-600">{c.lastError}</p>}
              <div className="mt-3 flex gap-2"><button type="button" disabled={test.isPending} onClick={() => void run(() => test.mutateAsync(c.id))} className={`${btn} bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200`}><CheckCircle2 className="h-3.5 w-3.5" /> Test</button><button type="button" aria-label={`Remove ${c.name}`} onClick={() => window.confirm(`Disconnect ${c.name}?`) && void run(() => del.mutateAsync(c.id))} className="ml-auto text-slate-400 hover:text-rose-600 cursor-pointer"><Trash2 className="h-4 w-4" /></button></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const Templates: React.FC = () => {
  const { data, isLoading } = useTemplates();
  const create = useCreateTemplate();
  const submit = useSubmitTemplate();
  const del = useDeleteTemplate();
  const { error, run } = useRun();
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: '', body: '', samples: '', category: 'utility' as 'utility' | 'marketing' });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await run(() => create.mutateAsync({ name: f.name, language: 'en', category: f.category, content: { body: f.body, buttons: [] }, sampleValues: f.samples.split('|').map(s => s.trim()).filter(Boolean) }));
    if (ok) {
      setAdding(false);
      setF({ name: '', body: '', samples: '', category: 'utility' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">WhatsApp only allows free-form replies for 24 hours after the buyer writes. After that, use an approved template. Use {'{{1}}'}, {'{{2}}'} for personal details.</p>
        <button type="button" onClick={() => setAdding(a => !a)} className={`${btn} bg-accent text-white`}><Plus className="h-4 w-4" /> New template</button>
      </div>
      {adding && (
        <form onSubmit={save} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label htmlFor="t-name" className="text-xs font-semibold">Name (lowercase_with_underscores)</label><input id="t-name" required value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className={`${inputCls} font-mono`} placeholder="visit_followup" /></div>
            <div><label htmlFor="t-cat" className="text-xs font-semibold">Category</label><select id="t-cat" value={f.category} onChange={e => setF({ ...f, category: e.target.value as typeof f.category })} className={inputCls}><option value="utility">Utility (reminders, updates)</option><option value="marketing">Marketing (offers, launches)</option></select></div>
          </div>
          <div><label htmlFor="t-body" className="text-xs font-semibold">Message</label><textarea id="t-body" required rows={3} maxLength={1024} value={f.body} onChange={e => setF({ ...f, body: e.target.value })} className={inputCls} placeholder="Hi {{1}}, thanks for visiting {{2}}. Shall we plan the next step?" /></div>
          <div><label htmlFor="t-samples" className="text-xs font-semibold">Example values, separated by |</label><input id="t-samples" value={f.samples} onChange={e => setF({ ...f, samples: e.target.value })} className={inputCls} placeholder="Asha | Lakeside Habitat" /></div>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setAdding(false)} className={`${btn} text-slate-600`}>Cancel</button><button type="submit" disabled={create.isPending} className={`${btn} bg-accent text-white`}>Save draft</button></div>
        </form>
      )}
      {error && <p className="text-xs text-rose-600" role="alert">{error}</p>}
      {isLoading ? <Skeleton className="h-24 w-full" /> : (data ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700"><EmptyState icon={<FileText className="h-7 w-7" />} title="No templates yet" description="Create one so your team can message buyers after the 24-hour window." /></div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {(data ?? []).map(t => (
            <li key={t.id} className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2"><span className="truncate font-mono text-xs font-bold text-slate-900 dark:text-white">{t.name}</span><Badge variant={STATUS_VARIANT[t.status] ?? 'slate'} size="sm">{t.status}</Badge></div>
              <p className="mt-2 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300">{t.content.body}</p>
              {t.rejectionReason && <p className="mt-1 text-[11px] text-rose-600">{t.rejectionReason}</p>}
              <div className="mt-3 flex items-center gap-2">
                {(t.status === 'draft' || t.status === 'rejected') && <button type="button" disabled={submit.isPending} onClick={() => void run(() => submit.mutateAsync(t.id))} className={`${btn} bg-slate-900 text-white dark:bg-slate-700`}><Send className="h-3.5 w-3.5" /> Submit for approval</button>}
                <span className="text-[11px] text-slate-400">{t.variableCount} variable(s)</span>
                <button type="button" aria-label={`Delete ${t.name}`} onClick={() => window.confirm(`Delete ${t.name}?`) && void run(() => del.mutateAsync(t.id))} className="ml-auto text-slate-400 hover:text-rose-600 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const Widgets: React.FC = () => {
  const { data, isLoading } = useWidgets();
  const { data: bots } = useChatbots();
  const create = useCreateWidget();
  const del = useDeleteWidget();
  const { error, run } = useRun();
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: '', chatbotId: '', domains: '', color: '#0F766E', homeTitle: 'Hi there', quick: 'Book a site visit, See prices', nudgeMsg: '', nudgeUrl: '', nudgeDelay: 15 });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await run(() =>
      create.mutateAsync({
        name: f.name,
        chatbotId: f.chatbotId || null,
        allowedDomains: f.domains.split(',').map(s => s.trim()).filter(Boolean),
        styling: { brandColor: f.color, position: 'right', launcherLabel: 'Chat with us' },
        sections: { homeTitle: f.homeTitle, homeSubtitle: 'How can we help you find a home?', quickActions: f.quick.split(',').map(s => s.trim()).filter(Boolean), showHistory: true, showHelpCentre: false },
        nudges: f.nudgeMsg ? [{ id: 'nudge1', message: f.nudgeMsg, urlContains: f.nudgeUrl, delaySeconds: f.nudgeDelay }] : [],
      }),
    );
    if (ok) setAdding(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">Each widget has its own look, home screen, proactive nudges and the websites it may run on.</p>
        <button type="button" onClick={() => setAdding(a => !a)} className={`${btn} bg-accent text-white`}><Plus className="h-4 w-4" /> New widget</button>
      </div>
      {adding && (
        <form onSubmit={save} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2">
          <div><label htmlFor="w-name" className="text-xs font-semibold">Name</label><input id="w-name" required minLength={2} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className={inputCls} /></div>
          <div><label htmlFor="w-bot" className="text-xs font-semibold">Chatbot</label><select id="w-bot" value={f.chatbotId} onChange={e => setF({ ...f, chatbotId: e.target.value })} className={inputCls}><option value="">Choose…</option>{(bots?.chatbots ?? []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
          <div><label htmlFor="w-dom" className="text-xs font-semibold">Allowed websites (comma separated)</label><input id="w-dom" value={f.domains} onChange={e => setF({ ...f, domains: e.target.value })} className={inputCls} placeholder="example.com, shop.example.com" /></div>
          <div><label htmlFor="w-col" className="text-xs font-semibold">Brand colour</label><input id="w-col" type="color" value={f.color} onChange={e => setF({ ...f, color: e.target.value })} className="mt-1 h-9 w-full rounded-xl border border-slate-200" /></div>
          <div><label htmlFor="w-title" className="text-xs font-semibold">Home title</label><input id="w-title" value={f.homeTitle} onChange={e => setF({ ...f, homeTitle: e.target.value })} className={inputCls} /></div>
          <div><label htmlFor="w-quick" className="text-xs font-semibold">Quick actions (comma separated)</label><input id="w-quick" value={f.quick} onChange={e => setF({ ...f, quick: e.target.value })} className={inputCls} /></div>
          <div className="sm:col-span-2"><label htmlFor="w-nudge" className="text-xs font-semibold">Proactive nudge (optional)</label><div className="mt-1 grid gap-2 sm:grid-cols-3"><input id="w-nudge" aria-label="Nudge message" value={f.nudgeMsg} onChange={e => setF({ ...f, nudgeMsg: e.target.value })} className={`${inputCls} mt-0 sm:col-span-1`} placeholder="Looking at pricing? Ask me." /><input aria-label="Nudge page contains" value={f.nudgeUrl} onChange={e => setF({ ...f, nudgeUrl: e.target.value })} className={`${inputCls} mt-0`} placeholder="/pricing" /><input aria-label="Nudge delay seconds" type="number" min={0} max={600} value={f.nudgeDelay} onChange={e => setF({ ...f, nudgeDelay: Number(e.target.value) || 0 })} className={`${inputCls} mt-0`} /></div></div>
          <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={() => setAdding(false)} className={`${btn} text-slate-600`}>Cancel</button><button type="submit" disabled={create.isPending} className={`${btn} bg-accent text-white`}>Save widget</button></div>
        </form>
      )}
      {error && <p className="text-xs text-rose-600" role="alert">{error}</p>}
      {isLoading ? <Skeleton className="h-24 w-full" /> : (data ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700"><EmptyState icon={<LayoutTemplate className="h-7 w-7" />} title="No widgets yet" description="Create a widget to control where and how the chat appears on your websites." /></div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {(data ?? []).map(w => (
            <li key={w.id} className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 truncate text-sm font-bold text-slate-900 dark:text-white"><span className="h-3 w-3 rounded-full" style={{ background: String(w.styling.brandColor ?? '#0F766E') }} />{w.name}</span><Badge variant={w.isActive ? 'mint' : 'slate'} size="sm">{w.isActive ? 'Active' : 'Off'}</Badge></div>
              <p className="mt-1 text-[11px] text-slate-500">{w.allowedDomains.length ? w.allowedDomains.join(', ') : 'Any website'} · {w.nudges.length} nudge(s)</p>
              <code className="mt-2 block break-all rounded-lg bg-slate-50 p-2 text-[10px] dark:bg-slate-950/50">GET /api/public/omni/widgets/{w.id}</code>
              <button type="button" aria-label={`Delete ${w.name}`} onClick={() => window.confirm(`Delete ${w.name}?`) && void run(() => del.mutateAsync(w.id))} className="mt-2 text-slate-400 hover:text-rose-600 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const ChannelsPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('connections');
  const tabs: Array<[Tab, string]> = [['connections', 'Channels'], ['templates', 'WhatsApp templates'], ['widgets', 'Website widgets']];
  return (
    <div className="space-y-6 pb-12">
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <h1 className="font-serif text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Channels</h1>
        <p className="mt-1 text-xs text-slate-500 sm:text-sm">Where buyers reach you, and how you reach them back.</p>
      </div>
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800" role="tablist">
        {tabs.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} type="button" onClick={() => setTab(id)} className={`border-b-2 px-4 py-2 text-xs font-semibold cursor-pointer ${tab === id ? 'border-accent text-accent' : 'border-transparent text-slate-500'}`}>{label}</button>)}
      </div>
      {tab === 'connections' ? <Connections /> : tab === 'templates' ? <Templates /> : <Widgets />}
    </div>
  );
};
