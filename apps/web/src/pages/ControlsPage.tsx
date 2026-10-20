import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Eye, FileLock2, Gauge, KeyRound, Plus, ShieldCheck, Trash2, Users } from 'lucide-react';
import { NOTIFICATION_CHANNELS, NOTIFICATION_EVENTS, POLICY_ACTIONS, POLICY_MODULES, type PolicyAction, type PolicyModule } from '@propbot/shared';
import {
  useAccessLogs,
  useApiKeyList,
  useAssignPolicy,
  useCreateDataRequest,
  useCreateKey,
  useCreatePolicy,
  useCreateTeam,
  useDataRequests,
  useDecideDataRequest,
  useDeleteNotificationRule,
  useDeletePolicy,
  useDeleteTeam,
  useMarkNotificationsRead,
  useNotificationCentre,
  useNotificationRules,
  usePolicies,
  usePolicyChanges,
  usePrivacy,
  useRevokeKey,
  useSaveNotificationRule,
  useSetPrivacy,
  useTeams,
  useUnassignPolicy,
  useUsage,
} from '../services/controls.service.js';
import { useContacts } from '../services/contacts.service.js';
import { Badge } from '../components/ui/Badge.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { Skeleton } from '../components/common/Skeleton.js';

type Tab = 'policies' | 'teams' | 'logs' | 'privacy' | 'usage' | 'alerts' | 'keys';
const inputCls = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800 dark:text-white';
const btn = 'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-40 cursor-pointer';
const card = 'rounded-2xl border border-slate-200/90 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900';
const errMsg = (e: unknown, f: string) => (e instanceof Error ? e.message : f);
const ROLES = ['company_admin', 'sales_manager', 'agent', 'viewer'] as const;

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
const Err: React.FC<{ error: string | null }> = ({ error }) => (error ? <p className="text-xs text-rose-600" role="alert">{error}</p> : null);

// ---------------------------------------------------------------------------- policies
const PoliciesTab: React.FC = () => {
  const { data, isLoading } = usePolicies();
  const { data: teams } = useTeams();
  const { data: changes } = usePolicyChanges();
  const create = useCreatePolicy();
  const del = useDeletePolicy();
  const assign = useAssignPolicy();
  const unassign = useUnassignPolicy();
  const { error, run } = useRun();
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState<{ name: string; module: PolicyModule; actions: PolicyAction[]; hours: boolean; start: number; end: number }>({ name: '', module: 'inbox', actions: ['view'], hours: false, start: 9, end: 18 });
  const [subject, setSubject] = useState<Record<string, string>>({});

  const toggle = (a: PolicyAction) => setF({ ...f, actions: f.actions.includes(a) ? f.actions.filter(x => x !== a) : [...f.actions, a] });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await run(() =>
      create.mutateAsync({
        name: f.name,
        rules: [{ module: f.module, actions: f.actions, conditions: f.hours ? { businessHours: { days: [1, 2, 3, 4, 5, 6], startHour: f.start, endHour: f.end, timezone: 'Asia/Kolkata' } } : {} }],
      }),
    );
    if (ok) setAdding(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3"><p className="text-xs text-slate-500">Roles decide the basics. A policy narrows what specific people, roles or teams may do. Once someone has a policy, only what it grants is allowed.</p><button type="button" onClick={() => setAdding(a => !a)} className={`${btn} bg-[#B84A22] text-white`}><Plus className="h-4 w-4" /> New policy</button></div>
      {adding && (
        <form onSubmit={save} className={`${card} grid gap-3 sm:grid-cols-2`}>
          <div><label htmlFor="po-name" className="text-xs font-semibold">Name</label><input id="po-name" required minLength={2} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className={`${inputCls} mt-1 w-full`} /></div>
          <div><label htmlFor="po-mod" className="text-xs font-semibold">Applies to</label><select id="po-mod" value={f.module} onChange={e => setF({ ...f, module: e.target.value as PolicyModule })} className={`${inputCls} mt-1 w-full`}>{POLICY_MODULES.map(m => <option key={m} value={m}>{m === '*' ? 'Everything' : m}</option>)}</select></div>
          <fieldset className="sm:col-span-2"><legend className="text-xs font-semibold">Allowed actions</legend><div className="mt-1 flex flex-wrap gap-3">{POLICY_ACTIONS.map(a => <label key={a} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={f.actions.includes(a)} onChange={() => toggle(a)} /> {a}</label>)}</div></fieldset>
          <label className="flex items-center gap-2 text-xs sm:col-span-2"><input type="checkbox" checked={f.hours} onChange={e => setF({ ...f, hours: e.target.checked })} /> Only during office hours (Mon-Sat, IST) <input aria-label="From hour" type="number" min={0} max={23} value={f.start} disabled={!f.hours} onChange={e => setF({ ...f, start: Number(e.target.value) })} className={`${inputCls} w-16`} /> to <input aria-label="To hour" type="number" min={1} max={24} value={f.end} disabled={!f.hours} onChange={e => setF({ ...f, end: Number(e.target.value) })} className={`${inputCls} w-16`} /></label>
          <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={() => setAdding(false)} className={`${btn} text-slate-600`}>Cancel</button><button type="submit" disabled={f.actions.length === 0 || create.isPending} className={`${btn} bg-[#B84A22] text-white`}>Save policy</button></div>
        </form>
      )}
      <Err error={error} />
      {isLoading ? <Skeleton className="h-24 w-full" /> : (data ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700"><EmptyState icon={<ShieldCheck className="h-7 w-7" />} title="No policies yet" description="Everyone currently works within their role. Add a policy to restrict specific people or teams." /></div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {(data ?? []).map(p => (
            <li key={p.id} className={card}>
              <div className="flex items-center justify-between"><span className="font-serif text-sm font-bold text-slate-900 dark:text-white">{p.name}</span><button type="button" aria-label={`Delete ${p.name}`} onClick={() => window.confirm(`Delete ${p.name}? People assigned to it are no longer restricted by it.`) && void run(() => del.mutateAsync(p.id))} className="text-slate-400 hover:text-rose-600 cursor-pointer"><Trash2 className="h-4 w-4" /></button></div>
              <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">{p.rules.map((r, i) => <li key={i}><b>{r.module === '*' ? 'Everything' : r.module}</b>: {r.actions.join(', ')}{r.conditions.businessHours ? ` · ${r.conditions.businessHours.startHour}:00-${r.conditions.businessHours.endHour}:00` : ''}{r.conditions.teamIds?.length ? ' · specific teams' : ''}</li>)}</ul>
              <div className="mt-3 flex flex-wrap gap-1.5">{p.assignments.map(a => <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] dark:bg-slate-800">{a.subjectType}: {a.label}<button type="button" aria-label={`Remove ${a.label}`} onClick={() => void run(() => unassign.mutateAsync({ id: p.id, assignmentId: a.id }))} className="text-slate-400 hover:text-rose-600 cursor-pointer">×</button></span>)}{p.assignments.length === 0 && <span className="text-[11px] text-slate-400">Not assigned to anyone yet.</span>}</div>
              <div className="mt-2 flex gap-2">
                <select aria-label={`Assign ${p.name} to`} value={subject[p.id] ?? ''} onChange={e => setSubject({ ...subject, [p.id]: e.target.value })} className={`${inputCls} min-w-0 flex-1`}>
                  <option value="">Assign to…</option>
                  <optgroup label="Roles">{ROLES.map(r => <option key={r} value={`role:${r}`}>{r.replace('_', ' ')}</option>)}</optgroup>
                  <optgroup label="Teams">{(teams ?? []).map(t => <option key={t.id} value={`team:${t.id}`}>{t.name}</option>)}</optgroup>
                </select>
                <button type="button" disabled={!subject[p.id]} onClick={() => { const [subjectType, subjectId] = (subject[p.id] ?? '').split(':') as ['role' | 'team', string]; void run(() => assign.mutateAsync({ id: p.id, input: { subjectType, subjectId } })).then(() => setSubject({ ...subject, [p.id]: '' })); }} className={`${btn} bg-slate-900 text-white dark:bg-slate-700`}>Assign</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <section><h3 className="text-xs font-bold text-slate-900 dark:text-white">Change history</h3><ul className="mt-1 space-y-0.5 text-[11px] text-slate-500">{(changes ?? []).slice(0, 8).map(c => <li key={c.id}>{new Date(c.createdAt).toLocaleString()} · {c.actorName ?? 'Someone'} {c.action} a policy</li>)}{(changes ?? []).length === 0 && <li>No changes yet.</li>}</ul></section>
    </div>
  );
};

// ---------------------------------------------------------------------------- teams
const TeamsTab: React.FC = () => {
  const { data, isLoading } = useTeams();
  const create = useCreateTeam();
  const del = useDeleteTeam();
  const { error, run } = useRun();
  const [name, setName] = useState('');
  return (
    <div className="space-y-4">
      <form onSubmit={e => { e.preventDefault(); void run(async () => { await create.mutateAsync({ name, memberIds: [] }); setName(''); }); }} className="flex gap-2">
        <input aria-label="Team name" required minLength={2} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Whitefield sales" className={`${inputCls} flex-1`} />
        <button type="submit" className={`${btn} bg-[#B84A22] text-white`}><Plus className="h-4 w-4" /> Team</button>
      </form>
      <Err error={error} />
      {isLoading ? <Skeleton className="h-16 w-full" /> : (data ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700"><EmptyState icon={<Users className="h-7 w-7" />} title="No teams yet" description="Teams let policies and assignments follow how your sales floor is organised." /></div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">{(data ?? []).map(t => <li key={t.id} className={card}><div className="flex items-center justify-between"><span className="font-serif text-sm font-bold">{t.name}</span><button type="button" aria-label={`Delete ${t.name}`} onClick={() => window.confirm(`Delete ${t.name}?`) && void run(() => del.mutateAsync(t.id))} className="text-slate-400 hover:text-rose-600 cursor-pointer"><Trash2 className="h-4 w-4" /></button></div><p className="mt-1 text-[11px] text-slate-500">{t.members.length} member(s)</p></li>)}</ul>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------- access logs
const LogsTab: React.FC = () => {
  const [days, setDays] = useState(30);
  const [action, setAction] = useState('');
  const { data, isLoading, error } = useAccessLogs({ days, action: action || undefined });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Period" value={days} onChange={e => setDays(Number(e.target.value))} className={inputCls}>{[7, 30, 90].map(d => <option key={d} value={d}>Last {d} days</option>)}</select>
        <select aria-label="Action" value={action} onChange={e => setAction(e.target.value)} className={inputCls}><option value="">All actions</option>{['view', 'export', 'download'].map(a => <option key={a}>{a}</option>)}</select>
        <a href={`/api/controls/access-logs/export.csv?days=${days}`} className={`${btn} ml-auto bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200`}>Download CSV</a>
      </div>
      {error && <p className="text-xs text-rose-600" role="alert">{error.message}</p>}
      {isLoading ? <Skeleton className="h-32 w-full" /> : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-xs"><thead className="border-b border-slate-100 text-[10px] uppercase text-slate-400 dark:border-slate-800"><tr>{['When', 'Who', 'Did', 'What'].map(h => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
            <tbody>{(data ?? []).map(l => <tr key={l.id} className="border-b border-slate-50 dark:border-slate-800/60"><td className="px-4 py-2 text-slate-500">{new Date(l.createdAt).toLocaleString()}</td><td className="px-4 py-2 font-semibold">{l.userName ?? (l.apiKeyId ? 'API key' : 'Unknown')}</td><td className="px-4 py-2"><Badge variant={l.action === 'view' ? 'slate' : 'gold'} size="sm">{l.action}</Badge></td><td className="px-4 py-2 text-slate-600 dark:text-slate-300">{l.resourceType.replace(/_/g, ' ')}</td></tr>)}{(data ?? []).length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No activity recorded for this period.</td></tr>}</tbody></table>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------- privacy
const PrivacyTab: React.FC = () => {
  const { data: privacy } = usePrivacy();
  const setPrivacy = useSetPrivacy();
  const { data: requests } = useDataRequests();
  const create = useCreateDataRequest();
  const decide = useDecideDataRequest();
  const [search, setSearch] = useState('');
  const { data: contacts } = useContacts({ search, limit: 5 });
  const { error, run } = useRun();
  const roles = privacy?.maskRoles ?? [];
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-3">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white"><Eye className="h-4 w-4" /> Hide contact details</h2>
        <p className="text-xs text-slate-500">These roles see phone numbers and e-mail addresses partly hidden in the inbox and customer view.</p>
        <div className="flex flex-wrap gap-3">{ROLES.map(r => <label key={r} className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={roles.includes(r)} onChange={e => void run(() => setPrivacy.mutateAsync({ maskRoles: e.target.checked ? [...roles, r] : roles.filter(x => x !== r) }))} /> {r.replace('_', ' ')}</label>)}</div>
      </section>
      <section className="space-y-3">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white"><FileLock2 className="h-4 w-4" /> Data requests (DPDP)</h2>
        <p className="text-xs text-slate-500">Export everything held about a person, or erase them. Erasure removes personal details and message text; the lead record and counts stay.</p>
        <input aria-label="Find a contact" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search a contact by name or phone" className={`${inputCls} w-full`} />
        {search && <ul className="space-y-1">{(contacts?.items ?? []).map(c => <li key={c.id} className="flex items-center gap-2 text-xs"><span className="font-semibold">{c.firstName} {c.lastName ?? ''}</span><button type="button" onClick={() => void run(() => create.mutateAsync({ kind: 'export', contactId: c.id }))} className="text-[#B84A22] cursor-pointer">Request export</button><button type="button" onClick={() => void run(() => create.mutateAsync({ kind: 'delete', contactId: c.id }))} className="text-rose-600 cursor-pointer">Request erasure</button></li>)}</ul>}
        <Err error={error} />
        <ul className="space-y-2">{(requests ?? []).map(r => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-2 text-xs dark:border-slate-800">
            <Badge variant={r.status === 'completed' ? 'mint' : r.status === 'pending' ? 'blue' : 'slate'} size="sm">{r.status}</Badge><span className="font-semibold">{r.kind}</span><span className="text-slate-500">{r.subjectLabel}</span>
            {r.status === 'pending' && <span className="ml-auto flex gap-2"><button type="button" onClick={() => window.confirm(r.kind === 'delete' ? 'Erase this person? This cannot be undone.' : 'Prepare the export?') && void run(() => decide.mutateAsync({ id: r.id, decision: 'approve' }))} className="font-bold text-emerald-700 cursor-pointer">Approve</button><button type="button" onClick={() => void run(() => decide.mutateAsync({ id: r.id, decision: 'reject' }))} className="text-slate-500 cursor-pointer">Reject</button></span>}
            {r.status === 'completed' && r.kind === 'export' && <a href={`/api/controls/data-requests/${r.id}/download`} className="ml-auto font-bold text-[#B84A22]">Download</a>}
          </li>
        ))}{(requests ?? []).length === 0 && <li className="text-xs text-slate-400">No requests.</li>}</ul>
      </section>
    </div>
  );
};

// ---------------------------------------------------------------------------- usage
const UsageTab: React.FC = () => {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useUsage(days);
  if (isLoading || !data) return <Skeleton className="h-40 w-full" />;
  const max = Math.max(1, ...data.daily.map(d => d.tokens));
  const stat = (l: string, v: string, sub?: string) => <div className={card}><p className="text-[11px] text-slate-500">{l}</p><p className="font-serif text-2xl font-bold">{v}</p>{sub && <p className="text-[10px] text-slate-400">{sub}</p>}</div>;
  return (
    <div className="space-y-6">
      <select aria-label="Period" value={days} onChange={e => setDays(Number(e.target.value))} className={inputCls}>{[7, 30, 90].map(d => <option key={d} value={d}>Last {d} days</option>)}</select>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stat('AI tokens', data.llm.tokens.toLocaleString(), `${data.llm.calls} calls · about $${data.llm.costUsd.toFixed(3)}`)}
        {stat('Messages sent', data.messages.total.toLocaleString(), Object.entries(data.messages.byChannel).map(([k, v]) => `${k} ${v}`).join(' · '))}
        {stat('AI call minutes', String(data.calls.minutes), `${data.calls.count} calls`)}
        {stat('Busiest purpose', Object.entries(data.llm.byPurpose).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-', 'where tokens go')}
      </div>
      <section><h3 className="text-xs font-bold">Tokens per day</h3><div className="mt-2 flex h-28 items-end gap-1">{data.daily.map(d => <div key={d.day} title={`${d.day}: ${d.tokens} tokens, ${d.messages} messages`} className="flex-1 rounded-t bg-[#B84A22]/80" style={{ height: `${(d.tokens / max) * 100}%`, minHeight: 3 }} />)}{data.daily.length === 0 && <p className="text-xs text-slate-400">No usage in this period.</p>}</div></section>
      <p className="text-[11px] text-slate-400">Usage is tracked for visibility only. Nothing is charged yet.</p>
    </div>
  );
};

// ---------------------------------------------------------------------------- alerts
const AlertsTab: React.FC = () => {
  const { data: rules } = useNotificationRules();
  const { data: centre } = useNotificationCentre();
  const save = useSaveNotificationRule();
  const del = useDeleteNotificationRule();
  const read = useMarkNotificationsRead();
  const { error, run } = useRun();
  const [f, setF] = useState<{ event: (typeof NOTIFICATION_EVENTS)[number]; channels: string[] }>({ event: 'lead_hot', channels: ['in_app'] });
  const toggle = (c: string) => setF({ ...f, channels: f.channels.includes(c) ? f.channels.filter(x => x !== c) : [...f.channels, c] });
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-3">
        <h2 className="text-sm font-bold">Who gets alerted</h2>
        <form onSubmit={e => { e.preventDefault(); void run(() => save.mutateAsync({ eventType: f.event, channels: f.channels as never, isActive: true })); }} className="space-y-2">
          <select aria-label="Event" value={f.event} onChange={e => setF({ ...f, event: e.target.value as typeof f.event })} className={`${inputCls} w-full`}>{NOTIFICATION_EVENTS.map(e => <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>)}</select>
          <div className="flex flex-wrap gap-3">{NOTIFICATION_CHANNELS.map(c => <label key={c} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={f.channels.includes(c)} onChange={() => toggle(c)} /> {c.replace('_', '-')}{c === 'whatsapp' || c === 'slack' ? ' (soon)' : ''}</label>)}</div>
          <button type="submit" disabled={f.channels.length === 0} className={`${btn} bg-[#B84A22] text-white`}>Save for admins and managers</button>
        </form>
        <Err error={error} />
        <ul className="space-y-1">{(rules ?? []).map(r => <li key={r.id} className="flex items-center gap-2 text-xs"><b>{r.eventType.replace(/_/g, ' ')}</b><span className="text-slate-500">{r.channels.join(', ')}{r.userId ? ' (personal)' : ''}</span><button type="button" aria-label={`Remove rule ${r.eventType}`} onClick={() => void run(() => del.mutateAsync(r.id))} className="ml-auto text-slate-400 hover:text-rose-600 cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button></li>)}{(rules ?? []).length === 0 && <li className="text-xs text-slate-400">No rules: the built-in alerts apply.</li>}</ul>
      </section>
      <section className="space-y-3">
        <div className="flex items-center justify-between"><h2 className="text-sm font-bold">Your notifications {centre?.unreadCount ? <Badge variant="gold" size="sm">{centre.unreadCount} new</Badge> : null}</h2><button type="button" disabled={!centre?.unreadCount} onClick={() => void read.mutateAsync(undefined)} className="text-xs font-semibold text-[#B84A22] disabled:opacity-40 cursor-pointer">Mark all read</button></div>
        <ul className="space-y-2">{(centre?.items ?? []).map(n => <li key={n.id} className={`rounded-xl border p-2 text-xs ${n.isRead ? 'border-slate-200 dark:border-slate-800' : 'border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20'}`}><p className="font-semibold">{n.title}</p><p className="text-slate-600 dark:text-slate-300">{n.message}</p>{n.linkUrl && <Link to={n.linkUrl} className="text-[#B84A22]">Open</Link>}</li>)}{(centre?.items ?? []).length === 0 && <li className="text-xs text-slate-400">Nothing yet.</li>}</ul>
      </section>
    </div>
  );
};

// ---------------------------------------------------------------------------- API keys
const KeysTab: React.FC = () => {
  const { data, isLoading } = useApiKeyList();
  const create = useCreateKey();
  const revoke = useRevokeKey();
  const { error, run } = useRun();
  const [name, setName] = useState('');
  const [days, setDays] = useState(90);
  const [shown, setShown] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">Keys let other systems (CRM sync, portals, AI assistants) read your data. Give each one an expiry and revoke it the moment it is no longer needed.</p>
      <form onSubmit={e => { e.preventDefault(); void run(async () => { const k = await create.mutateAsync({ name, permissions: ['read:leads'], expiresInDays: days }); setShown(k.apiKey); setName(''); }); }} className="flex flex-wrap gap-2">
        <input aria-label="Key name" required minLength={2} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Portal sync" className={`${inputCls} flex-1`} />
        <select aria-label="Expires" value={days} onChange={e => setDays(Number(e.target.value))} className={inputCls}>{[30, 90, 180, 365].map(d => <option key={d} value={d}>Expires in {d} days</option>)}</select>
        <button type="submit" className={`${btn} bg-[#B84A22] text-white`}><KeyRound className="h-4 w-4" /> Create key</button>
      </form>
      {shown && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900" role="status"><b>Copy it now, it is shown only once:</b><code className="mt-1 block break-all font-mono">{shown}</code></div>}
      <Err error={error} />
      {isLoading ? <Skeleton className="h-20 w-full" /> : (
        <ul className="space-y-2">{(data ?? []).map(k => {
          const expired = k.expiresAt && new Date(k.expiresAt).getTime() < Date.now();
          return (
            <li key={k.id} className={`${card} flex flex-wrap items-center gap-3 text-xs`}>
              <span className="font-semibold">{k.name}</span><code className="text-slate-400">{k.keyPrefix}…</code>
              {expired ? <Badge variant="gold" size="sm">Expired</Badge> : k.expiresAt ? <Badge variant="slate" size="sm">Expires {new Date(k.expiresAt).toLocaleDateString()}</Badge> : <Badge variant="outline" size="sm">No expiry</Badge>}
              <span className="text-slate-500">{k.usageCount} calls{k.lastUsedAt ? ` · last ${new Date(k.lastUsedAt).toLocaleDateString()}` : ''}</span>
              <button type="button" onClick={() => window.confirm(`Revoke ${k.name}?`) && void run(() => revoke.mutateAsync(k.id))} className="ml-auto font-semibold text-rose-600 cursor-pointer">Revoke</button>
            </li>
          );
        })}{(data ?? []).length === 0 && <li className="text-xs text-slate-400">No keys.</li>}</ul>
      )}
    </div>
  );
};

export const ControlsPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('policies');
  const tabs: Array<[Tab, string, React.ReactNode]> = [
    ['policies', 'Policies', <ShieldCheck key="p" className="h-3.5 w-3.5" />],
    ['teams', 'Teams', <Users key="t" className="h-3.5 w-3.5" />],
    ['logs', 'Access logs', <Eye key="l" className="h-3.5 w-3.5" />],
    ['privacy', 'Privacy', <FileLock2 key="pr" className="h-3.5 w-3.5" />],
    ['usage', 'Usage', <Gauge key="u" className="h-3.5 w-3.5" />],
    ['alerts', 'Alerts', <Bell key="a" className="h-3.5 w-3.5" />],
    ['keys', 'API keys', <KeyRound key="k" className="h-3.5 w-3.5" />],
  ];
  return (
    <div className="space-y-6 pb-12">
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <h1 className="font-serif text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Security &amp; compliance</h1>
        <p className="mt-1 text-xs text-slate-500 sm:text-sm">Control who can do what, see who looked at what, protect personal data and keep an eye on usage. <Link to="/changelog" className="font-semibold text-[#B84A22]">What&apos;s new</Link></p>
      </div>
      <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-800" role="tablist">
        {tabs.map(([id, label, icon]) => <button key={id} role="tab" aria-selected={tab === id} type="button" onClick={() => setTab(id)} className={`flex items-center gap-1.5 border-b-2 px-4 py-2 text-xs font-semibold cursor-pointer ${tab === id ? 'border-[#B84A22] text-[#B84A22]' : 'border-transparent text-slate-500'}`}>{icon}{label}</button>)}
      </div>
      {tab === 'policies' ? <PoliciesTab /> : tab === 'teams' ? <TeamsTab /> : tab === 'logs' ? <LogsTab /> : tab === 'privacy' ? <PrivacyTab /> : tab === 'usage' ? <UsageTab /> : tab === 'alerts' ? <AlertsTab /> : <KeysTab />}
    </div>
  );
};
