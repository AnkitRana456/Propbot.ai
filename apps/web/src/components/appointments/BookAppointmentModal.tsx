import React, { useState } from 'react';
import { X, CalendarPlus, Clock, AlertCircle } from 'lucide-react';
import {
  useCreateAppointment,
  useAvailableSlots,
} from '../../services/appointments.service.js';
import { useProjects } from '../../services/inventory.service.js';
import { useLeads } from '../../services/leads.service.js';
import type { AppointmentType, LeadItemResponse } from '@propbot/shared';

interface BookAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLeadId?: string;
  initialLeadName?: string;
  onSuccess?: () => void;
}

export const BookAppointmentModal: React.FC<BookAppointmentModalProps> = ({
  isOpen,
  onClose,
  initialLeadId,
  initialLeadName,
  onSuccess,
}) => {
  const createMutation = useCreateAppointment();
  const { data: projectsData } = useProjects({ limit: 100 });
  const { data: leadsData } = useLeads({ limit: 50 });

  const [leadId, setLeadId] = useState<string>(initialLeadId || '');
  const [projectId, setProjectId] = useState<string>('');
  const [appointmentType, setAppointmentType] = useState<AppointmentType>('site_visit');
  const [date, setDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: slotsData, isLoading: slotsLoading } = useAvailableSlots(
    date,
    projectId || undefined,
  );

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveLeadId = initialLeadId || leadId;
    if (!effectiveLeadId) {
      setErrorMsg('Please select a visitor / lead.');
      return;
    }
    if (!selectedSlot) {
      setErrorMsg('Please select a scheduled time slot.');
      return;
    }

    try {
      setErrorMsg(null);
      const scheduledAt = new Date(`${date}T${selectedSlot}:00.000Z`).toISOString();
      await createMutation.mutateAsync({
        leadId: effectiveLeadId,
        projectId: projectId || undefined,
        appointmentType,
        scheduledAt,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      onSuccess?.();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to book appointment';
      setErrorMsg(message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              <CalendarPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Book Site Visit Appointment</h3>
              <p className="text-xs text-slate-500">Schedule prospective buyer visit with automated reminders</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Visitor Selection */}
          {initialLeadId ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Visitor</span>
              <p className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                {initialLeadName || 'Current Lead'}
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Select Visitor / Lead *
              </label>
              <select
                value={leadId}
                onChange={e => setLeadId(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-800/60 dark:text-white"
              >
                <option value="">Choose a lead...</option>
                {leadsData?.items?.map((l: LeadItemResponse) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.phone || l.email || 'No contact'}) - {l.status}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Project Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Property Project (Optional)
            </label>
            <select
              value={projectId}
              onChange={e => {
                setProjectId(e.target.value);
                setSelectedSlot('');
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-800/60 dark:text-white"
            >
              <option value="">General Consultation / All Projects</option>
              {projectsData?.items?.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} - {p.location}
                </option>
              ))}
            </select>
          </div>

          {/* Appointment Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Appointment Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['site_visit', 'consultation', 'video_call'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setAppointmentType(type)}
                  className={`rounded-xl border py-2 px-2 text-xs font-medium capitalize transition-all ${
                    appointmentType === type
                      ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 shadow-sm'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400'
                  }`}
                >
                  {type.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Visit Date *
            </label>
            <input
              type="date"
              value={date}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => {
                setDate(e.target.value);
                setSelectedSlot('');
              }}
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-800/60 dark:text-white"
            />
          </div>

          {/* Available Slots */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Available Time Slots *
            </label>
            {slotsLoading ? (
              <div className="py-4 text-center text-xs text-slate-400">Loading open slots...</div>
            ) : slotsData?.slots && slotsData.slots.length > 0 ? (
              <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto p-1">
                {slotsData.slots.map(slot => (
                  <button
                    key={slot.time}
                    type="button"
                    disabled={!slot.available}
                    onClick={() => setSelectedSlot(slot.time)}
                    className={`flex items-center justify-center gap-1 rounded-lg border py-2 px-1 text-xs font-medium transition-all ${
                      selectedSlot === slot.time
                        ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                        : slot.available
                          ? 'border-slate-200 bg-slate-50/50 text-slate-700 hover:border-blue-300 hover:bg-blue-50/50 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200'
                          : 'cursor-not-allowed border-slate-100 bg-slate-100 text-slate-300 dark:border-slate-800/40 dark:bg-slate-900/40 dark:text-slate-600'
                    }`}
                  >
                    <Clock className="h-3 w-3" />
                    {slot.time}
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-lg bg-slate-50 p-3 text-center text-xs text-slate-400 dark:bg-slate-800/40">
                No open slots for this date.
              </p>
            )}
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Location / Venue (Optional)
            </label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Skyline Heights Sales Lounge, Site Gallery 2"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-800/60 dark:text-white"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Internal Notes
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Buyer is arriving with family to evaluate 3BHK sample flat."
              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-800/60 dark:text-white"
            />
          </div>

          <div className="mt-6 flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !selectedSlot}
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Booking...' : 'Confirm Site Visit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
