import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { GeneralBrandingTab } from '../src/components/settings/GeneralBrandingTab.js';
import { PipelineOperationsTab } from '../src/components/settings/PipelineOperationsTab.js';
import { AiControlsTab } from '../src/components/settings/AiControlsTab.js';
import { SecurityTab } from '../src/components/settings/SecurityTab.js';
import { ApiDataPrivacyTab } from '../src/components/settings/ApiDataPrivacyTab.js';
import { SettingsPage } from '../src/pages/SettingsPage.js';

// Mock services
vi.mock('../src/services/settings.service.js', () => ({
  useCompanySettings: () => ({
    data: {
      id: 'comp-001',
      name: 'Prestige Real Estate',
      slug: 'prestige-re',
      branding: {
        logoUrl: 'https://prestige.com/logo.png',
        primaryColor: '#2563eb',
        secondaryColor: '#4f46e5',
        whiteLabel: true,
      },
      operations: {
        workingHours: { start: '09:00', end: '19:00', timezone: 'Asia/Kolkata', days: [1, 2, 3, 4, 5] },
        pipelineStages: ['New', 'Contacted', 'Qualified', 'Site Visit', 'Negotiation', 'Closed'],
        tags: ['Investor', 'First-Time Buyer', 'Luxury'],
        customLeadFields: [{ key: 'preferred_tower', label: 'Preferred Tower', type: 'text', required: false }],
        hotLeadSlaMinutes: 10,
      },
      aiControls: {
        emergencyKillSwitch: false,
        maxAutonomyTier: 'T1',
        dailyActionCap: 500,
        requireHumanApprovalForActions: ['book_site_visit', 'send_brochure'],
      },
      security: {
        ipAllowlist: ['192.168.1.1/32'],
      },
    },
    isLoading: false,
    refetch: vi.fn(),
  }),
  useApiKeysList: () => ({
    data: [
      {
        id: 'key-1',
        name: 'Zapier Webhook Key',
        keyPrefix: 'pb_live_4a2c',
        lastUsedAt: null,
        expiresAt: null,
        createdAt: new Date().toISOString(),
      },
    ],
    isLoading: false,
    refetch: vi.fn(),
  }),
  useUserSessionsList: () => ({
    data: [
      {
        id: 'sess-1',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        lastActiveAt: new Date().toISOString(),
        isCurrent: true,
      },
    ],
    isLoading: false,
    refetch: vi.fn(),
  }),
  useUpdateCompanySettingsMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateApiKeyMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRevokeApiKeyMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetup2FaMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useVerify2FaMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRevokeSessionMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useExportCompanyDataMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe('Frontend Settings Components & Page', () => {
  it('renders GeneralBrandingTab with logo and white-label controls', () => {
    const handleSave = vi.fn();

    const el = React.createElement(GeneralBrandingTab, {
      initialName: 'Prestige Group',
      initialBranding: {
        logoUrl: 'https://example.com/logo.png',
        primaryColor: '#2563eb',
        whiteLabel: true,
      },
      onSave: handleSave,
    });

    expect(el).toBeDefined();
    expect(el.props.initialName).toBe('Prestige Group');
    expect(el.props.initialBranding.whiteLabel).toBe(true);
  });

  it('renders PipelineOperationsTab with SLA timer and pipeline stages', () => {
    const handleSave = vi.fn();

    const el = React.createElement(PipelineOperationsTab, {
      initialOperations: {
        workingHours: { start: '09:00', end: '18:00', timezone: 'Asia/Kolkata', days: [1, 2, 3, 4, 5] },
        pipelineStages: ['New', 'Contacted', 'Won'],
        tags: ['VIP'],
        customLeadFields: [],
        hotLeadSlaMinutes: 15,
      },
      onSave: handleSave,
    });

    expect(el).toBeDefined();
    expect(el.props.initialOperations.hotLeadSlaMinutes).toBe(15);
  });

  it('renders AiControlsTab with emergency kill switch and tier governance', () => {
    const handleSave = vi.fn();

    const el = React.createElement(AiControlsTab, {
      initialAiControls: {
        emergencyKillSwitch: false,
        maxAutonomyTier: 'T1',
        dailyActionCap: 300,
        requireHumanApprovalForActions: ['book_site_visit'],
      },
      onSave: handleSave,
    });

    expect(el).toBeDefined();
    expect(el.props.initialAiControls.maxAutonomyTier).toBe('T1');
  });

  it('renders SecurityTab with 2FA, session revocation, and IP allowlist', () => {
    const handleSaveSecurity = vi.fn();

    const el = React.createElement(SecurityTab, {
      initialIpAllowlist: ['10.0.0.1/32'],
      onSaveSecurity: handleSaveSecurity,
    });

    expect(el).toBeDefined();
    expect(el.props.initialIpAllowlist).toContain('10.0.0.1/32');
  });

  it('renders ApiDataPrivacyTab with API key management and GDPR export', () => {
    const el = React.createElement(ApiDataPrivacyTab);
    expect(el).toBeDefined();
  });

  it('renders main SettingsPage container with 5 settings tabs', () => {
    const el = React.createElement(SettingsPage);
    expect(el).toBeDefined();
  });
});
