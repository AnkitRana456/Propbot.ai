import React, { useState } from 'react';
import {
  Calendar,
  Plus,
  Clock,
  Building2,
  ExternalLink,
} from 'lucide-react';
import { useAppointments } from '../../services/appointments.service.js';
import { BookAppointmentModal } from './BookAppointmentModal.js';
import { RescheduleModal } from './RescheduleModal.js';
import { AppointmentSurveyModal } from './AppointmentSurveyModal.js';
import type { AppointmentItem } from '@propbot/shared';

interface AppointmentsPanelProps {
  leadId: string;
  leadName?: string;
}

export const AppointmentsPanel: React.FC<AppointmentsPanelProps> = ({ leadId, leadName }) => {
  const { data, isLoading, refetch } = useAppointments({ leadId });
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [selectedForReschedule, setSelectedForReschedule] = useState<AppointmentItem | null>(null);
  const [selectedForSurvey, setSelectedForSurvey] = useState<AppointmentItem | null>(null);

  const appointmentsList = data?.items || [];

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Site Visits & Appointments
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            {appointmentsList.length} appointment{appointmentsList.length === 1 ? '' : 's'} on record
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsBookModalOpen(true)}
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-95 transition-all"
        >
          <Plus className="h-3.5 w-3.5" />
          Book Visit
        </button>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-xs text-slate-400">Loading appointments...</div>
      ) : appointmentsList.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500 dark:border-slate-800">
          <Calendar className="mx-auto h-8 w-8 text-blue-500 mb-2 opacity-60" />
          <p className="font-semibold text-slate-700 dark:text-slate-300">
            No site visits scheduled yet
          </p>
          <p className="mt-1 text-slate-400 max-w-xs mx-auto">
            Book a private property viewing appointment with automated Google Calendar sync and 24h reminders.
          </p>
          <button
            type="button"
            onClick={() => setIsBookModalOpen(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Plus className="h-3.5 w-3.5" />
            Schedule First Visit
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {appointmentsList.map(item => (
            <div
              key={item.id}
              className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-all hover:border-blue-200"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h5 className="font-semibold text-xs text-slate-900 dark:text-white">
                      {item.projectName || 'General Property Viewing'}
                    </h5>
                    <span className="text-[11px] text-slate-400">
                      {item.location || 'Site Sales Gallery'}
                    </span>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    item.status === 'scheduled'
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                      : item.status === 'confirmed'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : item.status === 'completed'
                          ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'
                          : item.status === 'no_show'
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {item.status.replace('_', ' ')}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                  <Clock className="h-3.5 w-3.5 text-blue-500" />
                  <span>{formatIST(item.scheduledAt)}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedForReschedule(item)}
                    className="text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Reschedule
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedForSurvey(item)}
                    className="text-[11px] font-medium text-purple-600 hover:underline dark:text-purple-400"
                  >
                    Survey
                  </button>
                  {item.meetingLink && (
                    <a
                      href={item.meetingLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-slate-400 hover:text-emerald-500"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {isBookModalOpen && (
        <BookAppointmentModal
          isOpen={isBookModalOpen}
          onClose={() => setIsBookModalOpen(false)}
          initialLeadId={leadId}
          initialLeadName={leadName}
          onSuccess={() => refetch()}
        />
      )}

      {selectedForReschedule && (
        <RescheduleModal
          isOpen={Boolean(selectedForReschedule)}
          onClose={() => {
            setSelectedForReschedule(null);
            refetch();
          }}
          appointment={selectedForReschedule}
        />
      )}

      {selectedForSurvey && (
        <AppointmentSurveyModal
          isOpen={Boolean(selectedForSurvey)}
          onClose={() => {
            setSelectedForSurvey(null);
            refetch();
          }}
          appointment={selectedForSurvey}
        />
      )}
    </div>
  );
};
