import React, { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, Variable, Gauge, BookOpen } from 'lucide-react';
import {
  VARIABLE_SOURCES,
  type AgentCondition,
  type AgentVariable,
  type AgentVersionContent,
  type ConditionOperator,
  type FormItem,
  type ModelDefinition,
} from '@propbot/shared';
import { useChatbots } from '../../services/chatbots.service.js';
import { knowledgeService } from '../../services/knowledge.service.js';
import { useKnowledgeReferences, useSaveKnowledgeReference } from '../../services/agents.service.js';

type Tab = 'behaviour' | 'model' | 'knowledge';

const inputCls =
  'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/30 dark:border-slate-800 dark:bg-slate-800 dark:text-white';
const labelCls = 'text-xs font-semibold text-slate-700 dark:text-slate-300';
const hintCls = 'mt-1 text-[11px] text-slate-500';

const OPERATORS: Array<{ id: ConditionOperator; label: string }> = [
  { id: 'equals', label: 'equals' },
  { id: 'not_equals', label: 'does not equal' },
  { id: 'contains', label: 'contains' },
  { id: 'not_contains', label: 'does not contain' },
  { id: 'greater_than', label: 'is greater than' },
  { id: 'less_than', label: 'is less than' },
  { id: 'is_set', label: 'is set' },
  { id: 'is_empty', label: 'is empty' },
];

const SOURCE_LABELS: Record<string, string> = {
  static: 'Fixed value',
  'lead.name': 'Lead name',
  'lead.phone': 'Lead phone',
  'lead.email': 'Lead e-mail',
  'lead.status': 'Lead stage',
  'lead.source': 'Lead source',
  'project.name': 'Project name',
  'project.location': 'Project location',
  'chatbot.name': 'Chatbot name',
  'company.name': 'Company name',
  'visitor.language': 'Visitor language',
};

const PROMPT_SECTIONS: Array<{ key: keyof AgentVersionContent['prompt']; label: string; hint: string; rows: number; required?: boolean }> = [
  { key: 'jobDescription', label: 'Job description', hint: 'What this agent does and for whom. Required to publish.', rows: 4, required: true },
  { key: 'character', label: 'Character', hint: 'Personality and persona.', rows: 2 },
  { key: 'informationToCollect', label: 'Information to collect', hint: 'Details to learn during the chat (the data form below adds a structured list).', rows: 3 },
  { key: 'tone', label: 'Tone', hint: 'How it should sound.', rows: 2 },
  { key: 'style', label: 'Style & language', hint: 'Formatting, vocabulary, currency notation.', rows: 2 },
  { key: 'extra', label: 'Additional instructions', hint: 'Anything else, e.g. escalation rules or things never to promise.', rows: 3 },
];

interface Props {
  content: AgentVersionContent;
  onChange: (next: AgentVersionContent) => void;
  forms: FormItem[];
  models: ModelDefinition[];
}

export const AgentEditor: React.FC<Props> = ({ content, onChange, forms, models }) => {
  const [tab, setTab] = useState<Tab>('behaviour');
  const set = <K extends keyof AgentVersionContent>(key: K, value: AgentVersionContent[K]) => onChange({ ...content, [key]: value });
  const form = forms.find(f => f.id === content.formId);

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: 'behaviour', label: 'Behaviour', icon: <Variable className="h-3.5 w-3.5" /> },
    { id: 'model', label: 'Model & rules', icon: <Gauge className="h-3.5 w-3.5" /> },
    { id: 'knowledge', label: 'Knowledge & data', icon: <BookOpen className="h-3.5 w-3.5" /> },
  ];

  return (
    <div>
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800" role="tablist">
        {tabs.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold cursor-pointer ${
              tab === t.id ? 'border-accent text-accent' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="pt-4">
        {tab === 'behaviour' && <BehaviourTab content={content} set={set} form={form} />}
        {tab === 'model' && <ModelTab content={content} set={set} models={models} />}
        {tab === 'knowledge' && <KnowledgeTab content={content} set={set} forms={forms} />}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------- behaviour
type SetFn = <K extends keyof AgentVersionContent>(key: K, value: AgentVersionContent[K]) => void;

const BehaviourTab: React.FC<{ content: AgentVersionContent; set: SetFn; form?: FormItem }> = ({ content, set, form }) => {
  const refs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const varKeys = content.variables.map(v => v.key).filter(Boolean);

  const updatePrompt = (key: keyof AgentVersionContent['prompt'], value: string) => set('prompt', { ...content.prompt, [key]: value });
  const insertVariable = (key: keyof AgentVersionContent['prompt'], variable: string) => {
    const el = refs.current[key];
    const current = content.prompt[key];
    const token = `{{${variable}}}`;
    if (el && typeof el.selectionStart === 'number') {
      const next = current.slice(0, el.selectionStart) + token + current.slice(el.selectionEnd);
      updatePrompt(key, next);
    } else {
      updatePrompt(key, current + token);
    }
  };

  const attributeSources = (form?.fields ?? []).map(f => ({ id: `attribute:${f.key}`, label: `Collected: ${f.label}` }));
  const sourceOptions = [
    ...VARIABLE_SOURCES.map(s => ({ id: s as string, label: SOURCE_LABELS[s] ?? s })),
    ...attributeSources,
  ];

  const updateVar = (i: number, patch: Partial<AgentVariable>) =>
    set('variables', content.variables.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  const updateCond = (i: number, patch: Partial<AgentCondition>) =>
    set('conditions', content.conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  return (
    <div className="space-y-5">
      {PROMPT_SECTIONS.map(s => (
        <div key={s.key}>
          <div className="flex items-center justify-between">
            <label className={labelCls} htmlFor={`prompt-${s.key}`}>
              {s.label}
              {s.required && <span className="text-rose-600"> *</span>}
            </label>
            {varKeys.length > 0 && (
              <select
                aria-label={`Insert variable into ${s.label}`}
                value=""
                onChange={e => e.target.value && insertVariable(s.key, e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
              >
                <option value="">Insert variable…</option>
                {varKeys.map(k => (
                  <option key={k} value={k}>{`{{${k}}}`}</option>
                ))}
              </select>
            )}
          </div>
          <textarea
            id={`prompt-${s.key}`}
            ref={el => {
              refs.current[s.key] = el;
            }}
            rows={s.rows}
            value={content.prompt[s.key]}
            maxLength={4000}
            onChange={e => updatePrompt(s.key, e.target.value)}
            className={inputCls}
          />
          <p className={hintCls}>{s.hint}</p>
        </div>
      ))}

      <section aria-labelledby="vars-heading">
        <div className="flex items-center justify-between">
          <h3 id="vars-heading" className="text-xs font-bold text-slate-900 dark:text-white">Variables</h3>
          <button
            type="button"
            onClick={() => set('variables', [...content.variables, { key: '', label: '', defaultValue: '', source: 'static' }])}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <Plus className="h-3 w-3" /> Add variable
          </button>
        </div>
        <p className={hintCls}>Use them as {'{{key}}'} in any text above. Values come from the lead, project or company; the default is used when unknown.</p>
        <div className="mt-2 space-y-2">
          {content.variables.map((v, i) => (
            <div key={i} className="grid grid-cols-12 items-center gap-2 rounded-xl border border-slate-200 p-2 dark:border-slate-800">
              <input aria-label="Variable key" className={`${inputCls} col-span-3 mt-0 font-mono`} placeholder="key" value={v.key} onChange={e => updateVar(i, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} />
              <select aria-label="Variable source" className={`${inputCls} col-span-4 mt-0`} value={v.source} onChange={e => updateVar(i, { source: e.target.value })}>
                {sourceOptions.map(o => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
              <input aria-label="Default value" className={`${inputCls} col-span-4 mt-0`} placeholder="Default value" value={v.defaultValue} onChange={e => updateVar(i, { defaultValue: e.target.value })} />
              <button type="button" aria-label="Remove variable" onClick={() => set('variables', content.variables.filter((_, idx) => idx !== i))} className="col-span-1 flex justify-center text-slate-400 hover:text-rose-600 cursor-pointer">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {content.variables.length === 0 && <p className={hintCls}>No variables yet.</p>}
        </div>
      </section>

      <section aria-labelledby="cond-heading">
        <div className="flex items-center justify-between">
          <h3 id="cond-heading" className="text-xs font-bold text-slate-900 dark:text-white">Conditional instructions</h3>
          <button
            type="button"
            onClick={() => set('conditions', [...content.conditions, { id: `c${Date.now().toString(36)}`, field: 'visitor.message', operator: 'contains', value: '', appendPrompt: '' }])}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <Plus className="h-3 w-3" /> Add condition
          </button>
        </div>
        <p className={hintCls}>When the condition is true, the extra instruction is added to the prompt for that message.</p>
        <div className="mt-2 space-y-2">
          {content.conditions.map((c, i) => (
            <div key={c.id} className="space-y-2 rounded-xl border border-slate-200 p-2 dark:border-slate-800">
              <div className="grid grid-cols-12 items-center gap-2">
                <select aria-label="Condition field" className={`${inputCls} col-span-4 mt-0`} value={c.field} onChange={e => updateCond(i, { field: e.target.value })}>
                  <option value="visitor.message">Visitor message</option>
                  {varKeys.map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
                <select aria-label="Condition operator" className={`${inputCls} col-span-3 mt-0`} value={c.operator} onChange={e => updateCond(i, { operator: e.target.value as ConditionOperator })}>
                  {OPERATORS.map(o => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
                <input
                  aria-label="Condition value"
                  className={`${inputCls} col-span-4 mt-0`}
                  placeholder="Value"
                  disabled={c.operator === 'is_set' || c.operator === 'is_empty'}
                  value={c.value}
                  onChange={e => updateCond(i, { value: e.target.value })}
                />
                <button type="button" aria-label="Remove condition" onClick={() => set('conditions', content.conditions.filter((_, idx) => idx !== i))} className="col-span-1 flex justify-center text-slate-400 hover:text-rose-600 cursor-pointer">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <textarea aria-label="Instruction to add" rows={2} className={inputCls} placeholder="Instruction added when true…" value={c.appendPrompt} onChange={e => updateCond(i, { appendPrompt: e.target.value })} />
            </div>
          ))}
          {content.conditions.length === 0 && <p className={hintCls}>No conditions yet.</p>}
        </div>
      </section>
    </div>
  );
};

// ---------------------------------------------------------------------------- model & rules
const TIER_LABEL: Record<string, string> = { fast: 'Fastest', balanced: 'Balanced', smart: 'Most capable' };

const ModelTab: React.FC<{ content: AgentVersionContent; set: SetFn; models: ModelDefinition[] }> = ({ content, set, models }) => {
  const flag = (key: keyof AgentVersionContent['flags'], label: string, hint: string) => (
    <label className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800">
      <input
        type="checkbox"
        className="mt-0.5"
        checked={Boolean(content.flags[key])}
        onChange={e => set('flags', { ...content.flags, [key]: e.target.checked })}
      />
      <span>
        <span className="font-semibold text-slate-800 dark:text-slate-200">{label}</span>
        <span className="block text-[11px] text-slate-500">{hint}</span>
      </span>
    </label>
  );

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className={labelCls}>Gemini model</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {models.map(m => (
            <label
              key={m.id}
              className={`cursor-pointer rounded-xl border p-3 text-xs ${content.model === m.id ? 'border-accent bg-orange-50/60 dark:bg-orange-950/20' : 'border-slate-200 dark:border-slate-800'}`}
            >
              <input type="radio" name="model" className="sr-only" checked={content.model === m.id} onChange={() => set('model', m.id)} />
              <span className="flex items-center justify-between">
                <span className="font-semibold text-slate-900 dark:text-white">{m.label}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{TIER_LABEL[m.tier]}</span>
              </span>
              <span className="mt-1 block text-[11px] text-slate-500">{m.description}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="temp">
            Creativity: {content.temperature.toFixed(2)}
          </label>
          <input id="temp" type="range" min={0} max={1} step={0.05} value={content.temperature} onChange={e => set('temperature', Number(e.target.value))} className="mt-2 w-full" />
          <p className={hintCls}>Lower = consistent and factual. Higher = more varied wording. 0.3-0.7 suits property Q&amp;A.</p>
        </div>
        <div>
          <label className={labelCls} htmlFor="maxtok">Max answer length (tokens)</label>
          <input id="maxtok" type="number" min={100} max={2000} step={50} value={content.maxOutputTokens} onChange={e => set('maxOutputTokens', Math.min(2000, Math.max(100, Number(e.target.value) || 600)))} className={inputCls} />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {flag('oneQuestionPerMessage', 'One question per message', 'Avoids interrogating the visitor.')}
        {flag('replyInVisitorLanguage', 'Reply in the visitor\'s language', 'Hindi, Hinglish, Marathi… follows the visitor.')}
        {flag('splitLongAnswers', 'Split long answers', 'Short paragraphs instead of one block.')}
        <div className="rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800">
          <label htmlFor="maxs" className="font-semibold text-slate-800 dark:text-slate-200">Max sentences per answer</label>
          <input id="maxs" type="number" min={1} max={12} value={content.flags.maxSentences} onChange={e => set('flags', { ...content.flags, maxSentences: Math.min(12, Math.max(1, Number(e.target.value) || 4)) })} className={inputCls} />
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------- knowledge & data
const KnowledgeTab: React.FC<{ content: AgentVersionContent; set: SetFn; forms: FormItem[] }> = ({ content, set, forms }) => {
  const { data: chatbotsData } = useChatbots();
  const bots = chatbotsData?.chatbots ?? [];
  const [botId, setBotId] = useState<string>('');
  const activeBot = botId || bots[0]?.id || '';
  const { data: sources } = useQuery({
    queryKey: ['agent-sources', activeBot],
    queryFn: () => knowledgeService.listSources(activeBot),
    enabled: Boolean(activeBot),
  });
  const { data: refs } = useKnowledgeReferences();
  const saveRef = useSaveKnowledgeReference();
  const [refName, setRefName] = useState('');
  const [refError, setRefError] = useState<string | null>(null);

  const items = useMemo(() => sources?.sources ?? [], [sources]);
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter(x => x !== id) : [...list, id]);
  const form = forms.find(f => f.id === content.formId);

  const createRef = async () => {
    setRefError(null);
    try {
      const created = await saveRef.mutateAsync({ name: refName.trim(), sourceIds: content.knowledge.sourceIds });
      set('knowledge', { ...content.knowledge, referenceIds: [...content.knowledge.referenceIds, created.id] });
      setRefName('');
    } catch (err) {
      setRefError(err instanceof Error ? err.message : 'Could not save the reference.');
    }
  };

  return (
    <div className="space-y-6">
      <section>
        <label className={labelCls} htmlFor="form-select">Data to collect (form)</label>
        <select id="form-select" className={inputCls} value={content.formId ?? ''} onChange={e => set('formId', e.target.value || null)}>
          <option value="">None: the agent only chats</option>
          {forms.map(f => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        {form ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {form.fields.filter(f => f.collectInChat).map(f => (
              <li key={f.key} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">{f.label}</li>
            ))}
          </ul>
        ) : (
          <p className={hintCls}>Pick a form and the agent will gather these fields during the chat and save them on the lead.</p>
        )}
      </section>

      <section>
        <h3 className="text-xs font-bold text-slate-900 dark:text-white">Knowledge scope</h3>
        <p className={hintCls}>
          By default an agent can use everything its chatbot has been trained on. Tick sources to limit it to those only.
          {content.knowledge.sourceIds.length + content.knowledge.referenceIds.length === 0 && ' Currently: all sources.'}
        </p>
        {bots.length > 1 && (
          <select aria-label="Chatbot whose sources to list" className={inputCls} value={activeBot} onChange={e => setBotId(e.target.value)}>
            {bots.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
        <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
          {items.map(s => (
            <li key={s.id}>
              <label className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <input type="checkbox" checked={content.knowledge.sourceIds.includes(s.id)} onChange={() => set('knowledge', { ...content.knowledge, sourceIds: toggle(content.knowledge.sourceIds, s.id) })} />
                <span className="truncate">{s.title}</span>
                <span className="ml-auto text-[10px] uppercase text-slate-400">{s.type}</span>
              </label>
            </li>
          ))}
          {items.length === 0 && <li className={hintCls}>{activeBot ? 'This chatbot has no knowledge sources yet.' : 'Create a chatbot first.'}</li>}
        </ul>
      </section>

      <section>
        <h3 className="text-xs font-bold text-slate-900 dark:text-white">Knowledge references</h3>
        <p className={hintCls}>Named bundles of sources you can reuse across agents (for example &quot;Pricing only&quot;).</p>
        <ul className="mt-2 space-y-1">
          {(refs ?? []).map(r => (
            <li key={r.id}>
              <label className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <input type="checkbox" checked={content.knowledge.referenceIds.includes(r.id)} onChange={() => set('knowledge', { ...content.knowledge, referenceIds: toggle(content.knowledge.referenceIds, r.id) })} />
                <span>{r.name}</span>
                <span className="ml-auto text-[10px] text-slate-400">{r.sourceIds.length} sources</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <input aria-label="New reference name" className={`${inputCls} mt-0`} placeholder="New reference from the ticked sources" value={refName} onChange={e => setRefName(e.target.value)} />
          <button
            type="button"
            disabled={refName.trim().length < 2 || content.knowledge.sourceIds.length === 0 || saveRef.isPending}
            onClick={createRef}
            className="shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 dark:bg-slate-700 cursor-pointer"
          >
            Save reference
          </button>
        </div>
        {refError && <p className="mt-1 text-[11px] text-rose-600" role="alert">{refError}</p>}
      </section>
    </div>
  );
};
