import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarCheck, FileText, MessageSquare, PhoneCall, Smile, StickyNote, Activity } from 'lucide-react';
import type { TimelineEntry } from '@propbot/shared';
import { useContact360 } from '../services/intelligence.service.js';
import { Badge } from '../components/ui/Badge.js';
import { Skeleton } from '../components/common/Skeleton.js';

const KIND_ICON: Record<TimelineEntry['kind'], React.ReactNode> = {
  message: <MessageSquare className="h-3.5 w-3.5" />,
  call: <PhoneCall className="h-3.5 w-3.5" />,
  visit: <CalendarCheck className="h-3.5 w-3.5" />,
  activity: <Activity className="h-3.5 w-3.5" />,
  note: <StickyNote className="h-3.5 w-3.5" />,
  survey: <Smile className="h-3.5 w-3.5" />,
};
const KIND_TINT: Record<TimelineEntry['kind'], string> = {
  message: 'bg-blue-100 text-blue-700',
  call: 'bg-emerald-100 text-emerald-700',
  visit: 'bg-amber-100 text-amber-700',
  activity: 'bg-slate-100 text-slate-700',
  note: 'bg-yellow-100 text-yellow-700',
  survey: 'bg-pink-100 text-pink-700',
};

export const Contact360Page: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useContact360(id);
  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (error || !data) return <p className="p-6 text-sm text-rose-600" role="alert">{error?.message ?? 'Contact not found.'}</p>;
  const { contact, lead } = data;

  return (
    <div className="space-y-6 pb-12">
      <div>
        <Link to="/contacts" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"><ArrowLeft className="h-3.5 w-3.5" /> Contacts</Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="font-serif text-2xl font-bold text-slate-900 dark:text-white">{contact.name}</h1>
          {lead && <Badge variant="blue" size="sm">{lead.status.replace(/_/g, ' ')}</Badge>}
          {lead && <Badge variant={lead.intentLabel === 'hot' ? 'gold' : 'slate'} size="sm">{lead.intentLabel} · {lead.intentScore}</Badge>}
          {data.tags.map(t => <span key={t.id} className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: t.color }}>{t.name}</span>)}
        </div>
        <p className="text-xs text-slate-500">{[contact.phone, contact.email].filter(Boolean).join(' · ')}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([['Conversations', data.stats.conversations], ['Messages', data.stats.messages], ['Calls', data.stats.calls], ['Site visits', data.stats.visits]] as const).map(([l, v]) => (
          <div key={l} className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900"><p className="text-[11px] text-slate-500">{l}</p><p className="font-serif text-2xl font-bold">{v}</p></div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-1" aria-label="Profile">
          {lead && Object.keys({ ...lead.buyerDna, ...lead.attributes }).length > 0 && (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-xs font-bold text-slate-900 dark:text-white">What we know</h2>
              <dl className="mt-2 space-y-1 text-xs">{Object.entries({ ...lead.buyerDna, ...lead.attributes }).filter(([, v]) => v !== null && v !== '' && typeof v !== 'object').map(([k, v]) => <div key={k} className="flex justify-between gap-2"><dt className="text-slate-500">{k.replace(/_/g, ' ')}</dt><dd className="font-medium text-slate-800 dark:text-slate-100">{String(v)}</dd></div>)}</dl>
            </div>
          )}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <h2 className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white"><FileText className="h-3.5 w-3.5" /> AI summaries</h2>
            <ul className="mt-2 space-y-2 text-xs">{data.insights.map(i => <li key={i.conversationId} className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800">{i.summary}<span className="mt-1 flex flex-wrap gap-1">{i.labels.map(l => <Badge key={l} variant="outline" size="sm">{l.replace(/_/g, ' ')}</Badge>)}{i.sentiment && <Badge variant={i.sentiment === 'negative' ? 'gold' : 'mint'} size="sm">{i.sentiment}</Badge>}</span></li>)}{data.insights.length === 0 && <li className="text-slate-400">No summaries yet. Open a conversation in the inbox to generate one.</li>}</ul>
          </div>
        </section>

        <section className="lg:col-span-2" aria-label="Timeline">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-xs font-bold text-slate-900 dark:text-white">Timeline</h2>
            <ol className="mt-3 space-y-3">
              {data.timeline.map((t, i) => (
                <li key={`${t.kind}-${t.refId}-${i}`} className="flex gap-3 text-xs">
                  <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${KIND_TINT[t.kind]}`}>{KIND_ICON[t.kind]}</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white">{t.title}{t.channel ? <span className="ml-1 font-normal text-slate-400">· {t.channel}</span> : null}</p>
                    {t.detail && <p className="text-slate-600 dark:text-slate-300">{t.detail}</p>}
                    <p className="text-[10px] text-slate-400">{new Date(t.at).toLocaleString()}</p>
                  </div>
                </li>
              ))}
              {data.timeline.length === 0 && <li className="text-xs text-slate-400">Nothing has happened with this contact yet.</li>}
            </ol>
          </div>
        </section>
      </div>
    </div>
  );
};
