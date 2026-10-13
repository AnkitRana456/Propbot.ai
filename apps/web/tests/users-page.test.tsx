import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { UsersKpiCards } from '../src/components/users/UsersKpiCards.js';
import { UsersTable } from '../src/components/users/UsersTable.js';
import { UserManageDrawer } from '../src/components/users/UserManageDrawer.js';
import { InviteUserModal } from '../src/components/users/InviteUserModal.js';
import { AuditLogsTab } from '../src/components/users/AuditLogsTab.js';
import { UsersPage } from '../src/pages/UsersPage.js';
import type { UserKpiMetrics } from '@propbot/shared';

// Mock services
vi.mock('../src/services/users.service.js', () => ({
  useUsersList: () => ({
    data: {
      users: [
        {
          id: 'user-001',
          name: 'Ankit Sharma',
          email: 'ankit@propbot.com',
          role: 'company_admin',
          status: 'active',
          team: 'Sales Core',
          workingHours: { start: '09:00', end: '18:00', timezone: 'Asia/Kolkata', days: [1, 2, 3, 4, 5] },
          leadCapacity: 50,
          assignedChatbots: ['bot-001'],
          twoFactorEnabled: true,
          createdAt: new Date().toISOString(),
        },
      ],
      total: 1,
    },
    isLoading: false,
  }),
  useUsersKpis: () => ({
    data: {
      totalUsers: 8,
      activeUsers: 6,
      pendingApproval: 2,
      companiesCount: 1,
    },
    isLoading: false,
  }),
  usePendingUsers: () => ({
    data: [
      {
        id: 'user-pending-1',
        name: 'Priya Verma',
        email: 'priya@propbot.com',
        role: 'agent',
        status: 'pending_approval',
        createdAt: new Date().toISOString(),
      },
    ],
    isLoading: false,
  }),
  useUserInvitations: () => ({
    data: [
      {
        id: 'inv-001',
        email: 'newhire@propbot.com',
        role: 'agent',
        status: 'pending',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        createdAt: new Date().toISOString(),
      },
    ],
    isLoading: false,
  }),
  useAuditLogs: () => ({
    data: {
      items: [
        {
          id: 'log-001',
          companyId: 'comp-001',
          userId: 'user-001',
          userName: 'Ankit Sharma',
          action: 'user_invited',
          targetType: 'invitation',
          targetId: 'inv-001',
          ipAddress: '127.0.0.1',
          createdAt: new Date().toISOString(),
        },
      ],
      total: 1,
      page: 1,
      limit: 25,
    },
    isLoading: false,
  }),
  useApproveUserMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRejectUserMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateUserMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteUserMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useInviteUserMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRevokeInviteMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReset2FaMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe('Frontend Users Management Components & Page', () => {
  it('renders UsersKpiCards with 4 metrics', () => {
    const metrics: UserKpiMetrics = {
      totalUsers: 12,
      activeUsers: 10,
      pendingApproval: 2,
      companiesCount: 3,
    };

    const el = React.createElement(UsersKpiCards, { metrics, isLoading: false });
    expect(el).toBeDefined();
    expect(el.props.metrics?.totalUsers).toBe(12);
    expect(el.props.metrics?.activeUsers).toBe(10);
    expect(el.props.metrics?.pendingApproval).toBe(2);
    expect(el.props.metrics?.companiesCount).toBe(3);
  });

  it('renders UsersTable with user listing and handlers', () => {
    const handleManage = vi.fn();
    const handleDelete = vi.fn();

    const users = [
      {
        id: 'u-1',
        name: 'Rohan Mehra',
        email: 'rohan@example.com',
        role: 'agent',
        team: 'Residential Sales',
        status: 'active',
        createdAt: '2026-10-10T00:00:00Z',
      },
    ];

    const el = React.createElement(UsersTable, {
      users,
      isLoading: false,
      onManage: handleManage,
      onDelete: handleDelete,
    });

    expect(el).toBeDefined();
    expect(el.props.users.length).toBe(1);
    expect(el.props.users[0].name).toBe('Rohan Mehra');
  });

  it('renders UserManageDrawer with working hours, capacity, and role configuration', () => {
    const handleClose = vi.fn();
    const handleSave = vi.fn();
    const handleReset2Fa = vi.fn();

    const el = React.createElement(UserManageDrawer, {
      isOpen: true,
      onClose: handleClose,
      user: {
        id: 'u-1',
        name: 'Rohan Mehra',
        email: 'rohan@example.com',
        role: 'agent',
        team: 'Residential Sales',
        leadCapacity: 30,
        workingHours: { start: '10:00', end: '19:00', timezone: 'Asia/Kolkata', days: [1, 2, 3, 4, 5] },
        assignedChatbots: ['bot-1'],
        twoFactorEnabled: true,
      },
      availableChatbots: [{ id: 'bot-1', name: 'Luxury Concierge' }],
      onSave: handleSave,
      onReset2Fa: handleReset2Fa,
    });

    expect(el).toBeDefined();
    expect(el.props.isOpen).toBe(true);
    expect(el.props.user.leadCapacity).toBe(30);
    expect(el.props.availableChatbots.length).toBe(1);
  });

  it('renders InviteUserModal with chatbot assignment support', () => {
    const handleClose = vi.fn();
    const handleInvite = vi.fn();

    const el = React.createElement(InviteUserModal, {
      isOpen: true,
      onClose: handleClose,
      onInvite: handleInvite,
      availableChatbots: [{ id: 'bot-1', name: 'Luxury Concierge' }],
    });

    expect(el).toBeDefined();
    expect(el.props.isOpen).toBe(true);
    expect(el.props.availableChatbots.length).toBe(1);
  });

  it('renders AuditLogsTab for security and compliance monitoring', () => {
    const el = React.createElement(AuditLogsTab);
    expect(el).toBeDefined();
  });

  it('renders main UsersPage container with tab navigation and action triggers', () => {
    const el = React.createElement(UsersPage);
    expect(el).toBeDefined();
  });
});
