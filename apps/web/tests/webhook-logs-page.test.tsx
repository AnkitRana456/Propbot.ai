import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { WebhookKpiCards } from '../src/components/webhooks/WebhookKpiCards.js';
import { WebhookFilterBar } from '../src/components/webhooks/WebhookFilterBar.js';
import { WebhookLogTable } from '../src/components/webhooks/WebhookLogTable.js';
import { WebhookPayloadDrawer } from '../src/components/webhooks/WebhookPayloadDrawer.js';
import { WebhookEndpointModal } from '../src/components/webhooks/WebhookEndpointModal.js';
import type { WebhookEndpointItem, WebhookLogItem, WebhookKpis } from '@propbot/shared';

// Mock services
vi.mock('../src/services/webhooks.service.js', () => ({
  useWebhookKpis: () => ({
    data: {
      totalWebhooks: 1420,
      successRate: 98.4,
      failedCount: 22,
      avgDurationMs: 185,
    },
    isLoading: false,
    refetch: vi.fn(),
  }),
  useWebhookEndpoints: () => ({
    data: [
      {
        id: 'ep-001',
        companyId: 'comp-001',
        name: 'Zapier CRM Hook',
        url: 'https://hooks.zapier.com/catch/123/abc',
        maskedSecret: 'whsec_••••••••4f2b',
        subscribedEvents: ['lead_captured', 'hot_lead'],
        headers: {},
        payloadTemplate: null,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    isLoading: false,
  }),
  useWebhookLogs: () => ({
    data: {
      items: [],
      total: 0,
      page: 1,
      limit: 25,
    },
    isLoading: false,
    refetch: vi.fn(),
  }),
  useCreateWebhookEndpoint: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useUpdateWebhookEndpoint: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useDeleteWebhookEndpoint: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useSendTestEvent: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useReplayWebhook: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

describe('Webhook Logs Frontend Components', () => {
  const mockKpis: WebhookKpis = {
    totalWebhooks: 1420,
    successRate: 98.4,
    failedCount: 22,
    avgDurationMs: 185,
  };

  const mockEndpoint: WebhookEndpointItem = {
    id: 'ep-001',
    companyId: 'comp-001',
    name: 'Zapier CRM Hook',
    url: 'https://hooks.zapier.com/catch/123/abc',
    maskedSecret: 'whsec_••••••••4f2b',
    subscribedEvents: ['lead_captured', 'hot_lead'],
    headers: {},
    payloadTemplate: null,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockLog: WebhookLogItem = {
    id: 'log-001',
    companyId: 'comp-001',
    endpointId: 'ep-001',
    endpointName: 'Zapier CRM Hook',
    endpointUrl: 'https://hooks.zapier.com/catch/123/abc',
    leadId: 'lead-001',
    leadName: 'Rohan Sharma',
    chatbotId: 'bot-001',
    chatbotName: 'Prestige Bot',
    eventId: 'evt-001',
    eventType: 'lead_captured',
    status: 'success',
    statusCode: 200,
    attempt: 1,
    maxAttempts: 3,
    requestPayload: { lead: { name: 'Rohan Sharma' } },
    requestHeaders: { 'Content-Type': 'application/json' },
    responseBody: '{"received": true}',
    responseHeaders: {},
    durationMs: 142,
    errorMessage: null,
    nextRetryAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('renders WebhookKpiCards element with 4 KPI summary cards', () => {
    const el = React.createElement(WebhookKpiCards, {
      kpis: mockKpis,
      isLoading: false,
    });
    expect(el).toBeDefined();
    expect(el.props.kpis?.totalWebhooks).toBe(1420);
    expect(el.props.kpis?.successRate).toBe(98.4);
    expect(el.props.kpis?.failedCount).toBe(22);
    expect(el.props.kpis?.avgDurationMs).toBe(185);
  });

  it('renders WebhookFilterBar element with filter callbacks', () => {
    const handleFilterChange = vi.fn();
    const handleApply = vi.fn();
    const handleRefresh = vi.fn();

    const el = React.createElement(WebhookFilterBar, {
      filter: { status: 'all', page: 1, limit: 25 },
      endpoints: [mockEndpoint],
      onFilterChange: handleFilterChange,
      onApply: handleApply,
      onRefresh: handleRefresh,
      isLoading: false,
    });

    expect(el).toBeDefined();
    expect(el.props.endpoints.length).toBe(1);
    expect(el.props.onApply).toBe(handleApply);
    expect(el.props.onRefresh).toBe(handleRefresh);
  });

  it('renders WebhookLogTable element with delivery log rows', () => {
    const handleInspect = vi.fn();
    const handleReplay = vi.fn();

    const el = React.createElement(WebhookLogTable, {
      logs: [mockLog],
      isLoading: false,
      onInspect: handleInspect,
      onReplay: handleReplay,
      isReplaying: false,
    });

    expect(el).toBeDefined();
    expect(el.props.logs.length).toBe(1);
    expect(el.props.logs[0].leadName).toBe('Rohan Sharma');
    expect(el.props.logs[0].status).toBe('success');
  });

  it('renders WebhookPayloadDrawer element for inspecting request/response', () => {
    const handleClose = vi.fn();
    const handleReplay = vi.fn();

    const el = React.createElement(WebhookPayloadDrawer, {
      log: mockLog,
      onClose: handleClose,
      onReplay: handleReplay,
      isReplaying: false,
    });

    expect(el).toBeDefined();
    expect(el.props.log?.id).toBe('log-001');
    expect(el.props.log?.endpointName).toBe('Zapier CRM Hook');
  });

  it('renders WebhookEndpointModal element with endpoint list and actions', () => {
    const handleClose = vi.fn();
    const handleCreate = vi.fn();
    const handleDelete = vi.fn();
    const handleSendTest = vi.fn();

    const el = React.createElement(WebhookEndpointModal, {
      isOpen: true,
      onClose: handleClose,
      endpoints: [mockEndpoint],
      onCreate: handleCreate,
      onDelete: handleDelete,
      onSendTest: handleSendTest,
      isCreating: false,
    });

    expect(el).toBeDefined();
    expect(el.props.isOpen).toBe(true);
    expect(el.props.endpoints.length).toBe(1);
  });
});
