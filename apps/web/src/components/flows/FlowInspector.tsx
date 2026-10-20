import React, { useMemo, useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { CONDITION_OPERATORS, FLOW_TRIGGER_TYPES, type FlowNodeType } from '@propbot/shared';
import { useActions, useTools } from '../../services/tools.service.js';
import { useFlows } from '../../services/flows.service.js';

export type NodeConfig = Record<string, unknown>;

const inputCls = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800 dark:text-white';
const labelCls = 'text-xs font-semibold text-slate-700 dark:text-slate-300';
const hint = 'mt-1 text-[11px] text-slate-500';

export const TRIGGER_OPTIONS: Array<{ id: (typeof FLOW_TRIGGER_TYPES)[number]; label: string }> = [
  { id: 'new_lead', label: 'A new lead is captured' },
  { id: 'lead_stage_changed', label: 'A lead changes stage' },
  { id: 'visit_booked', label: 'A site visit is booked' },
  { id: 'form_submitted', label: 'A form is submitted' },
  { id: 'schedule', label: 'On a schedule' },
  { id: 'webhook', label: 'Called from the API' },
];
const LEAD_STAGES = ['new', 'contacted', 'qualified', 'site_visit_scheduled', 'site_visit_done', 'negotiation', 'booked', 'converted', 'lost'];
const OP_LABEL: Record<string, string> = {
  equals: 'equals',
  not_equals: 'does not equal',
  contains: 'contains',
  not_contains: 'does not contain',
  greater_than: 'is greater than',
  less_than: 'is less than',
  is_set: 'is set',
  is_empty: 'is empty',
};

interface FieldProps {
  value: string;
  onChange: (v: string) => void;
  variables: string[];
  multiline?: boolean;
  label: string;
  placeholder?: string;
  id: string;
}

/** Text field with an "Insert variable" picker that adds {{path}} at the cursor. */
export const VariableField: React.FC<FieldProps> = ({ value, onChange, variables, multiline, label, placeholder, id }) => {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const insert = (v: string) => {
    const el = ref.current;
    const token = `{{${v}}}`;
    if (el && typeof el.selectionStart === 'number') onChange(value.slice(0, el.selectionStart) + token + value.slice(el.selectionEnd));
    else onChange(value + token);
  };
  return (
    <div>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className={labelCls}>{label}</label>
        <select aria-label={`Insert variable into ${label}`} value="" onChange={e => e.target.value && insert(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
          <option value="">Insert variable…</option>
          {variables.map(v => <option key={v} value={v}>{`{{${v}}}`}</option>)}
        </select>
      </div>
      {multiline ? (
        <textarea id={id} ref={ref} rows={4} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={inputCls} />
      ) : (
        <input id={id} ref={ref} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={inputCls} />
      )}
    </div>
  );
};

const MappingEditor: React.FC<{ keys: string[]; value: Record<string, string>; onChange: (v: Record<string, string>) => void; variables: string[]; idPrefix: string }> = ({ keys, value, onChange, variables, idPrefix }) => (
  <div className="space-y-2">
    {keys.length === 0 && <p className={hint}>This takes no inputs.</p>}
    {keys.map(k => (
      <VariableField key={k} id={`${idPrefix}-${k}`} label={k} variables={variables} value={value[k] ?? ''} onChange={v => onChange({ ...value, [k]: v })} placeholder="value or {{variable}}" />
    ))}
  </div>
);

interface Props {
  type: FlowNodeType;
  config: NodeConfig;
  onChange: (next: NodeConfig) => void;
  flowId: string;
  /** Names created by set_variable / save-as steps elsewhere in the flow. */
  customVariables: string[];
}

export const FlowInspector: React.FC<Props> = ({ type, config, onChange, flowId, customVariables }) => {
  const { data: tools } = useTools();
  const { data: actions } = useActions();
  const { data: flows } = useFlows();
  const set = (patch: NodeConfig) => onChange({ ...config, ...patch });
  const str = (k: string) => (typeof config[k] === 'string' ? (config[k] as string) : '');

  const variables = useMemo(
    () => ['lead.firstName', 'lead.name', 'lead.phone', 'lead.email', 'lead.status', 'lead.source', 'event.projectName', 'event.scheduledAt', 'event.message', ...customVariables.map(v => `vars.${v}`)],
    [customVariables],
  );
  const tool = tools?.find(t => t.id === config.toolId);
  const action = actions?.find(a => a.id === config.actionId);

  switch (type) {
    case 'trigger':
      return (
        <div className="space-y-3">
          <div>
            <label className={labelCls} htmlFor="trg">Start this flow when</label>
            <select id="trg" value={str('triggerType')} onChange={e => set({ triggerType: e.target.value })} className={inputCls}>
              <option value="">Choose…</option>
              {TRIGGER_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          {config.triggerType === 'lead_stage_changed' && (
            <div>
              <label className={labelCls} htmlFor="trg-stage">Only when the new stage is</label>
              <select id="trg-stage" value={str('toStatus')} onChange={e => set({ toStatus: e.target.value })} className={inputCls}>
                <option value="">Any stage</option>
                {LEAD_STAGES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          )}
          {config.triggerType === 'schedule' && (
            <div>
              <label className={labelCls} htmlFor="trg-every">Run every (minutes)</label>
              <input id="trg-every" type="number" min={5} value={Number(config.everyMinutes) || 60} onChange={e => set({ everyMinutes: Math.max(5, Number(e.target.value) || 60) })} className={inputCls} />
            </div>
          )}
          {config.triggerType === 'webhook' && <p className={hint}>Start it with <code>POST /api/flows/{flowId}/trigger</code> once published.</p>}
        </div>
      );

    case 'send_message':
      return <VariableField id="sm" label="Message" multiline value={str('text')} onChange={v => set({ text: v })} variables={variables} placeholder="Hi {{lead.firstName}}, …" />;

    case 'ai_step':
      return (
        <div className="space-y-3">
          <VariableField id="ai" label="Instruction for the AI" multiline value={str('prompt')} onChange={v => set({ prompt: v })} variables={variables} placeholder="Write a friendly 2-line follow-up for {{lead.firstName}}…" />
          <div>
            <label className={labelCls} htmlFor="ai-save">Save the answer as variable</label>
            <input id="ai-save" value={str('saveAs')} onChange={e => set({ saveAs: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })} className={inputCls} placeholder="reply" />
          </div>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={config.send === true} onChange={e => set({ send: e.target.checked })} /> Send the answer to the lead</label>
        </div>
      );

    case 'condition':
      return (
        <div className="space-y-3">
          <div>
            <label className={labelCls} htmlFor="cd-field">Check</label>
            <input id="cd-field" list="flow-vars" value={str('field')} onChange={e => set({ field: e.target.value })} className={inputCls} placeholder="lead.status" />
            <datalist id="flow-vars">{variables.map(v => <option key={v} value={v} />)}</datalist>
          </div>
          <div>
            <label className={labelCls} htmlFor="cd-op">Condition</label>
            <select id="cd-op" value={str('operator')} onChange={e => set({ operator: e.target.value })} className={inputCls}>
              <option value="">Choose…</option>
              {CONDITION_OPERATORS.map(o => <option key={o} value={o}>{OP_LABEL[o]}</option>)}
            </select>
          </div>
          {config.operator !== 'is_set' && config.operator !== 'is_empty' && <VariableField id="cd-val" label="Value" value={str('value')} onChange={v => set({ value: v })} variables={variables} />}
          <p className={hint}>Connect the green output for “yes” and the red one for “no”.</p>
        </div>
      );

    case 'llm_router': {
      const choices = (Array.isArray(config.choices) ? config.choices : []) as Array<{ id: string; label: string; description: string }>;
      const upd = (i: number, p: Partial<(typeof choices)[number]>) => set({ choices: choices.map((c, j) => (j === i ? { ...c, ...p } : c)) });
      return (
        <div className="space-y-3">
          <VariableField id="lr-q" label="What should the AI look at?" multiline value={str('question')} onChange={v => set({ question: v })} variables={variables} placeholder="{{event.message}}" />
          <div className="flex items-center justify-between">
            <span className={labelCls}>Choices</span>
            <button type="button" onClick={() => set({ choices: [...choices, { id: `choice_${choices.length + 1}`, label: '', description: '' }] })} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"><Plus className="h-3 w-3" /> Add</button>
          </div>
          {choices.map((c, i) => (
            <div key={i} className="space-y-1 rounded-xl border border-slate-200 p-2 dark:border-slate-800">
              <div className="flex gap-2">
                <input aria-label="Choice id" value={c.id} onChange={e => upd(i, { id: e.target.value.replace(/[^a-z0-9_]/gi, '').toLowerCase() })} className={`${inputCls} mt-0 font-mono`} />
                <input aria-label="Choice label" value={c.label} onChange={e => upd(i, { label: e.target.value })} placeholder="Label" className={`${inputCls} mt-0`} />
                <button type="button" aria-label="Remove choice" onClick={() => set({ choices: choices.filter((_, j) => j !== i) })} className="text-slate-400 hover:text-rose-600 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
              </div>
              <input aria-label="When to pick this" value={c.description} onChange={e => upd(i, { description: e.target.value })} placeholder="When should the AI pick this?" className={`${inputCls} mt-0`} />
            </div>
          ))}
          <p className={hint}>A “default” output is used when the AI cannot decide.</p>
        </div>
      );
    }

    case 'wait': {
      const minutes = Number(config.minutes) || 60;
      const unit = minutes % 1440 === 0 ? 1440 : minutes % 60 === 0 ? 60 : 1;
      return (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls} htmlFor="w-n">Wait for</label>
            <input id="w-n" type="number" min={1} value={minutes / unit} onChange={e => set({ minutes: Math.max(1, Number(e.target.value) || 1) * unit })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="w-u">Unit</label>
            <select id="w-u" value={unit} onChange={e => set({ minutes: (minutes / unit) * Number(e.target.value) })} className={inputCls}>
              <option value={1}>minutes</option>
              <option value={60}>hours</option>
              <option value={1440}>days</option>
            </select>
          </div>
        </div>
      );
    }

    case 'loop':
      return (
        <div>
          <label className={labelCls} htmlFor="lp">Repeat (1 to 20 times)</label>
          <input id="lp" type="number" min={1} max={20} value={Number(config.times) || 3} onChange={e => set({ times: Math.min(20, Math.max(1, Number(e.target.value) || 1)) })} className={inputCls} />
          <p className={hint}>Connect “repeat” to the steps to loop and bring them back to this step. “done” continues after the last round.</p>
        </div>
      );

    case 'set_variable':
      return (
        <div className="space-y-3">
          <div>
            <label className={labelCls} htmlFor="sv-n">Variable name</label>
            <input id="sv-n" value={str('name')} onChange={e => set({ name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })} className={inputCls} />
          </div>
          <VariableField id="sv-v" label="Value" value={str('value')} onChange={v => set({ value: v })} variables={variables} />
        </div>
      );

    case 'tool':
      return (
        <div className="space-y-3">
          <div>
            <label className={labelCls} htmlFor="tl">Tool</label>
            <select id="tl" value={str('toolId')} onChange={e => set({ toolId: e.target.value, input: {} })} className={inputCls}>
              <option value="">Choose…</option>
              {(tools ?? []).filter(t => t.status === 'active').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          {tool && <MappingEditor idPrefix="tl-in" keys={tool.inputSchema.map(p => p.key)} value={(config.input as Record<string, string>) ?? {}} onChange={v => set({ input: v })} variables={variables} />}
          <div>
            <label className={labelCls} htmlFor="tl-save">Save the result as variable</label>
            <input id="tl-save" value={str('saveAs')} onChange={e => set({ saveAs: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })} className={inputCls} />
          </div>
        </div>
      );

    case 'action':
      return (
        <div className="space-y-3">
          <div>
            <label className={labelCls} htmlFor="ac">Action</label>
            <select id="ac" value={str('actionId')} onChange={e => set({ actionId: e.target.value, input: {} })} className={inputCls}>
              <option value="">Choose…</option>
              {(actions ?? []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            {action && <p className={hint}>{action.description}</p>}
          </div>
          {action && <MappingEditor idPrefix="ac-in" keys={action.inputs.map(p => p.key)} value={(config.input as Record<string, string>) ?? {}} onChange={v => set({ input: v })} variables={variables} />}
          <div>
            <label className={labelCls} htmlFor="ac-save">Save the result as variable</label>
            <input id="ac-save" value={str('saveAs')} onChange={e => set({ saveAs: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })} className={inputCls} />
          </div>
        </div>
      );

    case 'sub_flow':
      return (
        <div>
          <label className={labelCls} htmlFor="sf">Run flow</label>
          <select id="sf" value={str('flowId')} onChange={e => set({ flowId: e.target.value })} className={inputCls}>
            <option value="">Choose…</option>
            {(flows ?? []).filter(f => f.id !== flowId && f.activeVersion).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <p className={hint}>Only published flows can be reused. They run inside this one and share its variables.</p>
        </div>
      );

    case 'end':
      return <p className={hint}>The flow finishes here.</p>;
  }
};
