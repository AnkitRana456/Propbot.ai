import React, { useState } from 'react';
import { Copy, KeyRound, Plus, Trash2, Upload, X, Radio, QrCode, ExternalLink } from 'lucide-react';
import { LEAD_SOURCE_TYPES, type LeadSourceItem, type LeadSourceType } from '@propbot/shared';
import {
  useCreateLeadSource,
  useDeleteLeadSource,
  useGenerateKioskToken,
  useImportCsv,
  useLeadSourceEvents,
  useLeadSources,
  useRotateLeadSourceKey,
  useUpdateLeadSource,
} from '../services/omnichannel.service.js';
import { Badge } from '../components/ui/Badge.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { Skeleton } from '../components/common/Skeleton.js';

const TYPE_LABEL: Record<LeadSourceType, string> = {
  generic: 'Any website / API',
  meta_lead_ads: 'Meta Lead Ads',
  google_ads: 'Google Ads lead forms',
  '99acres': '99acres',
  magicbricks: 'MagicBricks',
  housing: 'Housing.com',
};
const TARGETS = ['name', 'phone', 'email', 'budget', 'bhk', 'location', 'purpose', 'timeline', 'utm_source', 'utm_campaign'];
const inputCls = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800 dark:text-white';
const errMsg = (e: unknown, f: string) => (e instanceof Error ? e.message : f);
const endpoint = () => `${typeof window !== 'undefined' ? window.location.origin : ''}/api/public/omni/lead-sources/ingest`;

const KeyBanner: React.FC<{ apiKey: string; onClose: () => void }> = ({ apiKey, onClose }) => {
  const [copied, setCopied] = useState(false);
  const curl = `curl -X POST ${endpoint()} \\\n  -H "x-api-key: ${apiKey}" -H "Content-Type: application/json" \\\n  -d '{"name":"Asha Rao","phone":"+919800000000","email":"asha@example.com"}'`;
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100" role="status">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold">Copy this API key now. It is shown only once.</p>
        <button type="button" aria-label="Dismiss" onClick={onClose} className="cursor-pointer"><X className="h-4 w-4" /></button>
      </div>
      <code className="mt-2 block break-all rounded-lg bg-white/70 p-2 font-mono dark:bg-slate-900/60">{apiKey}</code>
      <pre className="mt-2 overflow-x-auto rounded-lg bg-white/70 p-2 text-[10px] dark:bg-slate-900/60">{curl}</pre>
      <button type="button" onClick={() => void navigator.clipboard?.writeText(apiKey).then(() => setCopied(true))} className="mt-2 inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 font-semibold text-white cursor-pointer"><Copy className="h-3.5 w-3.5" /> {copied ? 'Copied' : 'Copy key'}</button>
    </div>
  );
};

const CreateModal: React.FC<{ onClose: () => void; onCreated: (key: string) => void }> = ({ onClose, onCreated }) => {
  const create = useCreateLeadSource();
  const [name, setName] = useState('');
  const [type, setType] = useState<LeadSourceType>('generic');
  const [rows, setRows] = useState<Array<{ from: string; to: string }>>([]);
  const [partner, setPartner] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const fieldMapping = Object.fromEntries(rows.filter(r => r.from.trim() && r.to).map(r => [r.from.trim(), r.to]));
      const res = await create.mutateAsync({ name, sourceType: type, fieldMapping, attribution: partner ? { utm_agencypartner: partner } : {} });
      onCreated(res.apiKey);
    } catch (err) {
      setError(errMsg(err, 'Could not create the source.'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" role="dialog" aria-modal="true" aria-label="New lead source">
      <form onSubmit={submit} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between"><h2 className="font-serif text-lg font-bold text-slate-900 dark:text-white">New lead source</h2><button type="button" aria-label="Close" onClick={onClose} className="cursor-pointer text-slate-400"><X className="h-4 w-4" /></button></div>
        <label htmlFor="ls-name" className="mt-4 block text-xs font-semibold">Name</label>
        <input id="ls-name" required minLength={2} value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="e.g. Diwali Meta campaign" />
        <label htmlFor="ls-type" className="mt-3 block text-xs font-semibold">Where do the leads come from?</label>
        <select id="ls-type" value={type} onChange={e => setType(e.target.value as LeadSourceType)} className={inputCls}>{LEAD_SOURCE_TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</select>
        <label htmlFor="ls-partner" className="mt-3 block text-xs font-semibold">Agency partner (optional)</label>
        <input id="ls-partner" value={partner} onChange={e => setPartner(e.target.value)} className={inputCls} placeholder="Tagged on every lead from this source" />
        <div className="mt-4 flex items-center justify-between"><span className="text-xs font-semibold">Field mapping</span><button type="button" onClick={() => setRows([...rows, { from: '', to: 'name' }])} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold dark:bg-slate-800 cursor-pointer"><Plus className="h-3 w-3" /> Add</button></div>
        <p className="mt-1 text-[11px] text-slate-500">Common names (name, phone, email, mobile…) are recognised automatically. Map only the unusual ones.</p>
        <div className="mt-2 space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <input aria-label="Incoming field" value={r.from} onChange={e => setRows(rows.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)))} placeholder="their field" className={`${inputCls} col-span-5 mt-0`} />
              <select aria-label="Maps to" value={r.to} onChange={e => setRows(rows.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)))} className={`${inputCls} col-span-6 mt-0`}>{TARGETS.map(t => <option key={t}>{t}</option>)}</select>
              <button type="button" aria-label="Remove mapping" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="col-span-1 text-slate-400 hover:text-rose-600 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
        {error && <p className="mt-3 text-xs text-rose-600" role="alert">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 cursor-pointer">Cancel</button>
          <button type="submit" disabled={create.isPending} className="rounded-xl bg-gradient-to-r from-accent to-accent-hover px-5 py-2 text-xs font-bold text-white disabled:opacity-50 cursor-pointer">{create.isPending ? 'Creating…' : 'Create source'}</button>
        </div>
      </form>
    </div>
  );
};

const SourceCard: React.FC<{ s: LeadSourceItem; onKey: (k: string) => void }> = ({ s, onKey }) => {
  const update = useUpdateLeadSource();
  const rotate = useRotateLeadSourceKey();
  const del = useDeleteLeadSource();
  const imp = useImportCsv();
  const genKiosk = useGenerateKioskToken();
  const [open, setOpen] = useState(false);
  const { data: events } = useLeadSourceEvents(open ? s.id : null);
  const [csv, setCsv] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kioskLink, setKioskLink] = useState<string | null>(null);
  const [kioskCopied, setKioskCopied] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errMsg(e, 'Action failed.'));
    }
  };

  const handleGenKiosk = async () => {
    setError(null);
    try {
      const res = await genKiosk.mutateAsync(s.id);
      const link = `${window.location.origin}/walk-in/${res.token}`;
      setKioskLink(link);
    } catch (e) {
      setError(errMsg(e, 'Could not generate kiosk link.'));
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-serif text-sm font-bold text-slate-900 dark:text-white">{s.name}</h3>
          <p className="text-[11px] text-slate-500">{TYPE_LABEL[s.sourceType]} · key pbls_{s.keyPrefix}_…</p>
        </div>
        <label className="flex items-center gap-1 text-[11px]"><input type="checkbox" checked={s.isActive} onChange={e => void run(() => update.mutateAsync({ id: s.id, input: { isActive: e.target.checked } }))} /> Active</label>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5"><Badge variant="slate" size="sm">{s.totalReceived} received</Badge>{s.lastReceivedAt && <Badge variant="outline" size="sm">Last {new Date(s.lastReceivedAt).toLocaleDateString()}</Badge>}</div>
      {error && <p className="mt-2 text-[11px] text-rose-600" role="alert">{error}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
        <button type="button" onClick={() => setOpen(o => !o)} className="font-bold text-accent cursor-pointer">{open ? 'Hide' : 'Activity & import'}</button>
        <button type="button" onClick={() => window.confirm('Rotating invalidates the current key immediately. Continue?') && void run(async () => onKey((await rotate.mutateAsync(s.id)).apiKey))} className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 cursor-pointer"><KeyRound className="h-3.5 w-3.5" /> New key</button>
        <button type="button" disabled={genKiosk.isPending} onClick={() => void handleGenKiosk()} className="inline-flex items-center gap-1 text-slate-500 hover:text-indigo-600 disabled:opacity-50 cursor-pointer"><QrCode className="h-3.5 w-3.5" /> {genKiosk.isPending ? 'Generating…' : 'Kiosk link'}</button>
        <button type="button" aria-label={`Delete ${s.name}`} onClick={() => window.confirm(`Delete "${s.name}"?`) && void run(() => del.mutateAsync(s.id))} className="ml-auto text-slate-400 hover:text-rose-600 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
      </div>

      {/* Kiosk link banner */}
      {kioskLink && (
        <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs dark:border-indigo-900 dark:bg-indigo-950/30">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="font-semibold text-indigo-800 dark:text-indigo-200 flex items-center gap-1"><QrCode className="h-3.5 w-3.5" /> Walk-in Kiosk Link</span>
            <button type="button" onClick={() => setKioskLink(null)} className="text-indigo-400 hover:text-indigo-700 cursor-pointer"><X className="h-3.5 w-3.5" /></button>
          </div>
          <code className="block break-all rounded-lg bg-white/70 p-2 font-mono text-[10px] text-indigo-900 dark:bg-slate-900/60 dark:text-indigo-200">{kioskLink}</code>
          <p className="mt-1.5 text-[10px] text-indigo-600 dark:text-indigo-400">Add UTM params to track ad source: <code>?utm_source=facebook&amp;utm_campaign=diwali</code></p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => void navigator.clipboard?.writeText(kioskLink).then(() => { setKioskCopied(true); setTimeout(() => setKioskCopied(false), 2000); })} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 font-semibold text-white cursor-pointer"><Copy className="h-3 w-3" /> {kioskCopied ? 'Copied!' : 'Copy link'}</button>
            <a href={kioskLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 px-2.5 py-1.5 font-semibold text-indigo-700 dark:border-indigo-700 dark:text-indigo-300"><ExternalLink className="h-3 w-3" /> Open kiosk</a>
          </div>
        </div>
      )}
      {open && (
        <div className="mt-3 space-y-3">
          <div>
            <p className="text-xs font-semibold">Import a CSV</p>
            <textarea aria-label="CSV text" rows={3} value={csv} onChange={e => setCsv(e.target.value)} placeholder={'name,phone,email\nAsha Rao,+919800000000,asha@example.com'} className={`${inputCls} font-mono`} />
            <input type="file" accept=".csv,text/csv" aria-label="CSV file" className="mt-1 text-[11px]" onChange={e => void e.target.files?.[0]?.text().then(setCsv)} />
            <button type="button" disabled={!csv.trim() || imp.isPending} onClick={() => void run(async () => { const r = await imp.mutateAsync({ id: s.id, csv }); setMsg(`${r.processed} new, ${r.duplicate} duplicates, ${r.rejected + r.failed} skipped of ${r.total}.${r.errors[0] ? ` Row ${r.errors[0].row}: ${r.errors[0].error}` : ''}`); })} className="mt-1 inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 dark:bg-slate-700 cursor-pointer"><Upload className="h-3.5 w-3.5" /> Import</button>
            {msg && <p className="mt-1 text-[11px] text-slate-600" role="status">{msg}</p>}
          </div>
          <div>
            <p className="text-xs font-semibold">Recent activity</p>
            <ul className="mt-1 space-y-1">{(events ?? []).slice(0, 8).map(e => <li key={e.id} className="flex items-center gap-2 text-[11px] text-slate-500"><Badge variant={e.status === 'processed' ? 'mint' : e.status === 'duplicate' ? 'slate' : 'gold'} size="sm">{e.status}</Badge>{new Date(e.createdAt).toLocaleString()}<span className="truncate text-rose-600">{e.error}</span></li>)}{(events ?? []).length === 0 && <li className="text-[11px] text-slate-400">Nothing received yet.</li>}</ul>
          </div>
        </div>
      )}
    </div>
  );
};

export const LeadSourcesPage: React.FC = () => {
  const { data, isLoading, error } = useLeadSources();
  const [creating, setCreating] = useState(false);
  const [key, setKey] = useState<string | null>(null);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Lead sources</h1>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">Pull in leads from Meta and Google ads, property portals, your website or a spreadsheet. Duplicates are merged automatically.</p>
        </div>
        <button type="button" onClick={() => setCreating(true)} className="flex items-center gap-2 self-start rounded-xl bg-gradient-to-r from-accent to-accent-hover px-4 py-2.5 text-xs font-bold text-white cursor-pointer sm:self-auto"><Plus className="h-4 w-4" /> New source</button>
      </div>
      {key && <KeyBanner apiKey={key} onClose={() => setKey(null)} />}
      {error && <p className="text-sm text-rose-600" role="alert">{error.message}</p>}
      {isLoading ? <Skeleton className="h-40 w-full" /> : (data ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700"><EmptyState icon={<Radio className="h-7 w-7" />} title="No lead sources yet" description="Create one to get an API key and start receiving leads." actionLabel="New source" onAction={() => setCreating(true)} /></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{(data ?? []).map(s => <SourceCard key={s.id} s={s} onKey={setKey} />)}</div>
      )}
      {creating && <CreateModal onClose={() => setCreating(false)} onCreated={k => { setCreating(false); setKey(k); }} />}
    </div>
  );
};
