import React, { useState } from 'react';
import {
  Users,
  Search,
  Sparkles,
  Flame,
  ChevronRight,
  RefreshCw,
  LayoutGrid,
  List,
  Download,
  BarChart3,
  GitMerge,
  Calendar,
  AlertTriangle,
  User,
  CheckCircle2,
} from 'lucide-react';
import { useLeads, useUpdateLeadStatus } from '../services/leads.service.js';
import { useBulkUpdateStatus } from '../services/crm.service.js';
import { LeadDetailDrawer } from '../components/leads/LeadDetailDrawer.js';
import { LeadsKanbanBoard } from '../components/crm/LeadsKanbanBoard.js';
import { ExportLeadsModal } from '../components/crm/ExportLeadsModal.js';
import { BulkActionsBar } from '../components/crm/BulkActionsBar.js';
import { AssignAgentModal } from '../components/crm/AssignAgentModal.js';
import { LostReasonModal } from '../components/crm/LostReasonModal.js';
import { CrmReportsDrawer } from '../components/crm/CrmReportsDrawer.js';
import type { LeadItemResponse, LeadStatus } from '@propbot/shared';
import { Skeleton } from '../components/common/Skeleton.js';
import { EmptyState } from '../components/common/EmptyState.js';

export const LeadsPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [activeTab, setActiveTab] = useState<'all' | 'new' | 'qualified' | 'hot' | 'converted'>(
    'all',
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedLead, setSelectedLead] = useState<LeadItemResponse | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Bulk Selection State
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

  // Modals State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isReportsDrawerOpen, setIsReportsDrawerOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignTargetLeadId, setAssignTargetLeadId] = useState<string | undefined>(undefined);
  const [isLostModalOpen, setIsLostModalOpen] = useState(false);
  const [lostTargetLead, setLostTargetLead] = useState<LeadItemResponse | null>(null);

  const updateStatusMutation = useUpdateLeadStatus();
  const bulkStatusMutation = useBulkUpdateStatus();

  const statusFilter =
    activeTab === 'all'
      ? undefined
      : activeTab === 'hot'
        ? undefined
        : activeTab;

  const intentFilter = activeTab === 'hot' ? 'hot' : undefined;

  const {
    data: leadsData,
    isLoading,
    refetch,
    isFetching,
  } = useLeads({
    status: statusFilter,
    priority: priorityFilter !== 'all' ? priorityFilter : undefined,
    intentLabel: intentFilter,
    search: searchQuery || undefined,
    limit: 50,
  });

  const leads = leadsData?.items ?? [];

  // Summary Metrics
  const totalLeads = leadsData?.total ?? 0;
  const newLeadsCount = leads.filter(l => l.status === 'new').length;
  const qualifiedLeadsCount = leads.filter(l => l.status === 'qualified').length;
  const convertedLeadsCount = leads.filter(l => l.status === 'booked' || l.status === 'converted').length;
  const duplicateSuggestionsCount = leads.filter(l => Boolean(l.duplicateMergeSuggestion)).length;
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeadsCount / totalLeads) * 100) : 0;

  const handleRowClick = (lead: LeadItemResponse) => {
    setSelectedLead(lead);
    setIsDrawerOpen(true);
  };

  const toggleSelectAll = () => {
    if (selectedLeadIds.length === leads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(leads.map(l => l.id));
    }
  };

  const toggleSelectLead = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedLeadIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id],
    );
  };

  const handleInlineStatusChange = (lead: LeadItemResponse, newStatus: LeadStatus, e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    if (newStatus === 'lost') {
      setLostTargetLead(lead);
      setIsLostModalOpen(true);
      return;
    }
    updateStatusMutation.mutate({
      leadId: lead.id,
      status: newStatus,
    });
  };

  const handleConfirmLost = (reason: string) => {
    if (!lostTargetLead) return;
    updateStatusMutation.mutate({
      leadId: lostTargetLead.id,
      status: 'lost',
      lostReason: reason,
    });
    setIsLostModalOpen(false);
    setLostTargetLead(null);
  };

  const handleBulkStatusChange = async (status: LeadStatus) => {
    await bulkStatusMutation.mutateAsync({
      leadIds: selectedLeadIds,
      status,
    });
    setSelectedLeadIds([]);
  };

  const openSingleAssign = (leadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAssignTargetLeadId(leadId);
    setIsAssignModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Real Estate CRM & Leads Hub
            </h1>
            <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
              <Sparkles className="h-3 w-3 text-blue-500" />
              <span>Pipeline & DNA Active</span>
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Full-lifecycle lead management, Kanban stage transitions, visitor timelines, and speed-to-lead SLA tracking.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Toggle */}
          <div className="flex items-center rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              Table
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Kanban
            </button>
          </div>

          {/* CRM Reports Button */}
          <button
            onClick={() => setIsReportsDrawerOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <BarChart3 className="h-3.5 w-3.5 text-blue-600" />
            CRM Reports
          </button>

          {/* Export Button */}
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            Export CSV
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Summary Metric Cards with Conversion % */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Total Leads</span>
            <Users className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {isLoading ? <Skeleton className="h-8 w-16" /> : totalLeads}
          </div>
          <span className="text-[11px] text-slate-400">All captured inquiries</span>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
            <span>New Leads</span>
            <Users className="h-4 w-4 text-sky-600" />
          </div>
          <div className="text-2xl font-black text-sky-600">
            {isLoading ? <Skeleton className="h-8 w-16" /> : newLeadsCount}
          </div>
          <span className="text-[11px] text-slate-400">Awaiting initial contact</span>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
            <span>AI Qualified</span>
            <Sparkles className="h-4 w-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-600">
            {isLoading ? <Skeleton className="h-8 w-16" /> : qualifiedLeadsCount}
          </div>
          <span className="text-[11px] text-slate-400">Budget & BHK verified</span>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Converted ({conversionRate}%)</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600">
            {isLoading ? <Skeleton className="h-8 w-16" /> : convertedLeadsCount}
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold">
            {conversionRate}% Pipeline conversion
          </span>
        </div>
      </div>

      {/* Duplicate Merge Suggestions Notification Banner */}
      {duplicateSuggestionsCount > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/40">
          <div className="flex items-center gap-2.5">
            <GitMerge className="h-5 w-5 text-amber-600" />
            <div>
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                {duplicateSuggestionsCount} Duplicate Prospect Inquiries Detected
              </p>
              <p className="text-[11px] text-amber-800 dark:text-amber-300">
                Identified matching phone records across chat sessions. Open lead drawers to review and merge with 1-click.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main CRM Workspace (Table or Kanban) */}
      {viewMode === 'kanban' ? (
        <LeadsKanbanBoard onSelectLead={handleRowClick} />
      ) : (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          {/* Controls: Tabs, Filters, and Search */}
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            {/* Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              {(
                [
                  { id: 'all', label: 'All Leads' },
                  { id: 'hot', label: '🔥 Hot Leads (70%+)' },
                  { id: 'new', label: 'New' },
                  { id: 'qualified', label: 'Qualified' },
                  { id: 'converted', label: 'Converted' },
                ] as const
              ).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search and Priority Filter */}
            <div className="flex items-center gap-2.5">
              <select
                value={priorityFilter}
                onChange={e => setPriorityFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              >
                <option value="all">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search name, phone, email..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-1.5 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-800/50 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Table Container */}
          {isLoading ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : leads.length === 0 ? (
            <EmptyState
              icon={<Users className="h-7 w-7" />}
              title="No Leads Found"
              description={
                searchQuery
                  ? `No leads matched your search query "${searchQuery}".`
                  : 'Start conversations via the web widget to capture buyer profiles.'
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/50">
                  <tr>
                    <th className="py-3 pl-4 pr-2 w-8">
                      <input
                        type="checkbox"
                        checked={selectedLeadIds.length === leads.length && leads.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-3">Lead Info</th>
                    <th className="py-3 px-3">Contact</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Priority / Intent</th>
                    <th className="py-3 px-3">Assigned To</th>
                    <th className="py-3 px-3">Next Follow-up</th>
                    <th className="py-3 px-3">Origin</th>
                    <th className="py-3 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {leads.map(lead => {
                    const isSelected = selectedLeadIds.includes(lead.id);
                    const isHot = lead.intentScore >= 70;
                    return (
                      <tr
                        key={lead.id}
                        onClick={() => handleRowClick(lead)}
                        className={`group cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-50/50 dark:bg-blue-950/30'
                            : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-3.5 pl-4 pr-2" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={e => toggleSelectLead(lead.id, e as unknown as React.MouseEvent)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>

                        {/* Lead Info */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors dark:text-white">
                              {lead.name}
                            </span>
                            {lead.phoneVerified && (
                              <span title="Verified phone">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              </span>
                            )}
                          </div>
                          {lead.tags && lead.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {lead.tags.slice(0, 2).map((t, idx) => (
                                <span
                                  key={idx}
                                  className="rounded bg-slate-100 px-1.5 py-0.2 text-[9px] text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                >
                                  #{t}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* Contact */}
                        <td className="py-3.5 px-3">
                          <div className="space-y-0.5">
                            <span className="font-mono text-slate-700 dark:text-slate-300 block">
                              {lead.phone}
                            </span>
                            {lead.email && (
                              <span className="text-[11px] text-slate-400 block truncate max-w-[150px]">
                                {lead.email}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status (Inline editable) */}
                        <td className="py-3.5 px-3" onClick={e => e.stopPropagation()}>
                          <select
                            value={lead.status}
                            onChange={e => handleInlineStatusChange(lead, e.target.value as LeadStatus, e)}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                          >
                            <option value="new">New</option>
                            <option value="contacted">Contacted</option>
                            <option value="qualified">Qualified</option>
                            <option value="site_visit_scheduled">Visit Scheduled</option>
                            <option value="site_visit_done">Visit Done</option>
                            <option value="negotiation">Negotiation</option>
                            <option value="booked">Booked</option>
                            <option value="lost">Lost</option>
                          </select>
                        </td>

                        {/* Priority / Intent */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                isHot
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
                                  : lead.intentScore >= 35
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              {isHot && <Flame className="inline h-3 w-3 mr-0.5 text-rose-500" />}
                              {lead.intentScore}%
                            </span>
                            <span className="text-[10px] capitalize text-slate-400">
                              ({lead.priority})
                            </span>
                          </div>
                        </td>

                        {/* Assigned To */}
                        <td className="py-3.5 px-3" onClick={e => openSingleAssign(lead.id, e)}>
                          <div className="flex items-center gap-1.5 hover:text-blue-600 transition-colors cursor-pointer">
                            <User className="h-3 w-3 text-slate-400" />
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              {lead.assignedAgentName || 'Unassigned'}
                            </span>
                          </div>
                        </td>

                        {/* Next Follow-up & SLA */}
                        <td className="py-3.5 px-3">
                          {lead.nextFollowUpAt ? (
                            <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                              <Calendar className="h-3 w-3" />
                              {new Date(lead.nextFollowUpAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}

                          {lead.slaBreachedAt && (
                            <span className="flex items-center gap-0.5 text-[10px] text-rose-600 font-bold mt-0.5">
                              <AlertTriangle className="h-3 w-3" /> SLA Breached
                            </span>
                          )}
                        </td>

                        {/* Origin Source */}
                        <td className="py-3.5 px-3">
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400 capitalize">
                            {lead.source}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 pr-4 text-right">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              handleRowClick(lead);
                            }}
                            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800 dark:hover:text-blue-400 cursor-pointer"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Floating Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedLeadIds.length}
        onClearSelection={() => setSelectedLeadIds([])}
        onOpenAssignModal={() => setIsAssignModalOpen(true)}
        onBulkStatusChange={handleBulkStatusChange}
        onOpenExportModal={() => setIsExportModalOpen(true)}
      />

      {/* Lead Detail Drawer */}
      <LeadDetailDrawer
        lead={selectedLead}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedLead(null);
        }}
      />

      {/* Export Modal */}
      {isExportModalOpen && (
        <ExportLeadsModal
          isOpen={isExportModalOpen}
          selectedLeadIds={selectedLeadIds}
          activeFilters={{
            status: statusFilter,
            priority: priorityFilter !== 'all' ? priorityFilter : undefined,
            search: searchQuery,
          }}
          onClose={() => setIsExportModalOpen(false)}
        />
      )}

      {/* CRM Reports Drawer */}
      {isReportsDrawerOpen && (
        <CrmReportsDrawer
          isOpen={isReportsDrawerOpen}
          onClose={() => setIsReportsDrawerOpen(false)}
        />
      )}

      {/* Assign Agent Modal */}
      {isAssignModalOpen && (
        <AssignAgentModal
          isOpen={isAssignModalOpen}
          leadId={assignTargetLeadId}
          leadIds={selectedLeadIds.length > 0 ? selectedLeadIds : undefined}
          onClose={() => {
            setIsAssignModalOpen(false);
            setAssignTargetLeadId(undefined);
          }}
        />
      )}

      {/* Lost Reason Modal */}
      {isLostModalOpen && lostTargetLead && (
        <LostReasonModal
          isOpen={isLostModalOpen}
          leadName={lostTargetLead.name}
          onClose={() => {
            setIsLostModalOpen(false);
            setLostTargetLead(null);
          }}
          onConfirm={handleConfirmLost}
        />
      )}
    </div>
  );
};
