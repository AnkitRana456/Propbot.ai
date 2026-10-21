import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Coins, Copy, Landmark, Plus, Receipt, Undo2, X } from 'lucide-react';
import type { PaymentOrderItem } from '@propbot/shared';
import {
  useAutoTopup,
  useBillingProfile,
  useCancelPayment,
  useCreatePaymentLink,
  useCreditHistory,
  useCredits,
  usePaymentOrders,
  useRefundPayment,
  useSaveBillingProfile,
  useSimulatePaid,
  useTopup,
} from '../services/payments.service.js';
import { useLeads } from '../services/leads.service.js';
import { Badge } from '../components/ui/Badge.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { Skeleton } from '../components/common/Skeleton.js';

type Tab = 'payments' | 'credits' | 'details';
const inputCls = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800 dark:text-white';
const btn = 'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-40 cursor-pointer';
const card = 'rounded-2xl border border-slate-200/90 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900';
const errMsg = (e: unknown, f: string) => (e instanceof Error ? e.message : f);
const inr = (minor: number) => `₹${(minor / 100).toLocaleString('en-IN')}`;
const STATUS_VARIANT: Record<string, 'mint' | 'gold' | 'slate' | 'blue'> = { paid: 'mint', pending: 'blue', created: 'blue', failed: 'gold', expired: 'slate', refunded: 'slate', partially_refunded: 'gold' };

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

const OrderRow: React.FC<{ o: PaymentOrderItem }> = ({ o }) => {
  const cancel = useCancelPayment();
  const refund = useRefundPayment();
  const simulate = useSimulatePaid();
  const { error, run } = useRun();
  const [refunding, setRefunding] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const left = o.amountMinor - o.refundedMinor;
  const open = o.status === 'pending' || o.status === 'created';
  return (
    <li className={card}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-slate-900 dark:text-white">{o.kind === 'credit_topup' ? 'Credit top-up' : o.leadName ?? 'Booking token'}</span>
        <span className="font-serif text-sm font-bold">{inr(o.amountMinor)}</span>
        <Badge variant={STATUS_VARIANT[o.status] ?? 'slate'} size="sm">{o.status.replace('_', ' ')}</Badge>
        {o.unitNumber && <span className="text-slate-500">Unit {o.unitNumber}{o.projectName ? ` · ${o.projectName}` : ''}</span>}
        {o.refundedMinor > 0 && <span className="text-slate-500">refunded {inr(o.refundedMinor)}</span>}
        <span className="ml-auto text-[11px] text-slate-400">{new Date(o.createdAt).toLocaleString()}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
        {open && o.paymentLinkUrl && (
          <>
            <button type="button" onClick={() => void navigator.clipboard?.writeText(o.paymentLinkUrl!)} className="inline-flex items-center gap-1 font-semibold text-accent cursor-pointer"><Copy className="h-3.5 w-3.5" /> Copy payment link</button>
            {o.provider === 'manual' && <button type="button" onClick={() => void run(() => simulate.mutateAsync(o.id))} className="text-slate-500 cursor-pointer">Mark paid (test mode)</button>}
            <button type="button" onClick={() => window.confirm('Cancel this payment link?') && void run(() => cancel.mutateAsync(o.id))} className="text-slate-500 hover:text-rose-600 cursor-pointer">Cancel link</button>
          </>
        )}
        {o.receiptNo && <a href={`/api/payments/orders/${o.id}/receipt`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-accent"><Receipt className="h-3.5 w-3.5" /> Receipt {o.receiptNo}</a>}
        {o.kind === 'booking_token' && (o.status === 'paid' || o.status === 'partially_refunded') && <button type="button" onClick={() => setRefunding(r => !r)} className="inline-flex items-center gap-1 text-slate-500 hover:text-rose-600 cursor-pointer"><Undo2 className="h-3.5 w-3.5" /> Refund</button>}
      </div>
      {refunding && (
        <form onSubmit={e => { e.preventDefault(); void run(async () => { await refund.mutateAsync({ id: o.id, input: { reason, ...(amount ? { amountInr: Number(amount) } : {}) } }); setRefunding(false); setReason(''); setAmount(''); }); }} className="mt-2 flex flex-wrap gap-2">
          <input aria-label="Refund amount in rupees" type="number" min={1} max={left / 100} value={amount} onChange={e => setAmount(e.target.value)} placeholder={`Up to ${inr(left)} (blank = all)`} className={`${inputCls} w-48`} />
          <input aria-label="Refund reason" required minLength={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason" className={`${inputCls} min-w-0 flex-1`} />
          <button type="submit" disabled={refund.isPending} className={`${btn} bg-rose-600 text-white`}>Refund</button>
        </form>
      )}
      <Err error={error} />
    </li>
  );
};

const PaymentsTab: React.FC = () => {
  const { data, isLoading } = usePaymentOrders('booking_token');
  const create = useCreatePaymentLink();
  const { error, run } = useRun();
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const { data: leads } = useLeads({ search, limit: 5 });
  const [leadId, setLeadId] = useState('');
  const [amount, setAmount] = useState(50000);
  const [note, setNote] = useState('');
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3"><p className="text-xs text-slate-500">Send a booking-token payment link in chat or WhatsApp. Receipts are numbered automatically and carry the project&apos;s RERA number.</p><button type="button" onClick={() => setAdding(a => !a)} className={`${btn} bg-accent text-white`}><Plus className="h-4 w-4" /> Payment link</button></div>
      {adding && (
        <form onSubmit={e => { e.preventDefault(); void run(async () => { await create.mutateAsync({ leadId, amountInr: amount, expiresInHours: 24, ...(note ? { note } : {}) }); setAdding(false); setLeadId(''); setSearch(''); }); }} className={`${card} grid gap-3 sm:grid-cols-2`}>
          <div className="sm:col-span-2">
            <label htmlFor="pl-search" className="text-xs font-semibold">Buyer</label>
            <input id="pl-search" value={search} onChange={e => { setSearch(e.target.value); setLeadId(''); }} placeholder="Search a lead by name or phone" className={`${inputCls} mt-1 w-full`} />
            {search && !leadId && <ul className="mt-1 space-y-1">{(leads?.items ?? []).map(l => <li key={l.id}><button type="button" onClick={() => { setLeadId(l.id); setSearch(l.name); }} className="text-xs font-semibold text-accent cursor-pointer">{l.name} · {l.phone}</button></li>)}</ul>}
          </div>
          <div><label htmlFor="pl-amt" className="text-xs font-semibold">Token amount (₹)</label><input id="pl-amt" type="number" min={1000} max={1000000} step={1000} value={amount} onChange={e => setAmount(Number(e.target.value))} className={`${inputCls} mt-1 w-full`} /></div>
          <div><label htmlFor="pl-note" className="text-xs font-semibold">Note (optional)</label><input id="pl-note" maxLength={200} value={note} onChange={e => setNote(e.target.value)} className={`${inputCls} mt-1 w-full`} /></div>
          <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={() => setAdding(false)} className={`${btn} text-slate-600`}><X className="h-3.5 w-3.5" /> Cancel</button><button type="submit" disabled={!leadId || create.isPending} className={`${btn} bg-accent text-white`}>Create link</button></div>
        </form>
      )}
      <Err error={error} />
      {isLoading ? <Skeleton className="h-24 w-full" /> : (data ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700"><EmptyState icon={<Landmark className="h-7 w-7" />} title="No payments yet" description="Create a booking-token link for a serious buyer." /></div>
      ) : (
        <ul className="space-y-2">{(data ?? []).map(o => <OrderRow key={o.id} o={o} />)}</ul>
      )}
    </div>
  );
};

const CreditsTab: React.FC = () => {
  const { data, isLoading } = useCredits();
  const { data: history } = useCreditHistory();
  const { data: orders } = usePaymentOrders('credit_topup');
  const topup = useTopup();
  const auto = useAutoTopup();
  const { error, run } = useRun();
  if (isLoading || !data) return <Skeleton className="h-40 w-full" />;
  const openTopup = (orders ?? []).find(o => o.status === 'pending');
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className={card}><p className="text-[11px] text-slate-500">Prepaid credits</p><p className={`font-serif text-3xl font-bold ${data.lowBalance ? 'text-amber-600' : 'text-slate-900 dark:text-white'}`}>{Math.round(data.balance).toLocaleString('en-IN')}</p><p className="text-[10px] text-slate-400">1 credit = ₹1 of AI replies, calls and messages</p></div>
        {data.packs.map(p => (
          <div key={p.id} className={card}>
            <p className="text-sm font-bold">{p.label}</p><p className="text-xs text-slate-500">₹{p.priceInr.toLocaleString('en-IN')}</p>
            <button type="button" disabled={topup.isPending} onClick={() => void run(() => topup.mutateAsync(p.id))} className={`${btn} mt-2 bg-accent text-white`}><Coins className="h-3.5 w-3.5" /> Buy</button>
          </div>
        ))}
      </div>
      {openTopup?.paymentLinkUrl && <p className="rounded-xl bg-blue-50 p-3 text-xs text-blue-800 dark:bg-blue-950/30 dark:text-blue-200" role="status">Complete your top-up of {inr(openTopup.amountMinor)}: <a className="font-bold underline" href={openTopup.paymentLinkUrl}>open the payment page</a></p>}
      <Err error={error} />
      <label className="flex flex-wrap items-center gap-2 text-xs"><input type="checkbox" checked={data.autoTopup.enabled} onChange={e => void run(() => auto.mutateAsync({ enabled: e.target.checked, threshold: data.autoTopup.threshold, packId: data.autoTopup.packId as never }))} /> Remind me to top up when credits fall below <input aria-label="Low balance threshold" type="number" min={0} defaultValue={data.autoTopup.threshold} onBlur={e => void run(() => auto.mutateAsync({ enabled: data.autoTopup.enabled, threshold: Number(e.target.value) || 0, packId: data.autoTopup.packId as never }))} className={`${inputCls} w-24`} /></label>
      <section><h3 className="text-xs font-bold">History</h3><ul className="mt-1 space-y-1 text-xs">{(history ?? []).slice(0, 12).map(t => <li key={t.id} className="flex gap-3 text-slate-600 dark:text-slate-300"><span className={`w-20 text-right font-semibold ${t.delta >= 0 ? 'text-emerald-600' : 'text-slate-700 dark:text-slate-200'}`}>{t.delta >= 0 ? '+' : ''}{t.delta.toFixed(1)}</span><span className="w-16">{t.reason}</span><span className="text-slate-400">{new Date(t.createdAt).toLocaleString()}</span></li>)}{(history ?? []).length === 0 && <li className="text-slate-400">No credit activity yet.</li>}</ul></section>
    </div>
  );
};

const DetailsTab: React.FC = () => {
  const { data, isLoading } = useBillingProfile();
  const save = useSaveBillingProfile();
  const { error, run } = useRun();
  const [f, setF] = useState<{ legalName: string; gstin: string; pan: string; email: string; city: string; loaded: boolean }>({ legalName: '', gstin: '', pan: '', email: '', city: '', loaded: false });
  const [saved, setSaved] = useState(false);
  if (isLoading || !data) return <Skeleton className="h-40 w-full" />;
  if (!f.loaded) setF({ legalName: data.legalName ?? '', gstin: data.gstin ?? '', pan: data.pan ?? '', email: data.billingEmail ?? '', city: data.address.city ?? '', loaded: true });
  return (
    <form onSubmit={e => { e.preventDefault(); setSaved(false); void run(async () => { await save.mutateAsync({ legalName: f.legalName, gstin: f.gstin, pan: f.pan, billingEmail: f.email, stateCode: '', address: { line1: '', city: f.city, state: '', pincode: '' } }); setSaved(true); }); }} className={`${card} grid max-w-2xl gap-3 sm:grid-cols-2`}>
      <p className="text-xs text-slate-500 sm:col-span-2">These details appear on your invoices. With a GSTIN we split GST correctly (CGST + SGST within the seller&apos;s state, IGST otherwise). Plan prices include 18% GST.</p>
      <div className="sm:col-span-2"><label htmlFor="bp-name" className="text-xs font-semibold">Legal name</label><input id="bp-name" required minLength={2} value={f.legalName} onChange={e => setF({ ...f, legalName: e.target.value })} className={`${inputCls} mt-1 w-full`} /></div>
      <div><label htmlFor="bp-gst" className="text-xs font-semibold">GSTIN</label><input id="bp-gst" value={f.gstin} onChange={e => setF({ ...f, gstin: e.target.value.toUpperCase() })} maxLength={15} placeholder="29ABCDE1234F1Z5" className={`${inputCls} mt-1 w-full font-mono`} /></div>
      <div><label htmlFor="bp-pan" className="text-xs font-semibold">PAN</label><input id="bp-pan" value={f.pan} onChange={e => setF({ ...f, pan: e.target.value.toUpperCase() })} maxLength={10} className={`${inputCls} mt-1 w-full font-mono`} /></div>
      <div><label htmlFor="bp-mail" className="text-xs font-semibold">Billing e-mail</label><input id="bp-mail" type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} className={`${inputCls} mt-1 w-full`} /></div>
      <div><label htmlFor="bp-city" className="text-xs font-semibold">City</label><input id="bp-city" value={f.city} onChange={e => setF({ ...f, city: e.target.value })} className={`${inputCls} mt-1 w-full`} /></div>
      <div className="flex items-center gap-3 sm:col-span-2"><button type="submit" disabled={save.isPending} className={`${btn} bg-accent text-white`}>Save details</button>{saved && <span className="text-xs text-emerald-600" role="status">Saved.</span>}<Err error={error} /></div>
    </form>
  );
};

export const BillingPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('payments');
  const tabs: Array<[Tab, string]> = [['payments', 'Booking payments'], ['credits', 'Credits'], ['details', 'Billing details']];
  return (
    <div className="space-y-6 pb-12">
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <h1 className="font-serif text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Payments &amp; credits</h1>
        <p className="mt-1 text-xs text-slate-500 sm:text-sm">Collect booking tokens, manage prepaid credits and your GST details. Plans and invoices are on the <Link to="/subscription" className="font-semibold text-accent">Subscription</Link> page.</p>
      </div>
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800" role="tablist">
        {tabs.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} type="button" onClick={() => setTab(id)} className={`border-b-2 px-4 py-2 text-xs font-semibold cursor-pointer ${tab === id ? 'border-accent text-accent' : 'border-transparent text-slate-500'}`}>{label}</button>)}
      </div>
      {tab === 'payments' ? <PaymentsTab /> : tab === 'credits' ? <CreditsTab /> : <DetailsTab />}
    </div>
  );
};
