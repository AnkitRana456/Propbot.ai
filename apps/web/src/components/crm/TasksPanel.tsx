import React, { useState } from 'react';
import {
  CheckSquare,
  Square,
  Plus,
  Clock,
  AlertCircle,
  Phone,
  MessageSquare,
  Calendar,
  FileText,
  Mail,
  Trash2,
} from 'lucide-react';
import type { TaskItem, TaskType } from '@propbot/shared';
import { useTasks, useUpdateTask, useDeleteTask } from '../../services/crm.service.js';
import { CreateTaskModal } from './CreateTaskModal.js';
import { Skeleton } from '../common/Skeleton.js';

interface TasksPanelProps {
  leadId: string;
  leadName?: string;
}

export const TasksPanel: React.FC<TasksPanelProps> = ({ leadId, leadName }) => {
  const { data: tasksData, isLoading } = useTasks({ leadId });
  const updateTaskMutation = useUpdateTask();
  const deleteTaskMutation = useDeleteTask();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [filter, setFilter] = useState<'pending' | 'completed' | 'all'>('pending');

  const tasks = tasksData?.items || [];
  const filteredTasks = tasks.filter(t => {
    if (filter === 'pending') return t.status === 'pending';
    if (filter === 'completed') return t.status === 'completed';
    return true;
  });

  const getTaskIcon = (type: TaskType) => {
    switch (type) {
      case 'call':
        return <Phone className="h-3.5 w-3.5 text-blue-500" />;
      case 'whatsapp':
        return <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />;
      case 'site_visit':
        return <Calendar className="h-3.5 w-3.5 text-amber-500" />;
      case 'email':
        return <Mail className="h-3.5 w-3.5 text-purple-500" />;
      case 'document':
        return <FileText className="h-3.5 w-3.5 text-cyan-500" />;
      default:
        return <Clock className="h-3.5 w-3.5 text-slate-500" />;
    }
  };

  const handleToggleComplete = (task: TaskItem) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    updateTaskMutation.mutate({
      taskId: task.id,
      leadId,
      input: { status: newStatus },
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Actions Row */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
        <div className="flex items-center gap-1.5">
          {(['pending', 'completed', 'all'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition-colors cursor-pointer ${
                filter === tab
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Task
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : filteredTasks.length > 0 ? (
        <div className="space-y-2.5">
          {filteredTasks.map(task => {
            const isCompleted = task.status === 'completed';
            return (
              <div
                key={task.id}
                className={`flex items-start justify-between gap-3 rounded-xl border p-3 transition-colors ${
                  isCompleted
                    ? 'border-slate-100 bg-slate-50/50 opacity-70 dark:border-slate-800 dark:bg-slate-900/40'
                    : task.isOverdue
                      ? 'border-rose-200 bg-rose-50/40 dark:border-rose-900/50 dark:bg-rose-950/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => handleToggleComplete(task)}
                    className="mt-0.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                  >
                    {isCompleted ? (
                      <CheckSquare className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {getTaskIcon(task.type)}
                        {task.type.replace('_', ' ')}
                      </span>
                      <h4
                        className={`text-xs font-bold ${
                          isCompleted
                            ? 'line-through text-slate-400'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {task.title}
                      </h4>
                    </div>

                    {task.description && (
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        {task.description}
                      </p>
                    )}

                    <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-400">
                      <span
                        className={`flex items-center gap-1 font-medium ${
                          task.isOverdue && !isCompleted
                            ? 'text-rose-600 dark:text-rose-400 font-bold'
                            : ''
                        }`}
                      >
                        <Clock className="h-3 w-3" />
                        {new Date(task.dueDate).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>

                      {task.isOverdue && !isCompleted && (
                        <span className="flex items-center gap-0.5 text-rose-600 font-bold">
                          <AlertCircle className="h-3 w-3" /> Overdue
                        </span>
                      )}

                      <span>Assignee: {task.assignedUserName || 'Agent'}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => deleteTaskMutation.mutate({ taskId: task.id, leadId })}
                  className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                  title="Delete task"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center text-xs text-slate-400">
          <CheckSquare className="h-8 w-8 mb-2 opacity-50" />
          <span>No {filter} tasks for this lead.</span>
        </div>
      )}

      {isCreateOpen && (
        <CreateTaskModal
          isOpen={isCreateOpen}
          leadId={leadId}
          leadName={leadName}
          onClose={() => setIsCreateOpen(false)}
        />
      )}
    </div>
  );
};
