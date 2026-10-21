import React, { useState } from 'react';
import { Plus, Trash2, KanbanSquare, MessageSquare, AlertCircle } from 'lucide-react';
import type { BoardItem, BoardTaskItem } from '@propbot/shared';
import {
  useAddTaskComment,
  useBoardTasks,
  useBoards,
  useCreateBoard,
  useCreateBoardTask,
  useDeleteBoard,
  useDeleteBoardTask,
  useMoveBoardTask,
  useTaskComments,
} from '../services/intelligence.service.js';
import { Badge } from '../components/ui/Badge.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { Skeleton } from '../components/common/Skeleton.js';

const inputCls = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800 dark:text-white';
const errMsg = (e: unknown, f: string) => (e instanceof Error ? e.message : f);

const TaskDrawer: React.FC<{ boardId: string; task: BoardTaskItem; onClose: () => void }> = ({ boardId, task, onClose }) => {
  const { data } = useTaskComments(boardId, task.id);
  const add = useAddTaskComment();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50" role="dialog" aria-modal="true" aria-label="Task">
      <div className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-2xl dark:bg-slate-900">
        <div className="flex items-start justify-between"><h2 className="font-serif text-lg font-bold text-slate-900 dark:text-white">{task.title}</h2><button type="button" onClick={onClose} className="text-xs text-slate-500 cursor-pointer">Close</button></div>
        <p className="mt-1 text-xs text-slate-500">{task.assigneeName ? `Assigned to ${task.assigneeName}` : 'Unassigned'}{task.dueAt ? ` · due ${new Date(task.dueAt).toLocaleDateString()}` : ''}</p>
        {Object.keys(task.data).length > 0 && <dl className="mt-3 space-y-1 text-xs">{Object.entries(task.data).map(([k, v]) => <div key={k}><dt className="inline font-semibold">{k.replace(/_/g, ' ')}: </dt><dd className="inline text-slate-600 dark:text-slate-300">{String(v)}</dd></div>)}</dl>}
        <h3 className="mt-5 text-xs font-bold text-slate-900 dark:text-white">Comments</h3>
        <ul className="mt-2 space-y-2">{(data ?? []).map(c => <li key={c.id} className="rounded-xl bg-slate-50 p-2 text-xs dark:bg-slate-800"><span className="block text-[10px] text-slate-400">{c.authorName ?? 'Someone'} · {new Date(c.createdAt).toLocaleString()}</span>{c.body}</li>)}{(data ?? []).length === 0 && <li className="text-xs text-slate-400">No comments yet.</li>}</ul>
        <form onSubmit={e => { e.preventDefault(); setError(null); add.mutateAsync({ boardId, taskId: task.id, body }).then(() => setBody(''), err => setError(errMsg(err, 'Could not post.'))); }} className="mt-3 flex gap-2">
          <input aria-label="Comment" required value={body} onChange={e => setBody(e.target.value)} placeholder="Add a comment" className={`${inputCls} min-w-0 flex-1`} />
          <button type="submit" disabled={add.isPending} className="rounded-xl bg-slate-900 px-3 text-xs font-semibold text-white dark:bg-slate-700 cursor-pointer">Post</button>
        </form>
        {error && <p className="mt-1 text-[11px] text-rose-600" role="alert">{error}</p>}
      </div>
    </div>
  );
};

const Kanban: React.FC<{ board: BoardItem }> = ({ board }) => {
  const { data: tasks, isLoading } = useBoardTasks(board.id);
  const create = useCreateBoardTask();
  const move = useMoveBoardTask();
  const del = useDeleteBoardTask();
  const [dragId, setDragId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<BoardTaskItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errMsg(e, 'Action failed.'));
    }
  };
  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div>
      {error && <p className="mb-2 text-xs text-rose-600" role="alert">{error}</p>}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {board.columns.map(col => {
          const items = (tasks ?? []).filter(t => t.columnKey === col.key).sort((a, b) => a.position - b.position);
          return (
            <section
              key={col.key}
              aria-label={col.label}
              onDragOver={e => e.preventDefault()}
              onDrop={() => dragId && void run(() => move.mutateAsync({ boardId: board.id, taskId: dragId, columnKey: col.key, position: items.length }))}
              className="w-72 shrink-0 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60"
            >
              <h3 className="mb-2 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200">{col.label}<span className="text-slate-400">{items.length}</span></h3>
              <ul className="space-y-2">
                {items.map(t => (
                  <li key={t.id} draggable onDragStart={() => setDragId(t.id)} onDragEnd={() => setDragId(null)} className="cursor-grab rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <button type="button" onClick={() => setOpen(t)} className="block w-full text-left font-semibold text-slate-900 dark:text-white cursor-pointer">{t.title}</button>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                      {t.assigneeName && <Badge variant="slate" size="sm">{t.assigneeName}</Badge>}
                      {t.overdue && <Badge variant="gold" size="sm" icon={<AlertCircle className="h-3 w-3" />}>Overdue</Badge>}
                      {t.commentCount > 0 && <span className="inline-flex items-center gap-0.5"><MessageSquare className="h-3 w-3" />{t.commentCount}</span>}
                      <select aria-label={`Move ${t.title}`} value={t.columnKey} onChange={e => void run(() => move.mutateAsync({ boardId: board.id, taskId: t.id, columnKey: e.target.value, position: 0 }))} className="ml-auto rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px] dark:border-slate-700 dark:bg-slate-800">{board.columns.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
                      <button type="button" aria-label={`Delete ${t.title}`} onClick={() => window.confirm('Delete this task?') && void run(() => del.mutateAsync({ boardId: board.id, taskId: t.id }))} className="text-slate-400 hover:text-rose-600 cursor-pointer"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </li>
                ))}
              </ul>
              <form onSubmit={e => { e.preventDefault(); const title = (drafts[col.key] ?? '').trim(); if (title) void run(async () => { await create.mutateAsync({ boardId: board.id, input: { title, columnKey: col.key, data: {} } }); setDrafts({ ...drafts, [col.key]: '' }); }); }} className="mt-2">
                <input aria-label={`Add task to ${col.label}`} value={drafts[col.key] ?? ''} onChange={e => setDrafts({ ...drafts, [col.key]: e.target.value })} placeholder="+ Add task" className={`${inputCls} w-full`} />
              </form>
            </section>
          );
        })}
      </div>
      {open && <TaskDrawer boardId={board.id} task={open} onClose={() => setOpen(null)} />}
    </div>
  );
};

export const BoardsPage: React.FC = () => {
  const { data, isLoading, error } = useBoards();
  const create = useCreateBoard();
  const del = useDeleteBoard();
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const boards = data ?? [];
  const current = boards.find(b => b.id === selected) ?? boards[0];

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="font-serif text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Boards</h1><p className="mt-1 text-xs text-slate-500 sm:text-sm">Track follow-ups, documentation and loan processing as simple boards. Drag a card to move it.</p></div>
        <form onSubmit={e => { e.preventDefault(); setErr(null); create.mutateAsync({ name, columns: [{ key: 'todo', label: 'To do' }, { key: 'doing', label: 'In progress' }, { key: 'done', label: 'Done' }] }).then(b => { setName(''); setSelected(b.id); }, x => setErr(errMsg(x, 'Could not create the board.'))); }} className="flex gap-2">
          <input aria-label="New board name" required minLength={2} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Loan processing" className={inputCls} />
          <button type="submit" disabled={create.isPending} className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 text-xs font-bold text-white cursor-pointer"><Plus className="h-4 w-4" /> Board</button>
        </form>
      </div>
      {(error || err) && <p className="text-sm text-rose-600" role="alert">{err ?? error?.message}</p>}
      {isLoading ? <Skeleton className="h-40 w-full" /> : boards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700"><EmptyState icon={<KanbanSquare className="h-7 w-7" />} title="No boards yet" description="Create your first board to track work across your team." /></div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2" role="tablist">
            {boards.map(b => <button key={b.id} role="tab" aria-selected={current?.id === b.id} type="button" onClick={() => setSelected(b.id)} className={`rounded-full px-3 py-1.5 text-xs font-semibold cursor-pointer ${current?.id === b.id ? 'bg-slate-900 text-white dark:bg-slate-700' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{b.name} <span className="opacity-60">{b.taskCount}</span></button>)}
            {current && <button type="button" aria-label={`Delete board ${current.name}`} onClick={() => window.confirm(`Delete the board "${current.name}"?`) && void del.mutateAsync(current.id).then(() => setSelected(null))} className="ml-auto text-slate-400 hover:text-rose-600 cursor-pointer"><Trash2 className="h-4 w-4" /></button>}
          </div>
          {current && <Kanban key={current.id} board={current} />}
        </>
      )}
    </div>
  );
};
