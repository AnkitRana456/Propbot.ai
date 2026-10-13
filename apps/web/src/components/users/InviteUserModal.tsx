import React, { useState } from 'react';
import { X, Mail, Send } from 'lucide-react';
import type { InviteUserInput, UserRole } from '@propbot/shared';

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (data: InviteUserInput) => Promise<unknown>;
  availableChatbots?: Array<{ id: string; name: string }>;
}

export const InviteUserModal: React.FC<InviteUserModalProps> = ({ isOpen, onClose, onInvite }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('agent');
  const [team, setTeam] = useState('');
  const [leadCapacity, setLeadCapacity] = useState(50);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ email?: string; inviteUrl?: string } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = (await onInvite({
        email: email.trim(),
        role,
        team: team.trim() || undefined,
        leadCapacity,
      })) as { email?: string; inviteUrl?: string; data?: { email?: string; inviteUrl?: string } } | undefined;
      if (res) {
        setInviteResult(res.data || res);
      }
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to send invitation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setEmail('');
    setRole('agent');
    setTeam('');
    setLeadCapacity(50);
    setInviteResult(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Invite Team Member</h2>
              <p className="text-xs text-slate-500">Send an invitation link via email</p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {inviteResult ? (
          <div className="p-6 space-y-4">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-sm">
              <p className="font-semibold">Invitation Dispatched!</p>
              <p className="text-xs mt-1">
                An invitation email has been sent to <strong>{inviteResult.email}</strong>.
              </p>
              {inviteResult.inviteUrl && (
                <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-800">
                  <p className="text-[11px] font-medium text-emerald-900 dark:text-emerald-200 uppercase tracking-wider">
                    Direct Invitation Link (Development):
                  </p>
                  <input
                    type="text"
                    readOnly
                    value={inviteResult.inviteUrl}
                    className="w-full mt-1 px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-lg select-all"
                  />
                </div>
              )}
            </div>
            <button
              onClick={handleReset}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 text-white text-sm font-semibold rounded-xl transition-all"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Work Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="colleague@yourcompany.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Role & Permissions
              </label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as UserRole)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="company_admin">Company Admin</option>
                <option value="sales_manager">Sales Manager</option>
                <option value="agent">Sales Agent</option>
                <option value="viewer">Viewer (Read-only)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Team / Department (Optional)
              </label>
              <input
                type="text"
                value={team}
                onChange={e => setTeam(e.target.value)}
                placeholder="e.g. Inbound Sales"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {isSubmitting ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
