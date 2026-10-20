import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Rocket, Play, RotateCcw, GitCompare, Trash2, Send } from 'lucide-react';
import type { AgentVersionContent, AgentVersionItem } from '@propbot/shared';
import {
  useAgent,
  useCompareVersions,
  useDeleteTestCase,
  useDiscardDraft,
  useForms,
  useModelRegistry,
  usePublishVersion,
  useRollbackVersion,
  useSaveDraft,
  useSaveTestCase,
  useTestAgent,
  useTestCases,
  type AgentTestResult,
  type CompareResult,
} from '../services/agents.service.js';
import { AgentEditor } from '../components/agents/AgentEditor.js';
import { Badge } from '../components/ui/Badge.js';
import { Skeleton } from '../components/common/Skeleton.js';

type RightTab = 'test' | 'versions';

const toContent = (v: AgentVersionItem): AgentVersionContent => ({
  prompt: v.prompt,
  variables: v.variables,
  conditions: v.conditions,
  knowledge: v.knowledge,
  formId: v.formId ?? null,
  model: v.model,
  temperature: v.temperature,
  maxOutputTokens: v.maxOutputTokens,
  flags: v.flags,
});

const errMsg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
const btn = 'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-40 cursor-pointer';

export const AgentStudioPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useAgent(id);
  const { data: forms } = useForms();
  const { data: registry } = useModelRegistry();
  const save = useSaveDraft();
  const publish = usePublishVersion();
  const [content, setContent] = useState<AgentVersionContent | null>(null);
  const [baseVersionId, setBaseVersionId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>('test');
  const [changeNote, setChangeNote] = useState('');

  const versions = useMemo(() => [...(data?.versions ?? [])].sort((a, b) => b.version - a.version), [data]);
  const latest = versions[0];

  // Load the newest version into the editor whenever it changes server-side (and nothing is unsaved).
  useEffect(() => {
    if (latest && (!content || (!dirty && latest.id !== baseVersionId))) {
      setContent(toContent(latest));
      setBaseVersionId(latest.id);
    }
  }, [latest, content, dirty, baseVersionId]);

  if (isLoading || !data || !content || !latest) {
    return error ? <p className="p-6 text-sm text-rose-600" role="alert">{error.message}</p> : <Skeleton className="h-96 w-full" />;
  }
  const agent = data.agent;

  const onChange = (next: AgentVersionContent) => {
    setContent(next);
    setDirty(true);
    setNotice(null);
  };

  const saveDraft = async (): Promise<AgentVersionItem | null> => {
    try {
      const v = await save.mutateAsync({ id: agent.id, patch: { ...content, changeNote: changeNote || undefined } });
      setBaseVersionId(v.id);
      setDirty(false);
      setNotice({ kind: 'ok', text: `Saved as draft v${v.version}.` });
      return v;
    } catch (e) {
      setNotice({ kind: 'err', text: errMsg(e, 'Could not save.') });
      return null;
    }
  };

  const saveAndPublish = async () => {
    const v = dirty || latest.status !== 'draft' ? await saveDraft() : latest;
    if (!v) return;
    try {
      await publish.mutateAsync({ id: agent.id, versionId: v.id, changeNote: changeNote || undefined });
      setNotice({ kind: 'ok', text: `Published v${v.version}. Chatbots using this agent now follow it.` });
      setChangeNote('');
    } catch (e) {
      setNotice({ kind: 'err', text: errMsg(e, 'Could not publish.') });
    }
  };

  return (
    <div className="space-y-4 pb-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Link to="/agents" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
            <ArrowLeft className="h-3.5 w-3.5" /> All agents
          </Link>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="truncate font-serif text-xl font-bold text-slate-900 dark:text-white">{agent.name}</h1>
            {agent.activeVersion ? <Badge variant="mint" size="sm">Live v{agent.activeVersion}</Badge> : <Badge variant="gold" size="sm">Not published</Badge>}
            {dirty && <Badge variant="blue" size="sm">Unsaved changes</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            aria-label="Change note"
            value={changeNote}
            onChange={e => setChangeNote(e.target.value)}
            maxLength={200}
            placeholder="What changed? (optional)"
            className="w-48 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800 dark:text-white"
          />
          <button type="button" disabled={!dirty || save.isPending} onClick={() => void saveDraft()} className={`${btn} bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100`}>
            <Save className="h-3.5 w-3.5" /> {save.isPending ? 'Saving…' : 'Save draft'}
          </button>
          <button type="button" disabled={publish.isPending || (!dirty && latest.id === agent.activeVersionId)} onClick={() => void saveAndPublish()} className={`${btn} bg-gradient-to-r from-[#B84A22] to-[#c75528] text-white`}>
            <Rocket className="h-3.5 w-3.5" /> {publish.isPending ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </div>

      {notice && (
        <p role={notice.kind === 'err' ? 'alert' : 'status'} className={`rounded-xl px-3 py-2 text-xs ${notice.kind === 'err' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30'}`}>
          {notice.text}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 lg:col-span-3">
          <AgentEditor content={content} onChange={onChange} forms={forms ?? []} models={registry?.models ?? []} />
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
          <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800" role="tablist">
            {(['test', 'versions'] as RightTab[]).map(t => (
              <button key={t} role="tab" aria-selected={rightTab === t} type="button" onClick={() => setRightTab(t)} className={`border-b-2 px-3 py-2 text-xs font-semibold capitalize cursor-pointer ${rightTab === t ? 'border-[#B84A22] text-[#B84A22]' : 'border-transparent text-slate-500'}`}>
                {t === 'test' ? 'Test' : 'Versions'}
              </button>
            ))}
          </div>
          <div className="pt-4">
            {rightTab === 'test' ? (
              <TestPanel agentId={agent.id} versionId={baseVersionId ?? latest.id} variableKeys={content.variables.map(v => v.key).filter(Boolean)} dirty={dirty} />
            ) : (
              <VersionsPanel agentId={agent.id} versions={versions} activeId={agent.activeVersionId} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------- test panel
interface Turn {
  role: 'visitor' | 'assistant';
  content: string;
}

const TestPanel: React.FC<{ agentId: string; versionId: string; variableKeys: string[]; dirty: boolean }> = ({ agentId, versionId, variableKeys, dirty }) => {
  const test = useTestAgent();
  const { data: cases } = useTestCases(agentId);
  const saveCase = useSaveTestCase();
  const delCase = useDeleteTestCase();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [vars, setVars] = useState<Record<string, string>>({});
  const [last, setLast] = useState<AgentTestResult | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (text: string, history: Turn[] = turns) => {
    if (!text.trim()) return;
    setError(null);
    const next = [...history, { role: 'visitor' as const, content: text.trim() }];
    setTurns(next);
    setDraft('');
    try {
      const res = await test.mutateAsync({ id: agentId, input: { versionId, messages: next, variables: vars } });
      setLast(res);
      setTurns([...next, { role: 'assistant', content: res.reply }]);
    } catch (e) {
      setError(errMsg(e, 'The test failed.'));
    }
  };

  const visitorMessages = turns.filter(t => t.role === 'visitor').map(t => t.content);

  return (
    <div className="space-y-3">
      {dirty && <p className="text-[11px] text-amber-600">Tests run against the last saved draft. Save to include your latest edits.</p>}
      {variableKeys.length > 0 && (
        <details className="rounded-xl border border-slate-200 p-2 text-xs dark:border-slate-800">
          <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-300">Sample values for variables</summary>
          <div className="mt-2 space-y-1.5">
            {variableKeys.map(k => (
              <input key={k} aria-label={`Value for ${k}`} placeholder={k} value={vars[k] ?? ''} onChange={e => setVars({ ...vars, [k]: e.target.value })} className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            ))}
          </div>
        </details>
      )}

      <div className="max-h-80 min-h-32 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-3 dark:bg-slate-950/40" aria-live="polite">
        {turns.length === 0 && <p className="text-xs text-slate-400">Say something as a visitor to try the agent.</p>}
        {turns.map((t, i) => (
          <div key={i} className={`max-w-[88%] whitespace-pre-wrap rounded-xl px-3 py-2 text-xs ${t.role === 'visitor' ? 'ml-auto bg-[#B84A22] text-white' : 'bg-white text-slate-800 shadow-sm dark:bg-slate-800 dark:text-slate-100'}`}>
            {t.content}
          </div>
        ))}
        {test.isPending && <p className="text-xs text-slate-400">Thinking…</p>}
      </div>
      {error && <p className="text-[11px] text-rose-600" role="alert">{error}</p>}

      <form
        onSubmit={e => {
          e.preventDefault();
          void send(draft);
        }}
        className="flex gap-2"
      >
        <input aria-label="Test message" value={draft} onChange={e => setDraft(e.target.value)} maxLength={2000} placeholder="Type a visitor message…" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800 dark:text-white" />
        <button type="submit" disabled={test.isPending || !draft.trim()} aria-label="Send" className={`${btn} bg-slate-900 text-white dark:bg-slate-700`}>
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => { setTurns([]); setLast(null); setError(null); }} className={`${btn} bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200`}>
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </button>
        <button
          type="button"
          disabled={visitorMessages.length === 0 || saveCase.isPending}
          onClick={() => {
            const name = window.prompt('Name this test case', (visitorMessages[0] ?? '').slice(0, 40));
            if (name && name.trim().length >= 2) saveCase.mutate({ agentId, input: { name: name.trim(), messages: visitorMessages.slice(0, 8) } });
          }}
          className={`${btn} bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200`}
        >
          Save as test case
        </button>
        {last && (
          <button type="button" onClick={() => setShowPrompt(s => !s)} className="ml-auto text-[11px] font-semibold text-[#B84A22] cursor-pointer">
            {showPrompt ? 'Hide' : 'Show'} final prompt
          </button>
        )}
      </div>

      {last && (
        <div className="rounded-xl border border-slate-200 p-3 text-[11px] text-slate-600 dark:border-slate-800 dark:text-slate-400">
          <p>v{last.version} · {last.model} · {last.tokens} tokens · {last.latencyMs} ms · {last.isGrounded ? 'grounded in your knowledge' : 'no matching knowledge'}</p>
          {last.citations.length > 0 && (
            <ul className="mt-1 list-disc pl-4">
              {last.citations.slice(0, 3).map((c, i) => (
                <li key={i}>{c.sourceTitle}</li>
              ))}
            </ul>
          )}
          {showPrompt && <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-[10px] dark:bg-slate-950/50">{last.instructions}</pre>}
        </div>
      )}

      <div>
        <h4 className="text-xs font-bold text-slate-900 dark:text-white">Saved test cases</h4>
        <ul className="mt-1 space-y-1">
          {(cases ?? []).map(c => (
            <li key={c.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <span className="truncate">{c.name}</span>
              <span className="ml-auto flex shrink-0 gap-1">
                <button type="button" aria-label={`Run ${c.name}`} onClick={() => { setTurns([]); void send(c.messages[0] ?? '', []); }} className="rounded p-1 text-slate-500 hover:text-[#B84A22] cursor-pointer">
                  <Play className="h-3.5 w-3.5" />
                </button>
                <button type="button" aria-label={`Delete ${c.name}`} onClick={() => delCase.mutate({ agentId, id: c.id })} className="rounded p-1 text-slate-400 hover:text-rose-600 cursor-pointer">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            </li>
          ))}
          {(cases ?? []).length === 0 && <li className="text-[11px] text-slate-400">None yet.</li>}
        </ul>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------- versions
const VersionsPanel: React.FC<{ agentId: string; versions: AgentVersionItem[]; activeId: string | null }> = ({ agentId, versions, activeId }) => {
  const publish = usePublishVersion();
  const rollback = useRollbackVersion();
  const discard = useDiscardDraft();
  const compare = useCompareVersions();
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [msgs, setMsgs] = useState('Is it ready to move in?\nWhat is the price?');
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errMsg(e, 'Action failed.'));
    }
  };

  const doCompare = () =>
    run(async () => {
      const messages = msgs.split('\n').map(m => m.trim()).filter(Boolean).slice(0, 8);
      setResult(await compare.mutateAsync({ id: agentId, input: { versionA: a, versionB: b, messages, variables: {} } }));
    });

  return (
    <div className="space-y-4">
      {error && <p className="text-[11px] text-rose-600" role="alert">{error}</p>}
      <ul className="space-y-2">
        {versions.map(v => (
          <li key={v.id} className="rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900 dark:text-white">v{v.version}</span>
              {v.id === activeId ? <Badge variant="mint" size="sm">Live</Badge> : <Badge variant="slate" size="sm">{v.status}</Badge>}
              <span className="ml-auto text-[10px] text-slate-400">{new Date(v.createdAt).toLocaleString()}</span>
            </div>
            {v.changeNote && <p className="mt-1 text-slate-500">{v.changeNote}</p>}
            <div className="mt-2 flex gap-2">
              {v.status === 'draft' && (
                <>
                  <button type="button" onClick={() => void run(() => publish.mutateAsync({ id: agentId, versionId: v.id }))} className="font-semibold text-[#B84A22] cursor-pointer">Publish</button>
                  <button type="button" onClick={() => window.confirm(`Discard draft v${v.version}?`) && void run(() => discard.mutateAsync({ id: agentId, versionId: v.id }))} className="text-slate-500 hover:text-rose-600 cursor-pointer">Discard</button>
                </>
              )}
              {v.status !== 'draft' && v.id !== activeId && (
                <button type="button" onClick={() => window.confirm(`Roll back to v${v.version}?`) && void run(() => rollback.mutateAsync({ id: agentId, versionId: v.id }))} className="font-semibold text-[#B84A22] cursor-pointer">Roll back to this</button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {versions.length >= 2 && (
        <section className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <h4 className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white"><GitCompare className="h-3.5 w-3.5" /> Compare versions (A/B)</h4>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {[{ v: a, set: setA, label: 'Version A' }, { v: b, set: setB, label: 'Version B' }].map(s => (
              <select key={s.label} aria-label={s.label} value={s.v} onChange={e => s.set(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                <option value="">{s.label}</option>
                {versions.map(v => <option key={v.id} value={v.id}>v{v.version}</option>)}
              </select>
            ))}
          </div>
          <textarea aria-label="Visitor messages, one per line" rows={3} value={msgs} onChange={e => setMsgs(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
          <button type="button" disabled={!a || !b || a === b || compare.isPending} onClick={() => void doCompare()} className={`${btn} mt-2 bg-slate-900 text-white dark:bg-slate-700`}>
            {compare.isPending ? 'Comparing…' : 'Run comparison'}
          </button>
          {result && (
            <div className="mt-3 space-y-3">
              {result.rows.map((r, i) => (
                <div key={i} className="text-[11px]">
                  <p className="font-semibold text-slate-700 dark:text-slate-300">“{r.message}”</p>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-2 dark:bg-slate-950/40"><b>v{result.a.version}</b> · {r.a.latencyMs} ms{'\n'}{r.a.reply}</p>
                    <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-2 dark:bg-slate-950/40"><b>v{result.b.version}</b> · {r.b.latencyMs} ms{'\n'}{r.b.reply}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
