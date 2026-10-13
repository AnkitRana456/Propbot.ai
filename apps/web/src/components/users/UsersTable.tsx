import React from 'react';
import { Shield, UserX, SlidersHorizontal } from 'lucide-react';

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  team: string | null;
  status: string;
  createdAt: string;
  company?: { name: string; slug: string };
}

interface UsersTableProps {
  users: UserItem[];
  isLoading?: boolean;
  onManage: (user: UserItem) => void;
  onDelete: (user: UserItem) => void;
}

export const UsersTable: React.FC<UsersTableProps> = ({
  users,
  isLoading,
  onManage,
  onDelete,
}) => {
  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'company_admin':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'sales_manager':
        return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
      case 'agent':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      default:
        return 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300';
      case 'pending_approval':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300';
      case 'disabled':
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300';
      default:
        return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400">Loading users...</div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
        <p className="text-slate-600 dark:text-slate-400 font-medium">No team members found.</p>
        <p className="text-sm text-slate-500 mt-1">Invite team members to get started.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
      <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
        <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
          <tr>
            <th className="px-6 py-3.5">User</th>
            <th className="px-6 py-3.5">Company</th>
            <th className="px-6 py-3.5">Role</th>
            <th className="px-6 py-3.5">Team</th>
            <th className="px-6 py-3.5">Status</th>
            <th className="px-6 py-3.5">Joined</th>
            <th className="px-6 py-3.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {users.map(u => (
            <tr
              key={u.id}
              className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
            >
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-semibold flex items-center justify-center text-xs shadow-sm">
                    {u.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">{u.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{u.email}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 text-xs font-medium text-slate-700 dark:text-slate-300">
                {u.company?.name || 'Prestige Realty'}
              </td>
              <td className="px-6 py-4">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleBadge(
                    u.role,
                  )}`}
                >
                  <Shield className="w-3 h-3" />
                  {u.role.replace('_', ' ')}
                </span>
              </td>
              <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400">
                {u.team || '—'}
              </td>
              <td className="px-6 py-4">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusBadge(
                    u.status,
                  )}`}
                >
                  {u.status.replace('_', ' ')}
                </span>
              </td>
              <td className="px-6 py-4 text-xs text-slate-500">
                {new Date(u.createdAt).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onManage(u)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    title="Manage user"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    Manage
                  </button>
                  <button
                    onClick={() => onDelete(u)}
                    className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                    title="Deactivate user"
                  >
                    <UserX className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
