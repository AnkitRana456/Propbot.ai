import React, { useState } from 'react';
import { X, CheckSquare } from 'lucide-react';
import type { TaskType, LeadPriority } from '@propbot/shared';
import { useCreateTask } from '../../services/crm.service.js';

interface CreateTaskModalProps {
  isOpen: boolean;
  leadId: string;
  leadName?: string;
  onClose: () => void;
}

const TASK_TYPES: { id: TaskType; label: string }[] = [
  { id: 'follow_up', label: 'Follow-up Call' },
  { id: 'call', label: 'Phone Call' },
  { id: 'whatsapp', label: 'WhatsApp Message' },
  { id: 'site_visit', label: 'Site Visit' },
  { id: 'email', label: 'Send Email' },
  { id: 'document', label: 'Send Brochure / Collateral' },
];

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  leadId,
  leadName,
  onClose,
}) => {
  const createTaskMutation = useCreateTask();

  const [title, setTitle] = useState('');
  const [type, setType] = useState<TaskType>('follow_up');
  const [priority, setPriority] = useState<LeadPriority>('medium');
  const [dueDate, setDueDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    return tomorrow.toISOString().slice(0, 16);
  });
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    await createTaskMutation.mutateAsync({
      leadId,
      title: title.trim(),
      type,
      priority,
      dueDate: new Date(dueDate).toISOString(),
      description: description.trim() || undefined,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <CheckSquare className="h-5 w-5" />
            <h3 className="font-bold text-slate-900 dark:text-white">
              Schedule Task / Follow-up
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {leadName && (
            <p className="text-xs text-slate-500">
              Scheduling follow-up for <span className="font-bold text-slate-800 dark:text-white">{leadName}</span>
            </p>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Task Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Call to discuss 3BHK floor plan"
              required
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Task Type
              </label>
              <select
                value={type}
                onChange={e => setType(e.target.value as TaskType)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {TASK_TYPES.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Priority
              </label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as LeadPriority)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Due Date & Time *
            </label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Details / Notes (Optional)
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Any specific instructions or topics to discuss..."
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={createTaskMutation.isPending}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createTaskMutation.isPending || !title.trim()}
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 shadow-sm cursor-pointer"
            >
              {createTaskMutation.isPending ? 'Scheduling...' : 'Save Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
