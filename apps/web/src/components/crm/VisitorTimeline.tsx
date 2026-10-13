import React, { useState } from 'react';
import {
  MessageSquare,
  Globe,
  GitBranch,
  Flame,
  UserCheck,
  FileText,
  CheckCircle2,
  PhoneCall,
  FileDown,
  Layout,
  Clock,
  Filter,
} from 'lucide-react';
import { useVisitorTimeline } from '../../services/crm.service.js';
import { Skeleton } from '../common/Skeleton.js';

interface VisitorTimelineProps {
  leadId: string;
}

export const VisitorTimeline: React.FC<VisitorTimelineProps> = ({ leadId }) => {
  const { data: timelineData, isLoading } = useVisitorTimeline(leadId);
  const [filterType, setFilterType] = useState<string>('all');

  if (isLoading) {
    return (
      <div className="space-y-4 py-2">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    );
  }

  const items = timelineData?.items || [];

  const filteredItems = filterType === 'all'
    ? items
    : items.filter(item => {
        if (filterType === 'chat') return item.activityType.includes('chat') || item.activityType.includes('message');
        if (filterType === 'status') return item.activityType.includes('status') || item.activityType.includes('intent');
        if (filterType === 'tasks') return item.activityType.includes('task') || item.activityType.includes('note');
        if (filterType === 'calls') return item.activityType.includes('call') || item.activityType.includes('assign');
        return true;
      });

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'chat_message':
      case 'message_received':
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case 'page_view':
      case 'website_visit':
        return <Globe className="h-4 w-4 text-indigo-500" />;
      case 'status_changed':
        return <GitBranch className="h-4 w-4 text-emerald-500" />;
      case 'intent_changed':
        return <Flame className="h-4 w-4 text-amber-500" />;
      case 'lead_assigned':
        return <UserCheck className="h-4 w-4 text-purple-500" />;
      case 'note_added':
        return <FileText className="h-4 w-4 text-sky-500" />;
      case 'task_created':
      case 'task_completed':
        return <CheckCircle2 className="h-4 w-4 text-teal-500" />;
      case 'call_logged':
        return <PhoneCall className="h-4 w-4 text-orange-500" />;
      case 'brochure_opened':
        return <FileDown className="h-4 w-4 text-rose-500" />;
      case 'shortlist_room_viewed':
        return <Layout className="h-4 w-4 text-violet-500" />;
      default:
        return <Clock className="h-4 w-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Category Filter Chips */}
      <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
        <Filter className="h-3.5 w-3.5 text-slate-400 mr-1" />
        {[
          { id: 'all', label: 'All Activities' },
          { id: 'chat', label: 'Chat & Messages' },
          { id: 'status', label: 'Stage & Intent' },
          { id: 'tasks', label: 'Tasks & Notes' },
          { id: 'calls', label: 'Calls & Assignment' },
        ].map(chip => (
          <button
            key={chip.id}
            onClick={() => setFilterType(chip.id)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
              filterType === chip.id
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center text-xs text-slate-400">
          <Clock className="h-8 w-8 mb-2 opacity-50" />
          <span>No timeline events found for this filter.</span>
        </div>
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
          {filteredItems.map(item => (
            <div key={item.id} className="relative group">
              {/* Dot Icon Anchor */}
              <div className="absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                {getActivityIcon(item.activityType)}
              </div>

              {/* Event Content */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 transition-colors hover:border-slate-200 dark:border-slate-800/80 dark:bg-slate-800/40 dark:hover:border-slate-700">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    {item.title}
                  </h4>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {new Date(item.createdAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {item.description && (
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    {item.description}
                  </p>
                )}

                {item.metadata && Object.keys(item.metadata).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-slate-400">
                    {Object.entries(item.metadata)
                      .filter(([_, v]) => typeof v === 'string' || typeof v === 'number')
                      .slice(0, 3)
                      .map(([k, v]) => (
                        <span key={k} className="rounded bg-white px-1.5 py-0.5 border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                          {k}: {String(v)}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
