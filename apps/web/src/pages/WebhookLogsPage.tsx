import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader.js';
import { Button } from '../components/ui/Button.js';
import type { WebhookLogItem, WebhookLogsFilter } from '@propbot/shared';
import {
  useWebhookKpis,
  useWebhookEndpoints,
  useWebhookLogs,
  useCreateWebhookEndpoint,
  useDeleteWebhookEndpoint,
  useSendTestEvent,
  useReplayWebhook,
} from '../services/webhooks.service.js';
import { WebhookKpiCards } from '../components/webhooks/WebhookKpiCards.js';
import { WebhookFilterBar } from '../components/webhooks/WebhookFilterBar.js';
import { WebhookLogTable } from '../components/webhooks/WebhookLogTable.js';
import { WebhookPayloadDrawer } from '../components/webhooks/WebhookPayloadDrawer.js';
import { WebhookEndpointModal } from '../components/webhooks/WebhookEndpointModal.js';

export function WebhookLogsPage() {
  const [filterState, setFilterState] = useState<Partial<WebhookLogsFilter>>({
    status: 'all',
    page: 1,
    limit: 25,
  });

  const [activeFilter, setActiveFilter] = useState<Partial<WebhookLogsFilter>>({
    status: 'all',
    page: 1,
    limit: 25,
  });

  const [inspectedLog, setInspectedLog] = useState<WebhookLogItem | null>(null);
  const [isEndpointModalOpen, setIsEndpointModalOpen] = useState(false);

  // Queries & Mutations
  const { data: kpis, isLoading: isKpisLoading, refetch: refetchKpis } = useWebhookKpis();
  const { data: endpoints = [] } = useWebhookEndpoints();
  const {
    data: logsData,
    isLoading: isLogsLoading,
    refetch: refetchLogs,
  } = useWebhookLogs(activeFilter);

  const createEndpointMutation = useCreateWebhookEndpoint();
  const deleteEndpointMutation = useDeleteWebhookEndpoint();
  const sendTestMutation = useSendTestEvent();
  const replayMutation = useReplayWebhook();

  const handleApplyFilter = () => {
    setActiveFilter({ ...filterState, page: 1 });
  };

  const handleRefresh = () => {
    refetchKpis();
    refetchLogs();
  };

  const handlePageChange = (newPage: number) => {
    setFilterState(prev => ({ ...prev, page: newPage }));
    setActiveFilter(prev => ({ ...prev, page: newPage }));
  };

  const logs = logsData?.items || [];
  const total = logsData?.total || 0;
  const currentPage = logsData?.page || 1;
  const limit = logsData?.limit || 25;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Webhook logs"
        description="Every outbound event, its retries and any dead letters. Expand a row to see the exact JSON."
        action={
          <Button size="sm" onClick={() => setIsEndpointModalOpen(true)} leftIcon={<Settings className="h-4 w-4" />}>
            Configure endpoints
          </Button>
        }
      />

      {/* 4 KPI Cards */}
      <WebhookKpiCards kpis={kpis} isLoading={isKpisLoading} />

      {/* Filter Bar */}
      <WebhookFilterBar
        filter={filterState}
        endpoints={endpoints}
        onFilterChange={updated => setFilterState(prev => ({ ...prev, ...updated }))}
        onApply={handleApplyFilter}
        onRefresh={handleRefresh}
        isLoading={isLogsLoading}
      />

      {/* Delivery Logs Table */}
      <WebhookLogTable
        logs={logs}
        isLoading={isLogsLoading}
        onInspect={setInspectedLog}
        onReplay={id => replayMutation.mutate(id)}
        isReplaying={replayMutation.isPending}
      />

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-text-muted pt-2 px-1">
          <span>
            Showing {(currentPage - 1) * limit + 1} to {Math.min(currentPage * limit, total)} of {total} logs
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="px-3 py-1.5 border border-border rounded-lg text-text hover:bg-surface-2 disabled:opacity-50 font-medium"
            >
              Previous
            </button>
            <span className="font-semibold text-text">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="px-3 py-1.5 border border-border rounded-lg text-text hover:bg-surface-2 disabled:opacity-50 font-medium"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Slide-over Inspection Drawer */}
      <WebhookPayloadDrawer
        log={inspectedLog}
        onClose={() => setInspectedLog(null)}
        onReplay={id => replayMutation.mutate(id)}
        isReplaying={replayMutation.isPending}
      />

      {/* Endpoints Management Modal */}
      <WebhookEndpointModal
        isOpen={isEndpointModalOpen}
        onClose={() => setIsEndpointModalOpen(false)}
        endpoints={endpoints}
        onCreate={input => createEndpointMutation.mutateAsync(input)}
        onDelete={id => deleteEndpointMutation.mutateAsync(id)}
        onSendTest={id => sendTestMutation.mutateAsync(id)}
        isCreating={createEndpointMutation.isPending}
      />
    </div>
  );
}
