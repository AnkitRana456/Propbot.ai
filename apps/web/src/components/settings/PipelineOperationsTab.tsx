import React, { useState, useEffect } from 'react';
import { GitBranch, Tag, Bell, Plus, X, Check } from 'lucide-react';
import type { OperationsSettings } from '@propbot/shared';

interface PipelineOperationsTabProps {
  initialSettings?: OperationsSettings;
  onSave: (data: OperationsSettings) => Promise<void>;
}

export const PipelineOperationsTab: React.FC<PipelineOperationsTabProps> = ({
  initialSettings = {},
  onSave,
}) => {
  const [pipelineStages, setPipelineStages] = useState<string[]>(
    initialSettings.pipelineStages || [
      'New',
      'Contacted',
      'Qualified',
      'Visit Scheduled',
      'Negotiation',
      'Booked',
      'Lost',
    ],
  );
  const [tags, setTags] = useState<string[]>(
    initialSettings.tags || ['VIP', 'Hot Buyer', 'Investor', 'First-Time Buyer'],
  );
  const [newStage, setNewStage] = useState('');
  const [newTag, setNewTag] = useState('');
  const [slaMinutes, setSlaMinutes] = useState(
    initialSettings.notifications?.hotLeadSlaMinutes || 15,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (initialSettings.pipelineStages) setPipelineStages(initialSettings.pipelineStages);
    if (initialSettings.tags) setTags(initialSettings.tags);
    if (initialSettings.notifications?.hotLeadSlaMinutes) {
      setSlaMinutes(initialSettings.notifications.hotLeadSlaMinutes);
    }
  }, [initialSettings]);

  const handleAddStage = () => {
    if (newStage.trim() && !pipelineStages.includes(newStage.trim())) {
      setPipelineStages([...pipelineStages, newStage.trim()]);
      setNewStage('');
    }
  };

  const handleRemoveStage = (stage: string) => {
    if (pipelineStages.length <= 2) {
      alert('Pipeline must have at least 2 stages.');
      return;
    }
    setPipelineStages(pipelineStages.filter(s => s !== stage));
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccess(false);
    try {
      await onSave({
        pipelineStages,
        tags,
        notifications: {
          emailAlerts: true,
          whatsappAlerts: true,
          browserPush: true,
          hotLeadSlaMinutes: slaMinutes,
        },
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to update pipeline settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {savedSuccess && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-sm flex items-center gap-2">
          <Check className="w-4 h-4" />
          Operations settings saved successfully.
        </div>
      )}

      {/* Pipeline Stages */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-blue-600" />
          CRM Pipeline Stages
        </h3>
        <p className="text-xs text-slate-500">
          Customize conversion stages for your sales team and Kanban board
        </p>

        <div className="flex flex-wrap gap-2 pt-2">
          {pipelineStages.map(stage => (
            <span
              key={stage}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            >
              {stage}
              <button
                type="button"
                onClick={() => handleRemoveStage(stage)}
                className="hover:text-rose-500 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          <input
            type="text"
            value={newStage}
            onChange={e => setNewStage(e.target.value)}
            placeholder="Add new stage name (e.g. Loan Sanctioned)..."
            className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          />
          <button
            type="button"
            onClick={handleAddStage}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Stage
          </button>
        </div>
      </div>

      {/* Buyer Tags */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
          <Tag className="w-4 h-4 text-emerald-600" />
          Lead & Buyer DNA Tags
        </h3>

        <div className="flex flex-wrap gap-2 pt-2">
          {tags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
            >
              {tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="hover:text-rose-500 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          <input
            type="text"
            value={newTag}
            onChange={e => setNewTag(e.target.value)}
            placeholder="Add new tag (e.g. NRI Buyer)..."
            className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          />
          <button
            type="button"
            onClick={handleAddTag}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Tag
          </button>
        </div>
      </div>

      {/* Hot Lead SLA */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-600" />
          Speed-to-Lead SLA Target
        </h3>
        <p className="text-xs text-slate-500">
          Maximum time allowed for sales agents to make first contact with a hot lead before SLA breach alerts trigger
        </p>

        <div className="flex items-center gap-4 pt-2">
          <input
            type="range"
            min={5}
            max={60}
            step={5}
            value={slaMinutes}
            onChange={e => setSlaMinutes(Number(e.target.value))}
            className="flex-1 accent-blue-600 cursor-pointer"
          />
          <span className="font-bold text-sm text-slate-900 dark:text-white w-20 text-right">
            {slaMinutes} mins
          </span>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSaving}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-md transition-all disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save Operations Settings'}
        </button>
      </div>
    </form>
  );
};
