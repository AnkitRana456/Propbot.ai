import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { ProjectItem } from '@propbot/shared';
import { useUpdateProject } from '../../services/inventory.service.js';
import {
  ProjectMediaFields,
  mediaFromProject,
  mediaToPayload,
  validateMedia,
  type ProjectMediaValue,
} from './ProjectMediaFields.js';

/** "Chat media" tab of the project page: edit the photos, plans and map the chatbot shows. */
export const ProjectMediaEditor: React.FC<{ project: ProjectItem }> = ({ project }) => {
  const initial = useMemo(() => mediaFromProject(project), [project]);
  const [value, setValue] = useState<ProjectMediaValue>(initial);
  const [saved, setSaved] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const update = useUpdateProject();

  // Reload the form when the project is refetched after a save
  useEffect(() => {
    setValue(initial);
  }, [initial]);

  const errors = validateMedia(value);
  const hasErrors = Object.keys(errors).length > 0;
  const dirty = JSON.stringify(value) !== JSON.stringify(initial);

  const save = async () => {
    setSaved(false);
    setSubmitError(null);
    if (hasErrors) return;
    try {
      await update.mutateAsync({ id: project.id, input: mediaToPayload(value) });
      setSaved(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not save chat media.');
    }
  };

  return (
    <div className="editorial-card p-5 space-y-4">
      <div>
        <div className="blueprint-label">Chat Media &bull; shown by the AI assistant</div>
        <p className="mt-1 text-[11px] text-[var(--text-muted)]">
          The chatbot attaches these automatically: highlight photos on the first message, floor plans when a visitor asks about
          a BHK or carpet area, the master plan, and an embedded map for location questions.
        </p>
      </div>

      <ProjectMediaFields value={value} onChange={v => { setSaved(false); setValue(v); }} errors={errors} />

      {submitError && <p className="text-xs text-rose-600">{submitError}</p>}
      <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] pt-3">
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
            <CheckCircle2 className="h-4 w-4" /> Saved
          </span>
        )}
        <button
          type="button"
          onClick={save}
          disabled={!dirty || hasErrors || update.isPending}
          className="btn-terracotta px-5 py-2 text-xs font-semibold disabled:opacity-50"
        >
          {update.isPending ? 'Saving…' : 'Save chat media'}
        </button>
      </div>
    </div>
  );
};
