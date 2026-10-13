import React, { useState } from 'react';
import { Settings } from 'lucide-react';
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
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Webhook Delivery Logs</h1>
          <p className="text-xs text-gray-500 mt-1">
            Real-time audit log of outbound webhook events, retry lifecycles, and dead-letter queues.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsEndpointModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 shadow-sm transition"
          >
            <Settings className="w-4 h-4" />
            Configure Endpoints
          </button>
        </div>
      </div>

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
        <div className="flex items-center justify-between text-xs text-gray-500 pt-2 px-1">
          <span>
            Showing {(currentPage - 1) * limit + 1} to {Math.min(currentPage * limit, total)} of {total} logs
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 font-medium"
            >
              Previous
            </button>
            <span className="font-semibold text-gray-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 font-medium"
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
