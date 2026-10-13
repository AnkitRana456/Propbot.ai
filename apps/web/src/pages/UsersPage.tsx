import React, { useState } from 'react';
import { UserPlus, Search, ShieldCheck, Mail, Check, X, Clock } from 'lucide-react';
import {
  useUsersList,
  useUsersKpis,
  usePendingUsers,
  useUserInvitations,
  useApproveUserMutation,
  useRejectUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useInviteUserMutation,
  useRevokeInviteMutation,
  useReset2FaMutation,
} from '../services/users.service.js';
import { UsersKpiCards } from '../components/users/UsersKpiCards.js';
import { UsersTable } from '../components/users/UsersTable.js';
import { UserManageDrawer } from '../components/users/UserManageDrawer.js';
import { InviteUserModal } from '../components/users/InviteUserModal.js';
import { AuditLogsTab } from '../components/users/AuditLogsTab.js';
import type { UserItem, UserInvitationItem, UserRole, UserStatus } from '@propbot/shared';

export const UsersPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'pending' | 'invites' | 'audit'>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [isManageDrawerOpen, setIsManageDrawerOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // Queries
  const { data: usersData, isLoading: isLoadingUsers } = useUsersList({
    q: searchQuery || undefined,
    role: (roleFilter as UserRole) || undefined,
    status: (statusFilter as UserStatus) || undefined,
  });
  const { data: kpisData, isLoading: isLoadingKpis } = useUsersKpis();
  const { data: pendingUsers = [] } = usePendingUsers();
  const { data: invitations = [] } = useUserInvitations();

  // Mutations
  const approveMutation = useApproveUserMutation();
  const rejectMutation = useRejectUserMutation();
  const updateMutation = useUpdateUserMutation();
  const deleteMutation = useDeleteUserMutation();
  const inviteMutation = useInviteUserMutation();
  const revokeInviteMutation = useRevokeInviteMutation();
  const reset2FaMutation = useReset2FaMutation();

  const handleOpenManage = (user: UserItem) => {
    setSelectedUser(user);
    setIsManageDrawerOpen(true);
  };

  const handleDeleteUser = async (user: UserItem) => {
    if (confirm(`Are you sure you want to deactivate ${user.name}? They will lose access immediately.`)) {
      try {
        await deleteMutation.mutateAsync(user.id);
      } catch (err: unknown) {
        alert((err as Error).message || 'Failed to deactivate user.');
      }
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            User Management & Teams
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage company team members, RBAC permissions, operating hours, and approval queue.
          </p>
        </div>
        <button
          onClick={() => setIsInviteModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-500/20 transition-all self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          Invite Member
        </button>
      </div>

      {/* KPI Cards */}
      <UsersKpiCards metrics={kpisData} isLoading={isLoadingKpis} />

      {/* Tabs Bar */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'users'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Team Members
          <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {usersData?.pagination?.total ?? 0}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`pb-3 transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'pending'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Pending Approval
          {pendingUsers.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800 font-bold dark:bg-amber-950/60 dark:text-amber-300">
              {pendingUsers.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('invites')}
          className={`pb-3 transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'invites'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Invitations
          {invitations.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-800 text-slate-600">
              {invitations.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'audit'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Audit Logs
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search team member by name or email..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
            >
              <option value="">All Roles</option>
              <option value="company_admin">Company Admin</option>
              <option value="sales_manager">Sales Manager</option>
              <option value="agent">Agent</option>
              <option value="viewer">Viewer</option>
            </select>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>

          <UsersTable
            users={usersData?.data || []}
            isLoading={isLoadingUsers}
            onManage={handleOpenManage}
            onDelete={handleDeleteUser}
          />
        </div>
      )}

      {activeTab === 'pending' && (
        <div className="space-y-4">
          {pendingUsers.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="font-semibold text-slate-800 dark:text-slate-200">No Pending Approvals</p>
              <p className="text-xs text-slate-500 mt-0.5">
                All registered users have been reviewed and approved.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingUsers.map((pu: UserItem) => (
                <div
                  key={pu.id}
                  className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-900/50 shadow-sm space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white">{pu.name}</h3>
                      <p className="text-xs text-slate-500">{pu.email}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                      Pending
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Registered {new Date(pu.createdAt).toLocaleDateString()}
                  </div>
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    <button
                      onClick={() => approveMutation.mutate(pu.id)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Approve
                    </button>
                    <button
                      onClick={() => rejectMutation.mutate(pu.id)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 rounded-lg text-xs font-semibold transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'invites' && (
        <div className="space-y-4">
          {invitations.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <Mail className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <p className="font-semibold text-slate-800 dark:text-slate-200">No Pending Invitations</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Send invitations to colleagues to add them to your team.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-3.5">Email</th>
                    <th className="px-6 py-3.5">Role</th>
                    <th className="px-6 py-3.5">Expires</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {invitations.map((inv: UserInvitationItem) => (
                    <tr key={inv.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                        {inv.email}
                      </td>
                      <td className="px-6 py-4 capitalize">{inv.role.replace('_', ' ')}</td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {new Date(inv.expiresAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => revokeInviteMutation.mutate(inv.id)}
                          className="text-xs text-rose-600 hover:text-rose-700 font-medium"
                        >
                          Revoke Invite
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'audit' && <AuditLogsTab />}

      {/* Slide-over Drawer for User Management */}
      <UserManageDrawer
        user={selectedUser}
        isOpen={isManageDrawerOpen}
        onClose={() => setIsManageDrawerOpen(false)}
        onSave={async (id, data) => {
          await updateMutation.mutateAsync({ id, data });
        }}
        onReset2Fa={async id => {
          await reset2FaMutation.mutateAsync(id);
        }}
      />

      {/* Invite Member Modal */}
      <InviteUserModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onInvite={async data => {
          return await inviteMutation.mutateAsync(data);
        }}
      />
    </div>
  );
};
