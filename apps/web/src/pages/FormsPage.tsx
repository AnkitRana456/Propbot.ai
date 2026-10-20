import React, { useState } from 'react';
import { ClipboardList, Plus, Trash2, ArrowUp, ArrowDown, Lock, X } from 'lucide-react';
import type { FormFieldInput, FormFieldType, FormItem, FormPurpose } from '@propbot/shared';
import { useDeleteForm, useForms, useSaveForm } from '../services/agents.service.js';
import { Badge } from '../components/ui/Badge.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { Skeleton } from '../components/common/Skeleton.js';

const FIELD_TYPES: Array<{ id: FormFieldType; label: string }> = [
  { id: 'text', label: 'Short text' },
  { id: 'longtext', label: 'Long text' },
  { id: 'number', label: 'Number' },
  { id: 'currency', label: 'Amount (₹)' },
  { id: 'select', label: 'Single choice' },
  { id: 'multiselect', label: 'Multiple choice' },
  { id: 'boolean', label: 'Yes / No' },
  { id: 'date', label: 'Date' },
  { id: 'phone', label: 'Phone' },
  { id: 'email', label: 'E-mail' },
  { id: 'url', label: 'Link' },
];
const PURPOSES: Array<{ id: FormPurpose; label: string }> = [
  { id: 'lead_attributes', label: 'Lead attributes' },
  { id: 'agent_input', label: 'Agent input' },
  { id: 'survey', label: 'Survey' },
  { id: 'task', label: 'Task' },
];

const inputCls = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800 dark:text-white';
const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);

const FormEditor: React.FC<{ form: FormItem | null; onClose: () => void }> = ({ form, onClose }) => {
  const save = useSaveForm();
  const [name, setName] = useState(form?.name ?? '');
  const [description, setDescription] = useState(form?.description ?? '');
  const [purpose, setPurpose] = useState<FormPurpose>(form?.purpose ?? 'lead_attributes');
  const [fields, setFields] = useState<FormFieldInput[]>(
    form?.fields.map(({ id: _id, ...f }) => f) ?? [],
  );
  const [error, setError] = useState<string | null>(null);

  const patch = (i: number, p: Partial<FormFieldInput>) => setFields(fields.map((f, idx) => (idx === i ? { ...f, ...p } : f)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    const a = next[i];
    const b = next[j];
    if (!a || !b) return;
    next[i] = b;
    next[j] = a;
    setFields(next);
  };
  const add = () =>
    setFields([...fields, { key: '', label: '', type: 'text', required: false, options: [], validation: {}, collectInChat: true, position: fields.length }]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const keys = fields.map(f => f.key);
    if (new Set(keys).size !== keys.length) return setError('Each field needs a unique key.');
    const ordered = fields.map((f, position) => ({ ...f, position }));
    try {
      if (form) await save.mutateAsync({ id: form.id, update: { name, description: description || null, purpose, fields: ordered } });
      else await save.mutateAsync({ create: { key: slug(name) || 'form', name, description: description || null, purpose, fields: ordered } });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the form.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" role="dialog" aria-modal="true" aria-label="Form editor">
      <form onSubmit={submit} className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between p-5 pb-2">
          <h2 className="font-serif text-lg font-bold text-slate-900 dark:text-white">{form ? 'Edit form' : 'New form'}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 overflow-y-auto px-5 pb-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="form-name" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Name</label>
              <input id="form-name" required minLength={2} maxLength={150} value={name} onChange={e => setName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label htmlFor="form-purpose" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Purpose</label>
              <select id="form-purpose" value={purpose} onChange={e => setPurpose(e.target.value as FormPurpose)} className={inputCls}>
                {PURPOSES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="form-desc" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Description</label>
            <input id="form-desc" maxLength={1000} value={description} onChange={e => setDescription(e.target.value)} className={inputCls} />
          </div>

          <div className="space-y-2">
            {fields.map((f, i) => (
              <div key={i} className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <div className="grid grid-cols-12 items-center gap-2">
                  <input aria-label="Field label" placeholder="Label (what the visitor sees)" required value={f.label} onChange={e => patch(i, { label: e.target.value, key: f.key || slug(e.target.value) })} className={`${inputCls} col-span-5 mt-0`} />
                  <input aria-label="Field key" placeholder="key" required value={f.key} onChange={e => patch(i, { key: slug(e.target.value) })} className={`${inputCls} col-span-3 mt-0 font-mono`} />
                  <select aria-label="Field type" value={f.type} onChange={e => patch(i, { type: e.target.value as FormFieldType })} className={`${inputCls} col-span-3 mt-0`}>
                    {FIELD_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                  <div className="col-span-1 flex justify-end gap-0.5">
                    <button type="button" aria-label="Move up" onClick={() => move(i, -1)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label="Move down" onClick={() => move(i, 1)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><ArrowDown className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                {(f.type === 'select' || f.type === 'multiselect') && (
                  <input
                    aria-label="Options, comma separated"
                    placeholder="Options, comma separated"
                    value={f.options.join(', ')}
                    onChange={e => patch(i, { options: e.target.value.split(',').map(o => o.trim()).filter(Boolean) })}
                    className={inputCls}
                  />
                )}
                <input aria-label="How the assistant should ask" placeholder="How the assistant should ask (optional)" maxLength={500} value={f.aiHint ?? ''} onChange={e => patch(i, { aiHint: e.target.value })} className={inputCls} />
                <div className="flex items-center gap-4 text-[11px] text-slate-600 dark:text-slate-300">
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={f.required} onChange={e => patch(i, { required: e.target.checked })} /> Required</label>
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={f.collectInChat} onChange={e => patch(i, { collectInChat: e.target.checked })} /> Ask in chat</label>
                  <button type="button" aria-label="Remove field" onClick={() => setFields(fields.filter((_, idx) => idx !== i))} className="ml-auto text-slate-400 hover:text-rose-600 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
            {fields.length === 0 && <p className="text-xs text-slate-400">No fields yet.</p>}
            <button type="button" onClick={add} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 cursor-pointer">
              <Plus className="h-3.5 w-3.5" /> Add field
            </button>
          </div>
        </div>
        {error && <p className="px-5 pt-2 text-xs text-rose-600" role="alert">{error}</p>}
        <div className="flex justify-end gap-2 p-5">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">Cancel</button>
          <button type="submit" disabled={save.isPending} className="rounded-xl bg-gradient-to-r from-[#B84A22] to-[#c75528] px-5 py-2 text-xs font-bold text-white disabled:opacity-50 cursor-pointer">
            {save.isPending ? 'Saving…' : 'Save form'}
          </button>
        </div>
      </form>
    </div>
  );
};

export const FormsPage: React.FC = () => {
  const { data: forms, isLoading, error } = useForms();
  const del = useDeleteForm();
  const [editing, setEditing] = useState<FormItem | 'new' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const remove = async (f: FormItem) => {
    if (!window.confirm(`Delete the form "${f.name}"?`)) return;
    setActionError(null);
    try {
      await del.mutateAsync(f.id);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not delete the form.');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Forms</h1>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">Define the details your agents collect (budget, BHK, timeline…). Answers are saved on the lead.</p>
        </div>
        <button type="button" onClick={() => setEditing('new')} className="flex items-center gap-2 self-start rounded-xl bg-gradient-to-r from-[#B84A22] to-[#c75528] px-4 py-2.5 text-xs font-bold text-white cursor-pointer sm:self-auto">
          <Plus className="h-4 w-4" /> New form
        </button>
      </div>

      {(error || actionError) && <p className="text-sm text-rose-600" role="alert">{actionError ?? error?.message}</p>}

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !forms || forms.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
          <EmptyState icon={<ClipboardList className="h-7 w-7" />} title="No forms yet" description="Create a form and attach it to an agent." actionLabel="New form" onAction={() => setEditing('new')} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {forms.map(f => (
            <div key={f.id} className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-2">
                <h3 className="truncate font-serif text-sm font-bold text-slate-900 dark:text-white">{f.name}</h3>
                {f.isSystem && <Badge variant="slate" size="sm" icon={<Lock className="h-3 w-3" />}>Starter</Badge>}
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-slate-500">{f.description || 'No description.'}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge variant="outline" size="sm">{f.fields.length} fields</Badge>
                <Badge variant="slate" size="sm">{PURPOSES.find(p => p.id === f.purpose)?.label}</Badge>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                <button type="button" onClick={() => setEditing(f)} className="text-xs font-bold text-[#B84A22] hover:underline cursor-pointer">Edit</button>
                {!f.isSystem && (
                  <button type="button" aria-label={`Delete ${f.name}`} onClick={() => void remove(f)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && <FormEditor form={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
};
