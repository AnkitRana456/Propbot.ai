import React from 'react';
import { Search, Filter, RefreshCw } from 'lucide-react';
import type { WebhookEndpointItem, WebhookLogsFilter } from '@propbot/shared';

interface WebhookFilterBarProps {
  filter: Partial<WebhookLogsFilter>;
  endpoints?: WebhookEndpointItem[];
  onFilterChange: (updated: Partial<WebhookLogsFilter>) => void;
  onApply: () => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

export function WebhookFilterBar({
  filter,
  endpoints = [],
  onFilterChange,
  onApply,
  onRefresh,
  isLoading,
}: WebhookFilterBarProps) {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
      <div className="flex flex-wrap gap-3 items-center flex-1">
        {/* Lead ID Filter */}
        <div className="relative min-w-[180px] flex-1 sm:flex-initial">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Filter by Lead ID..."
            value={filter.leadId || ''}
            onChange={e => onFilterChange({ leadId: e.target.value || undefined })}
            className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Endpoint Dropdown */}
        <div className="min-w-[160px]">
          <select
            value={filter.endpointId || ''}
            onChange={e => onFilterChange({ endpointId: e.target.value || undefined })}
            className="w-full py-2 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All Endpoints</option>
            {endpoints.map(ep => (
              <option key={ep.id} value={ep.id}>
                {ep.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status Dropdown */}
        <div className="min-w-[130px]">
          <select
            value={filter.status || 'all'}
            onChange={e => onFilterChange({ status: e.target.value as WebhookLogsFilter['status'] })}
            className="w-full py-2 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">All Statuses</option>
            <option value="success">Success (2xx)</option>
            <option value="retrying">Retrying</option>
            <option value="failed">Failed</option>
            <option value="dead_letter">Dead-Letter</option>
          </select>
        </div>

        {/* Start / End Date */}
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={filter.startDate || ''}
            onChange={e => onFilterChange({ startDate: e.target.value || undefined })}
            className="py-1.5 px-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-600"
          />
          <span className="text-gray-400 text-xs">to</span>
          <input
            type="date"
            value={filter.endDate || ''}
            onChange={e => onFilterChange({ endDate: e.target.value || undefined })}
            className="py-1.5 px-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-600"
          />
        </div>

        {/* Results Per Page */}
        <div className="min-w-[90px]">
          <select
            value={filter.limit || 25}
            onChange={e => onFilterChange({ limit: Number(e.target.value), page: 1 })}
            className="w-full py-2 px-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-600"
          >
            <option value={10}>10 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <button
          onClick={onApply}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition"
        >
          <Filter className="w-3.5 h-3.5" />
          Apply
        </button>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition"
          title="Refresh Logs"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
}
