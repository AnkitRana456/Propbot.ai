import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  Trash2,
  Edit2,
  X,
  AlertCircle,
  Tag,
  Loader2,
  Zap,
} from 'lucide-react';
import type {
  ObjectionPlaybook,
  ObjectionCategory,
} from '@propbot/shared';
import {
  usePlaybooks,
  useCreatePlaybook,
  useUpdatePlaybook,
  useDeletePlaybook,
} from '../../services/copilot.service.js';

interface ObjectionPlaybooksTabProps {
  chatbotId: string;
}

const CATEGORIES: { label: string; value: ObjectionCategory }[] = [
  { label: 'Price Too High', value: 'price_too_high' },
  { label: 'Possession Date Too Far', value: 'possession_far' },
  { label: 'Location & Connectivity', value: 'location_connectivity' },
  { label: 'Competitor Comparison', value: 'competitor_comparison' },
  { label: 'Amenities Concern', value: 'amenities_concern' },
  { label: 'Builder Reputation', value: 'builder_reputation' },
  { label: 'Other Objections', value: 'other' },
];

export function ObjectionPlaybooksTab({ chatbotId }: ObjectionPlaybooksTabProps) {
  const { data, isLoading } = usePlaybooks(chatbotId);
  const createMutation = useCreatePlaybook();
  const updateMutation = useUpdatePlaybook();
  const deleteMutation = useDeletePlaybook();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [category, setCategory] = useState<ObjectionCategory>('price_too_high');
  const [title, setTitle] = useState('');
  const [triggerKeywordsText, setTriggerKeywordsText] = useState('');
  const [rebuttalText, setRebuttalText] = useState('');
  const [suggestedAction, setSuggestedAction] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const resetForm = () => {
    setCategory('price_too_high');
    setTitle('');
    setTriggerKeywordsText('');
    setRebuttalText('');
    setSuggestedAction('');
    setFormError(null);
    setIsAdding(false);
    setEditingId(null);
  };

  const handleStartEdit = (playbook: ObjectionPlaybook) => {
    setEditingId(playbook.id);
    setCategory(playbook.category);
    setTitle(playbook.title);
    setTriggerKeywordsText(playbook.triggerKeywords.join(', '));
    setRebuttalText(playbook.rebuttalText);
    setSuggestedAction(playbook.suggestedAction || '');
    setIsAdding(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const keywords = triggerKeywordsText
      .split(',')
      .map(k => k.trim())
      .filter(Boolean);

    if (!title.trim()) {
      setFormError('Please enter a playbook title or objection trigger.');
      return;
    }
    if (keywords.length === 0) {
      setFormError('Please provide at least one trigger keyword.');
      return;
    }
    if (rebuttalText.trim().length < 10) {
      setFormError('Rebuttal text must be at least 10 characters.');
      return;
    }

    try {
      if (editingId) {
        await updateMutation.mutateAsync({
          id: editingId,
          chatbotId,
          input: {
            category,
            title: title.trim(),
            triggerKeywords: keywords,
            rebuttalText: rebuttalText.trim(),
            suggestedAction: suggestedAction.trim() || undefined,
          },
        });
      } else {
        await createMutation.mutateAsync({
          chatbotId,
          category,
          title: title.trim(),
          triggerKeywords: keywords,
          rebuttalText: rebuttalText.trim(),
          suggestedAction: suggestedAction.trim() || undefined,
          isActive: true,
        });
      }
      resetForm();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save playbook');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this objection playbook?')) return;
    await deleteMutation.mutateAsync({ id, chatbotId });
  };

  const playbooks = data?.playbooks || [];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            Agency Objection-Handling Playbooks
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Arm your AI and sales agents with verified talking points for buyer hesitations, price objections, and competitor comparisons.
          </p>
        </div>
        {!isAdding && !editingId && (
          <button
            type="button"
            onClick={() => {
              resetForm();
              setIsAdding(true);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition"
          >
            <Plus className="h-4 w-4" /> Add Playbook
          </button>
        )}
      </div>

      {/* Editor Modal / Inline Form */}
      {(isAdding || editingId) && (
        <form
          onSubmit={handleSave}
          className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 dark:border-indigo-900/60 dark:bg-indigo-950/20 space-y-4 shadow-sm"
        >
          <div className="flex items-center justify-between border-b border-indigo-100 dark:border-indigo-900/50 pb-3">
            <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">
              {editingId ? 'Edit Objection Playbook' : 'New Objection Playbook'}
            </h4>
            <button
              type="button"
              onClick={resetForm}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {formError && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Objection Category
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as ObjectionCategory)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Playbook Title / Trigger Question
              </label>
              <input
                type="text"
                placeholder="e.g. Price is too high compared to nearby projects"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Trigger Keywords (comma-separated)
            </label>
            <input
              type="text"
              placeholder="price, expensive, costly, discount, cheaper, rates"
              value={triggerKeywordsText}
              onChange={e => setTriggerKeywordsText(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              AI & Agent Rebuttal Script (Verified Truth)
            </label>
            <textarea
              rows={3}
              placeholder="Detail the verified counter-points, value additions, carpet area efficiency, flexible payment plans..."
              value={rebuttalText}
              onChange={e => setRebuttalText(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Suggested Follow-up Action (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Offer sample flat walkthrough or private developer pricing breakdown"
              value={suggestedAction}
              onChange={e => setSuggestedAction(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              {editingId ? 'Update Playbook' : 'Create Playbook'}
            </button>
          </div>
        </form>
      )}

      {/* Playbooks List */}
      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        </div>
      ) : playbooks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-800">
          <BookOpen className="mx-auto h-8 w-8 text-slate-400" />
          <h4 className="mt-2 text-xs font-bold text-slate-700 dark:text-slate-300">
            No Objection Playbooks Configured
          </h4>
          <p className="mt-1 text-xs text-slate-500">
            Add playbooks to provide the AI chatbot and human agents with pre-approved responses for customer hesitations.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {playbooks.map(pb => (
            <div
              key={pb.id}
              className="rounded-2xl border border-slate-200 bg-white p-4.5 dark:border-slate-800 dark:bg-slate-900 shadow-2xs space-y-2.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 uppercase">
                      {pb.category.replace(/_/g, ' ')}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      {pb.title}
                    </h4>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {pb.triggerKeywords.map((kw, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-0.5 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      >
                        <Tag className="h-2.5 w-2.5" /> {kw}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(pb)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                    title="Edit Playbook"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(pb.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                    title="Delete Playbook"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Rebuttal Body */}
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-800/50 dark:text-slate-300 border border-slate-100 dark:border-slate-800 leading-relaxed">
                <span className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">
                  Rebuttal Response:
                </span>
                {pb.rebuttalText}
              </div>

              {/* Suggested Action if any */}
              {pb.suggestedAction && (
                <div className="flex items-center gap-1.5 text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                  <Zap className="h-3.5 w-3.5" />
                  <span>Action: {pb.suggestedAction}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
