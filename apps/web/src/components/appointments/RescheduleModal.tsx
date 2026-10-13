import React, { useState } from 'react';
import { X, CalendarClock, Clock, AlertCircle } from 'lucide-react';
import {
  useRescheduleAppointment,
  useAvailableSlots,
} from '../../services/appointments.service.js';
import type { AppointmentItem } from '@propbot/shared';

interface RescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: AppointmentItem | null;
}

export const RescheduleModal: React.FC<RescheduleModalProps> = ({
  isOpen,
  onClose,
  appointment,
}) => {
  const rescheduleMutation = useRescheduleAppointment();

  const [date, setDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: slotsData, isLoading: slotsLoading } = useAvailableSlots(
    date,
    appointment?.projectId || undefined,
    appointment?.assignedAgentId || undefined,
  );

  if (!isOpen || !appointment) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) {
      setErrorMsg('Please select a time slot.');
      return;
    }

    try {
      setErrorMsg(null);
      const scheduledAt = new Date(`${date}T${selectedSlot}:00.000Z`).toISOString();
      await rescheduleMutation.mutateAsync({
        id: appointment.id,
        input: {
          scheduledAt,
          reason: reason.trim() || undefined,
        },
      });
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reschedule appointment';
      setErrorMsg(message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Reschedule Site Visit</h3>
              <p className="text-xs text-slate-500">
                Visitor: <span className="font-medium text-slate-700 dark:text-slate-300">{appointment.leadName}</span>
              </p>
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

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select New Date
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
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-800/60 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Available Time Slots
            </label>
            {slotsLoading ? (
              <div className="py-4 text-center text-xs text-slate-400">Loading open slots...</div>
            ) : slotsData?.slots && slotsData.slots.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                {slotsData.slots.map(slot => (
                  <button
                    key={slot.time}
                    type="button"
                    disabled={!slot.available}
                    onClick={() => setSelectedSlot(slot.time)}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 px-1 text-xs font-medium transition-all ${
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
                No open slots available for this date.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Reschedule Reason (Optional)
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
              placeholder="e.g. Buyer requested weekend slot due to office schedule"
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-800/60 dark:text-white"
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
              disabled={rescheduleMutation.isPending || !selectedSlot}
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {rescheduleMutation.isPending ? 'Rescheduling...' : 'Confirm New Time'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
