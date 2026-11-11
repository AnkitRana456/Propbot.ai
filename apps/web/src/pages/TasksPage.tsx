import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckSquare, Phone, Square, Trash2 } from 'lucide-react';
import type { TaskItem } from '@propbot/shared';
import { PageHeader } from '../components/layout/PageHeader.js';
import { Tabs, TabPanel } from '../components/ui/Tabs.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { Skeleton } from '../components/common/Skeleton.js';
import { useAuth } from '../contexts/AuthContext.js';
import { useDeleteTask, useTasks, useUpdateTask } from '../services/crm.service.js';
import { formatDateTime } from '../lib/format.js';

type Bucket = 'overdue' | 'today' | 'upcoming' | 'done';

const EMPTY: Record<Bucket, string> = {
  overdue: 'Nothing is overdue. Nice work.',
  today: 'Nothing else is due today.',
  upcoming: 'No follow-ups are scheduled after today.',
  done: 'Finished follow-ups will show here.',
};

/** Which tab a task belongs on; cancelled tasks are left out. */
export function bucketOf(task: Pick<TaskItem, 'status' | 'dueDate'>, now: Date = new Date()): Bucket | null {
  if (task.status === 'completed') return 'done';
  if (task.status !== 'pending') return null;
  const due = new Date(task.dueDate).getTime();
  if (due < now.getTime()) return 'overdue';
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  return due <= endOfToday.getTime() ? 'today' : 'upcoming';
}

/** Every follow-up across all leads, so nobody has to open each lead to see what is due. */
export const TasksPage: React.FC = () => {
  const { user } = useAuth();
  const [mine, setMine] = useState(true);
  const [tab, setTab] = useState<Bucket>('overdue');
  const { data, isLoading, isError } = useTasks(mine && user?.id ? { assignedUserId: user.id } : undefined);
  const update = useUpdateTask();
  const remove = useDeleteTask();

  const groups: Record<Bucket, TaskItem[]> = { overdue: [], today: [], upcoming: [], done: [] };
  for (const t of data?.items ?? []) {
    const b = bucketOf(t);
    if (b) groups[b].push(t);
  }
  for (const b of ['overdue', 'today', 'upcoming'] as const) groups[b].sort((a, z) => a.dueDate.localeCompare(z.dueDate));
  const tabs = (['overdue', 'today', 'upcoming', 'done'] as const).map(id => ({ id, label: id[0]!.toUpperCase() + id.slice(1), count: groups[id].length }));
  const list = groups[tab];

  return (
    <div>
      <PageHeader
        title="Tasks"
        description={
          <>
            Calls, messages and follow-ups due across every lead. Add a task from a lead in{' '}
            <Link to="/leads" className="font-semibold text-accent underline-offset-2 hover:underline">Leads</Link>.
          </>
        }
        action={
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-text">
            <input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)} className="h-4 w-4 accent-accent" />
            Only my tasks
          </label>
        }
      />

      <Tabs tabs={tabs} value={tab} onChange={id => setTab(id as Bucket)} label="Tasks by due date" />

      <TabPanel id={tab} value={tab} className="mt-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : isError ? (
          <p role="alert" className="rounded-xl border border-danger/40 bg-surface p-4 text-sm text-danger">Tasks could not be loaded. Refresh to try again.</p>
        ) : list.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface">
            <EmptyState title={`No ${tab} tasks`} description={EMPTY[tab]} icon={<CheckSquare className="h-7 w-7" />} />
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {list.map(task => {
              const done = task.status === 'completed';
              return (
                <li key={task.id} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-2">
                  <button
                    type="button"
                    aria-label={done ? `Reopen ${task.title}` : `Mark ${task.title} done`}
                    onClick={() => update.mutate({ taskId: task.id, leadId: task.leadId, input: { status: done ? 'pending' : 'completed' } })}
                    className="mt-0.5 rounded text-text-muted hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {done ? <CheckSquare className="h-5 w-5 text-success" /> : <Square className="h-5 w-5" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold ${done ? 'text-text-muted line-through' : 'text-text'}`}>{task.title}</p>
                    {task.description && <p className="mt-0.5 line-clamp-2 text-xs text-text-muted">{task.description}</p>}
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 font-semibold capitalize text-text">{task.type.replace('_', ' ')}</span>
                      <span className={tab === 'overdue' ? 'font-semibold text-danger' : ''}>Due {formatDateTime(task.dueDate)}</span>
                      <span>{task.leadName || 'Unknown lead'}</span>
                      {task.leadPhone && (
                        <a href={`tel:${task.leadPhone}`} className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">
                          <Phone aria-hidden className="h-3 w-3" />
                          {task.leadPhone}
                        </a>
                      )}
                      {!mine && <span>{task.assignedUserName || 'Unassigned'}</span>}
                      {task.priority !== 'medium' && <span className="capitalize">{task.priority} priority</span>}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete ${task.title}`}
                    onClick={() => window.confirm(`Delete "${task.title}"?`) && remove.mutate({ taskId: task.id, leadId: task.leadId })}
                    className="rounded p-1 text-text-muted hover:text-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </TabPanel>
    </div>
  );
};

export default TasksPage;
