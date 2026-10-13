import React, { useState, useEffect } from 'react';
import { X, Clock, KeyRound, Check } from 'lucide-react';
import type { UpdateUserInput, UserRole, UserItem } from '@propbot/shared';

interface UserManageDrawerProps {
  user: UserItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (userId: string, data: UpdateUserInput) => Promise<void>;
  onReset2Fa: (userId: string) => Promise<void>;
  availableChatbots?: Array<{ id: string; name: string }>;
}

export const UserManageDrawer: React.FC<UserManageDrawerProps> = ({
  user,
  isOpen,
  onClose,
  onSave,
  onReset2Fa,
}) => {
  const [role, setRole] = useState<UserRole>('agent');
  const [team, setTeam] = useState('');
  const [leadCapacity, setLeadCapacity] = useState(50);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting2Fa, setIsResetting2Fa] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setRole((user.role as UserRole) || 'agent');
      setTeam(user.team || '');
      setLeadCapacity(user.leadCapacity || 50);
      if (user.workingHours) {
        setStartTime(user.workingHours.start || '09:00');
        setEndTime(user.workingHours.end || '18:00');
        setTimezone(user.workingHours.timezone || 'Asia/Kolkata');
        setSelectedDays(user.workingHours.days || [1, 2, 3, 4, 5]);
      }
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const handleDayToggle = (day: number) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day].sort());
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMessage(null);
    try {
      await onSave(user.id, {
        role,
        team: team.trim() || null,
        leadCapacity,
        workingHours: {
          start: startTime,
          end: endTime,
          timezone,
          days: selectedDays,
        },
      });
      setSuccessMessage('User updated successfully.');
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 1000);
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to update user.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset2Fa = async () => {
    if (
      !confirm(
        `Are you sure you want to reset Two-Factor Authentication for ${user.name}? They will be required to re-authenticate on next login.`,
      )
    ) {
      return;
    }
    setIsResetting2Fa(true);
    try {
      await onReset2Fa(user.id);
      alert('Two-Factor Authentication has been reset for this user.');
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to reset 2FA.');
    } finally {
      setIsResetting2Fa(false);
    }
  };

  const daysLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/40 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Manage Team Member</h2>
            <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
          {successMessage && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-lg text-sm flex items-center gap-2">
              <Check className="w-4 h-4" />
              {successMessage}
            </div>
          )}

          {/* Role */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Role & Permissions
            </label>
            <select
              value={role}
              onChange={e => setRole(e.target.value as UserRole)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="company_admin">Company Admin (Full administrative access)</option>
              <option value="sales_manager">Sales Manager (Team, Chatbots, Leads management)</option>
              <option value="agent">Agent (Lead follow-up, visits, CRM)</option>
              <option value="viewer">Viewer (Read-only access)</option>
            </select>
          </div>

          {/* Team */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Department / Team
            </label>
            <input
              type="text"
              value={team}
              onChange={e => setTeam(e.target.value)}
              placeholder="e.g. Luxury Residential, East Bangalore"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Lead Capacity */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Max Active Lead Capacity
            </label>
            <input
              type="number"
              min={1}
              max={500}
              value={leadCapacity}
              onChange={e => setLeadCapacity(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              Limits round-robin automated lead routing to this member.
            </p>
          </div>

          {/* Working Hours */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Operating Hours & Routing Schedule
            </label>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <span className="text-xs text-slate-500 block mb-1">Start Time</span>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <span className="text-xs text-slate-500 block mb-1">End Time</span>
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="mb-3">
              <span className="text-xs text-slate-500 block mb-1.5">Active Days</span>
              <div className="flex gap-1.5 flex-wrap">
                {daysLabels.map((lbl, idx) => {
                  const isSelected = selectedDays.includes(idx);
                  return (
                    <button
                      type="button"
                      key={lbl}
                      onClick={() => handleDayToggle(idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      {lbl}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="text-xs text-slate-500 block mb-1">Timezone</span>
              <input
                type="text"
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Security & 2FA Reset */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Security Actions
            </label>
            <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2.5">
                <KeyRound className="w-4 h-4 text-slate-500" />
                <div>
                  <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                    Two-Factor Authentication
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {user.twoFactorEnabled ? 'Enabled' : 'Not configured'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleReset2Fa}
                disabled={isResetting2Fa}
                className="px-3 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 rounded-lg transition-colors"
              >
                Reset 2FA
              </button>
            </div>
          </div>

          {/* Footer Submit */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
