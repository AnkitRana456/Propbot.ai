import React, { useState } from 'react';
import { X, Calendar, CheckCircle2, AlertCircle, RefreshCw, Unlink } from 'lucide-react';
import { useCalendarStatus, useDisconnectCalendar } from '../../services/appointments.service.js';
import { apiRequest } from '../../services/api-client.js';

interface CalendarSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CalendarSetupModal: React.FC<CalendarSetupModalProps> = ({ isOpen, onClose }) => {
  const { data: status, isLoading, refetch } = useCalendarStatus();
  const disconnectMutation = useDisconnectCalendar();
  const [connecting, setConnecting] = useState(false);

  if (!isOpen) return null;

  const handleConnect = async () => {
    try {
      setConnecting(true);
      const res = await apiRequest<{ success: boolean; data: { url: string } }>(
        '/api/appointments/calendar/oauth-url',
      );
      if (res.data?.url) {
        window.location.href = res.data.url;
      }
    } catch (err) {
      console.error('Failed to get calendar auth URL:', err);
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnectMutation.mutateAsync();
    refetch();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Google Calendar Sync</h3>
              <p className="text-xs text-slate-500">Two-way site visit event synchronization</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          ) : status?.isConnected ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                    Connected to Google Calendar
                  </h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                    All site visit bookings and reschedules are automatically mirrored to your calendar with Google Meet links.
                  </p>
                  <p className="text-[11px] text-slate-500 mt-2">
                    Primary Calendar Active
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-emerald-100 dark:border-emerald-900/30 flex justify-end">
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={disconnectMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg dark:hover:bg-rose-950/30 transition-colors"
                >
                  <Unlink className="h-3.5 w-3.5" />
                  Disconnect Calendar
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-white">
                    Not Connected
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Connect your Google Calendar to synchronize scheduled site visits, avoid conflicts, and invite clients directly.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleConnect}
                disabled={connecting}
                className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-500/20"
              >
                {connecting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Calendar className="h-4 w-4" />
                )}
                Connect Google Calendar
              </button>
            </div>
          )}

          <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60 text-xs text-slate-500 leading-relaxed">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Feature Capabilities:</span>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>Creates event with project location or Google Meet</li>
              <li>Two-way status updates on reschedule and cancellation</li>
              <li>Sends attendee invitations to client and assigned agent</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
