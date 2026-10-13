import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Building2,
  User,
  CalendarClock,
  Star,
  ExternalLink,
} from 'lucide-react';
import type { AppointmentItem, AppointmentStatus } from '@propbot/shared';
import { useUpdateAppointmentStatus } from '../../services/appointments.service.js';
import { RescheduleModal } from './RescheduleModal.js';
import { AppointmentSurveyModal } from './AppointmentSurveyModal.js';

interface AppointmentsTableProps {
  appointments: AppointmentItem[];
  onRefresh?: () => void;
}

const STATUS_CONFIG: Record<
  AppointmentStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  scheduled: {
    label: 'Scheduled',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
  },
  confirmed: {
    label: 'Confirmed',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  completed: {
    label: 'Completed',
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
  },
  no_show: {
    label: 'No-show',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-900',
  },
  cancelled: {
    label: 'Cancelled',
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-200 dark:border-slate-700',
  },
  rescheduled: {
    label: 'Rescheduled',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
  },
};

export const AppointmentsTable: React.FC<AppointmentsTableProps> = ({ appointments }) => {
  const updateStatusMutation = useUpdateAppointmentStatus();
  const [selectedForReschedule, setSelectedForReschedule] = useState<AppointmentItem | null>(null);
  const [selectedForSurvey, setSelectedForSurvey] = useState<AppointmentItem | null>(null);

  const handleStatusChange = async (id: string, newStatus: AppointmentStatus) => {
    let cancellationReason: string | undefined;
    if (newStatus === 'cancelled') {
      const promptRes = window.prompt('Please provide a cancellation reason (optional):');
      if (promptRes === null) return; // user clicked cancel
      cancellationReason = promptRes.trim() || undefined;
    }

    await updateStatusMutation.mutateAsync({
      id,
      input: { status: newStatus, cancellationReason },
    });
  };

  const formatIST = (dateIso: string) => {
    try {
      return new Date(dateIso).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return dateIso;
    }
  };

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
            <tr>
              <th className="py-3.5 px-4">Visitor / Client</th>
              <th className="py-3.5 px-4">Project & Channel</th>
              <th className="py-3.5 px-4">Date & Time (IST)</th>
              <th className="py-3.5 px-4">Assigned Agent</th>
              <th className="py-3.5 px-4">Calendar Status</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
            {appointments.map(item => {
              const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.scheduled;
              return (
                <tr
                  key={item.id}
                  className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                >
                  {/* Visitor */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 font-bold text-xs uppercase shrink-0">
                        {item.leadName ? item.leadName.charAt(0) : 'V'}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {item.leadName || 'Anonymous Visitor'}
                        </span>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {item.leadPhone || item.leadEmail || 'No contact provided'}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Project & Source */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                      <Building2 className="h-3.5 w-3.5 text-slate-400" />
                      <span>{item.projectName || 'General Site Visit'}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 capitalize">
                      Source: {item.leadSource || 'Website Chat'}
                    </div>
                  </td>

                  {/* Date & Time */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
                      <Clock className="h-3.5 w-3.5 text-blue-500" />
                      <span>{formatIST(item.scheduledAt)}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Duration: {item.durationMinutes} mins
                    </div>
                  </td>

                  {/* Agent */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      <span>{item.assignedAgentName || 'Unassigned (Pool)'}</span>
                    </div>
                  </td>

                  {/* Calendar Status */}
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        item.calendarStatus === 'synced'
                          ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <Calendar className="h-3 w-3" />
                      {item.calendarStatus === 'synced' ? 'Synced (Google)' : 'Dashboard only'}
                    </span>
                  </td>

                  {/* Status Dropdown */}
                  <td className="py-3.5 px-4">
                    <select
                      value={item.status}
                      disabled={updateStatusMutation.isPending}
                      onChange={e => handleStatusChange(item.id, e.target.value as AppointmentStatus)}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="completed">Completed</option>
                      <option value="no_show">No-show</option>
                      <option value="rescheduled">Rescheduled</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedForReschedule(item)}
                        title="Reschedule site visit"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800 transition-colors"
                      >
                        <CalendarClock className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedForSurvey(item)}
                        title="Post-visit survey"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-purple-600 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Star className="h-4 w-4" />
                      </button>

                      {item.meetingLink && (
                        <a
                          href={item.meetingLink}
                          target="_blank"
                          rel="noreferrer"
                          title="Open Google Meet link"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-emerald-600 dark:hover:bg-slate-800 transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Reschedule Modal */}
      {selectedForReschedule && (
        <RescheduleModal
          isOpen={Boolean(selectedForReschedule)}
          onClose={() => setSelectedForReschedule(null)}
          appointment={selectedForReschedule}
        />
      )}

      {/* Post-Visit Survey Modal */}
      {selectedForSurvey && (
        <AppointmentSurveyModal
          isOpen={Boolean(selectedForSurvey)}
          onClose={() => setSelectedForSurvey(null)}
          appointment={selectedForSurvey}
        />
      )}
    </>
  );
};
