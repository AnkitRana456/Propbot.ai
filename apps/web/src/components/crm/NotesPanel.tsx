import React, { useState } from 'react';
import { FileText, Send, Trash2 } from 'lucide-react';
import { useLeadNotes, useCreateLeadNote, useDeleteLeadNote } from '../../services/crm.service.js';
import { Skeleton } from '../common/Skeleton.js';

interface NotesPanelProps {
  leadId: string;
}

export const NotesPanel: React.FC<NotesPanelProps> = ({ leadId }) => {
  const { data: notes, isLoading } = useLeadNotes(leadId);
  const createMutation = useCreateLeadNote();
  const deleteMutation = useDeleteLeadNote();

  const [content, setContent] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    await createMutation.mutateAsync({ leadId, content });
    setContent('');
  };

  return (
    <div className="space-y-4">
      {/* Note Composer */}
      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Add an internal collaboration note or meeting summary..."
          rows={3}
          className="w-full resize-none bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white"
        />
        <div className="flex items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-800">
          <span className="text-[10px] text-slate-400">Notes are visible to authorized team members</span>
          <button
            type="submit"
            disabled={createMutation.isPending || !content.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Send className="h-3 w-3" />
            {createMutation.isPending ? 'Saving...' : 'Add Note'}
          </button>
        </div>
      </form>

      {/* Notes List */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      ) : notes && notes.length > 0 ? (
        <div className="space-y-3">
          {notes.map(note => (
            <div
              key={note.id}
              className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 transition-colors dark:border-slate-800 dark:bg-slate-800/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                    {note.userName[0]?.toUpperCase()}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {note.userName}
                    </span>
                    <span className="ml-1.5 text-[10px] text-slate-400 font-medium">
                      ({note.userRole})
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400">
                    {new Date(note.createdAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <button
                    onClick={() => deleteMutation.mutate({ noteId: note.id, leadId })}
                    className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                    title="Delete note"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <p className="mt-2.5 whitespace-pre-wrap text-xs text-slate-700 dark:text-slate-300">
                {note.content}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center text-xs text-slate-400">
          <FileText className="h-8 w-8 mb-2 opacity-50" />
          <span>No notes added for this lead yet.</span>
        </div>
      )}
    </div>
  );
};
