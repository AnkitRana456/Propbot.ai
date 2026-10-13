import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Sparkles,
  DollarSign,
  UserPlus,
  RefreshCw,
} from 'lucide-react';
import {
  usePendingApprovals,
  useApproveActionMutation,
  useRejectActionMutation,
  useApprovalHistory,
  type PendingApprovalItem,
} from '../services/approvals.service.js';

export const ApprovalsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [rejectModalAction, setRejectModalAction] = useState<PendingApprovalItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [editModalAction, setEditModalAction] = useState<PendingApprovalItem | null>(null);
  const [editedPrice, setEditedPrice] = useState<string>('');
  const [editedTerms, setEditedTerms] = useState<string>('');

  const { data: pendingData, isLoading: isPendingLoading, refetch: refetchPending } = usePendingApprovals();
  const { data: historyData, isLoading: isHistoryLoading } = useApprovalHistory();

  const approveMutation = useApproveActionMutation();
  const rejectMutation = useRejectActionMutation();

  const handleQuickApprove = async (item: PendingApprovalItem) => {
    try {
      await approveMutation.mutateAsync({ id: item.id });
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to approve action');
    }
  };

  const handleOpenEditModal = (item: PendingApprovalItem) => {
    setEditModalAction(item);
    const args = item.args || {};
    setEditedPrice(args.offered_price ? String(args.offered_price) : '');
    setEditedTerms((args.terms as string) || '');
  };

  const handleConfirmEditApprove = async () => {
    if (!editModalAction) return;
    try {
      const editedArgs: Record<string, unknown> = {};
      if (editedPrice) editedArgs.offered_price = parseFloat(editedPrice);
      if (editedTerms) editedArgs.terms = editedTerms;

      await approveMutation.mutateAsync({
        id: editModalAction.id,
        editedArgs,
      });
      setEditModalAction(null);
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to approve action');
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectModalAction) return;
    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejecting this action.');
      return;
    }
    try {
      await rejectMutation.mutateAsync({
        id: rejectModalAction.id,
        reason: rejectReason,
      });
      setRejectModalAction(null);
      setRejectReason('');
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to reject action');
    }
  };

  const pendingItems = pendingData?.items || [];
  const historyItems = historyData?.items || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              AI Action Approval Queue
            </h1>
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
              <ShieldCheck className="h-3.5 w-3.5" />
              Tier 2 Guardrails
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review sensitive real-estate operations proposed by AI assistants before execution.
          </p>
        </div>

        <button
          onClick={() => refetchPending()}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors shadow-sm text-slate-700 dark:text-slate-300 self-start md:self-auto"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Review</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold mt-2 text-slate-900 dark:text-white">
            {pendingItems.length}
          </div>
          <span className="text-xs text-slate-400">Requires manager sign-off</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Approved Today</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold mt-2 text-slate-900 dark:text-white">
            {historyItems.filter(i => i.status === 'approved' || i.status === 'executed').length}
          </div>
          <span className="text-xs text-emerald-600 dark:text-emerald-400">Executed safely</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Rejected</span>
            <XCircle className="h-4 w-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold mt-2 text-slate-900 dark:text-white">
            {historyItems.filter(i => i.status === 'rejected').length}
          </div>
          <span className="text-xs text-slate-400">Blocked with feedback</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">AI Kill Switch</span>
            <ShieldCheck className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-sm font-semibold mt-2.5 text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Protected & Online
          </div>
          <span className="text-xs text-slate-400">T3 prohibited actions blocked</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab('pending')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'pending'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Clock className="h-4 w-4" />
          Pending Approvals
          {pendingItems.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold">
              {pendingItems.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'history'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <CheckCircle2 className="h-4 w-4" />
          Audit History
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'pending' ? (
        <div className="space-y-4">
          {isPendingLoading ? (
            <div className="p-12 text-center text-slate-500">Loading pending approvals...</div>
          ) : pendingItems.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                All Clear — No Actions Pending Approval
              </h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                When an AI agent or copilot suggests a Tier 2 action (such as special discounts, price quotes, or deal booking), it will appear here for manager authorization.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {pendingItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4 hover:border-blue-300 dark:hover:border-blue-800 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                        {item.actionType.includes('price') ? (
                          <DollarSign className="h-5 w-5" />
                        ) : item.actionType.includes('assign') ? (
                          <UserPlus className="h-5 w-5" />
                        ) : item.actionType.includes('booked') ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <Sparkles className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white capitalize">
                            {item.actionType.replace(/_/g, ' ')}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                            {item.tier} Approval Required
                          </span>
                        </div>
                        <span className="text-xs text-slate-500">
                          Proposed by {item.agentName} • {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    {item.expiresAt && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 self-start sm:self-auto">
                        <Clock className="h-3.5 w-3.5 text-amber-500" />
                        Expires {new Date(item.expiresAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  {/* Lead Context */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-lg border border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                          {item.leadName || 'Visitor Inquiry'}
                          {item.leadIntentScore !== undefined && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                              item.leadIntentScore >= 70
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                            }`}>
                              Intent {item.leadIntentScore}/100
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500">
                          {item.leadPhone || item.leadEmail || 'No contact provided'}
                        </span>
                      </div>
                    </div>

                    {/* Proposed Arguments Preview */}
                    <div className="text-xs text-slate-600 dark:text-slate-300 font-mono bg-white dark:bg-slate-900 px-3 py-1.5 rounded border border-slate-200 dark:border-slate-800 max-w-md truncate">
                      {JSON.stringify(item.args)}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-end gap-2.5 pt-1">
                    <button
                      onClick={() => setRejectModalAction(item)}
                      className="px-3.5 py-1.5 text-xs font-medium rounded-lg text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950 border border-rose-200 dark:border-rose-900 transition-colors"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleOpenEditModal(item)}
                      className="px-3.5 py-1.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors"
                    >
                      Edit & Approve
                    </button>
                    <button
                      onClick={() => handleQuickApprove(item)}
                      disabled={approveMutation.isPending}
                      className="px-4 py-1.5 text-xs font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approve & Execute
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* History Tab */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          {isHistoryLoading ? (
            <div className="p-12 text-center text-slate-500">Loading audit history...</div>
          ) : historyItems.length === 0 ? (
            <div className="p-12 text-center text-slate-500">No action history recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Action Type</th>
                    <th className="px-4 py-3">Safety Tier</th>
                    <th className="px-4 py-3">Target Lead</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Agent / Approver</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-normal">
                  {historyItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(item.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white capitalize">
                        {item.actionType.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {item.tier}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {item.leadName || 'System'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          item.status === 'executed' || item.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : item.status === 'rejected'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {item.agentName}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalAction && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Reject Proposed Action
            </h3>
            <p className="text-xs text-slate-500">
              Please provide feedback explaining why this AI-proposed action was declined. This is logged in the agency audit trail.
            </p>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Reason for Rejection
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="E.g., Price discount exceeds developer policy or unit is reserved."
                rows={3}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectModalAction(null)}
                className="px-4 py-2 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={rejectMutation.isPending || !rejectReason.trim()}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-colors disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit & Approve Modal */}
      {editModalAction && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Edit Parameters & Approve
            </h3>
            <p className="text-xs text-slate-500">
              Adjust parameters before authorizing execution. Changes will be recorded in the audit trail with approver signature.
            </p>
            {editModalAction.actionType.includes('price') && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Offered Price (₹)
                  </label>
                  <input
                    type="number"
                    value={editedPrice}
                    onChange={(e) => setEditedPrice(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Terms & Payment Conditions
                  </label>
                  <input
                    type="text"
                    value={editedTerms}
                    onChange={(e) => setEditedTerms(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setEditModalAction(null)}
                className="px-4 py-2 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmEditApprove}
                disabled={approveMutation.isPending}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
              >
                Confirm & Execute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
