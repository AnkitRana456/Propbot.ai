import React, { useState } from 'react';
import {
  FolderOpen,
  ExternalLink,
  Copy,
  Check,
  Eye,
  Clock,
  Heart,
  Sparkles,
} from 'lucide-react';
import {
  useLeadShortlists,
  useCreateShortlistRoom,
} from '../../services/shortlist.service.js';

interface ShortlistPanelProps {
  leadId: string;
  leadName?: string;
}

export const ShortlistPanel: React.FC<ShortlistPanelProps> = ({ leadId, leadName }) => {
  const { data: shortlists = [], isLoading, refetch } = useLeadShortlists(leadId);
  const createShortlistMutation = useCreateShortlistRoom();
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const handleCreateRoom = async () => {
    await createShortlistMutation.mutateAsync({
      leadId,
      title: `Curated Properties for ${leadName || 'Lead'}`,
      expiresInDays: 14,
    });
    refetch();
  };

  const handleCopy = (shareableUrl: string, token: string) => {
    const fullUrl = window.location.origin + `/room/${token}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-24 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
        <div className="h-24 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            Smart Shortlist Rooms
          </h4>
          <p className="text-xs text-slate-500">
            Unguessable, interactive property rooms generated for this buyer
          </p>
        </div>

        <button
          onClick={handleCreateRoom}
          disabled={createShortlistMutation.isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {createShortlistMutation.isPending ? 'Generating...' : 'Generate New Room'}
        </button>
      </div>

      {shortlists.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 p-8 text-center">
          <FolderOpen className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-60" />
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
            No Shortlist Rooms Yet
          </p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Click "Generate New Room" to automatically match available inventory with this buyer's DNA and generate an interactive room.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {shortlists.map((room) => {
            const isExpired = new Date(room.expiresAt).getTime() < Date.now();
            return (
              <div
                key={room.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {room.title}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isExpired
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}
                      >
                        {isExpired ? 'Expired' : 'Active'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 mt-0.5">
                      Expires {new Date(room.expiresAt).toLocaleDateString()} • {room.items.length} Properties
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(room.shareableUrl, room.token)}
                      className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                      title="Copy Public Link"
                    >
                      {copiedToken === room.token ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <a
                      href={`/room/${room.token}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 text-primary hover:text-primary-hover rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                      title="Open Room"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {/* Telemetry Stats */}
                <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                  <span className="flex items-center gap-1 font-medium">
                    <Eye className="w-3.5 h-3.5 text-blue-500" />
                    {room.viewsCount} View{room.viewsCount !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1 font-medium">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    {room.totalTimeSpentSeconds}s Dwell Time
                  </span>
                  {room.favoriteProjectId && (
                    <span className="flex items-center gap-1 text-rose-500 font-semibold">
                      <Heart className="w-3.5 h-3.5 fill-rose-500" />
                      Top Favorite Detected
                    </span>
                  )}
                </div>

                {/* Shortlist Items Preview */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {room.items.map((item) => (
                    <span
                      key={item.id}
                      className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-300"
                    >
                      {item.project.name} ({item.matchScore}%)
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
