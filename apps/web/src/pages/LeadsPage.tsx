import React, { useState } from 'react';
import { Users, Search, Sparkles, Flame, RefreshCw, LayoutGrid, List, Download, BarChart3, GitMerge, User, CheckCircle2, Phone, MessageSquare, UserPlus, ArrowUpRight, TrendingUp, Target } from 'lucide-react';
import { useLeads, useUpdateLeadStatus } from '../services/leads.service.js';
import { useBulkUpdateStatus } from '../services/crm.service.js';
import { LeadDetailDrawer } from '../components/leads/LeadDetailDrawer.js';
import { LeadsKanbanBoard } from '../components/crm/LeadsKanbanBoard.js';
import { ExportLeadsModal } from '../components/crm/ExportLeadsModal.js';
import { BulkActionsBar } from '../components/crm/BulkActionsBar.js';
import { AssignAgentModal } from '../components/crm/AssignAgentModal.js';
import { LostReasonModal } from '../components/crm/LostReasonModal.js';
import { CrmReportsDrawer } from '../components/crm/CrmReportsDrawer.js';
import { AddLeadModal } from '../components/crm/AddLeadModal.js';
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
  const [isAddLeadModalOpen, setIsAddLeadModalOpen] = useState(false);

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
      {/* Top Header Banner with 3D Depth */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-r from-white via-slate-50/50 to-orange-50/20 p-6 shadow-card dark:border-slate-800/90 dark:from-slate-900 dark:via-slate-900/90 dark:to-orange-950/10">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-serif text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Real Estate CRM & Leads Hub
              </h1>
              <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-500/10 to-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-[#B84A22] border border-orange-200 dark:border-orange-800/60 dark:text-orange-300 shadow-xs">
                <Sparkles className="h-3 w-3 text-[#B84A22] dark:text-orange-400" />
                <span>AI Pipeline Active</span>
              </span>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-sans">
              Full-lifecycle lead management, Kanban stage transitions, buyer DNA intelligence, and high-velocity conversion tracking.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Toggle */}
            <div className="flex items-center rounded-xl bg-slate-100/80 p-1 border border-slate-200/80 dark:bg-slate-800/80 dark:border-slate-700/80 shadow-xs">
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-200 cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white text-slate-900 shadow-card dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <List className="h-3.5 w-3.5" />
                Table
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-200 cursor-pointer ${
                  viewMode === 'kanban'
                    ? 'bg-white text-slate-900 shadow-card dark:bg-slate-900 dark:text-white'
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
              className="flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white/90 px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 hover:shadow-card hover:-translate-y-0.5 dark:border-slate-700/80 dark:bg-slate-900/90 dark:text-slate-300 dark:hover:bg-slate-800 transition-all duration-200 cursor-pointer"
            >
              <BarChart3 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              Reports
            </button>

            {/* Export Button */}
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white/90 px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 hover:shadow-card hover:-translate-y-0.5 dark:border-slate-700/80 dark:bg-slate-900/90 dark:text-slate-300 dark:hover:bg-slate-800 transition-all duration-200 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              Export
            </button>

            {/* Refresh Button */}
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center justify-center h-8.5 w-8.5 rounded-xl border border-slate-200/90 bg-white/90 text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700/80 dark:bg-slate-900/90 dark:text-slate-300 dark:hover:bg-slate-800 transition-all duration-200 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            </button>

            {/* Add New Lead Button with 3D Pop */}
            <button
              onClick={() => setIsAddLeadModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#B84A22] to-[#c75528] px-4 py-2 text-xs font-bold text-white shadow-button hover:shadow-button-hover hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>+ New Lead</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Summary Metric Cards with 3D Depth & Gradients */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {/* Total Leads */}
        <div className="group relative rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Total Leads</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="font-serif text-3xl font-bold text-slate-900 dark:text-white">
            {isLoading ? <Skeleton className="h-8 w-16" /> : totalLeads}
          </div>
          <span className="text-[11px] text-slate-400 font-mono mt-1 block">All captured inquiries</span>
        </div>

        {/* New Leads */}
        <div className="group relative rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
            <span>New Inbound</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400">
              <Target className="h-4 w-4" />
            </div>
          </div>
          <div className="font-serif text-3xl font-bold text-sky-600 dark:text-sky-400">
            {isLoading ? <Skeleton className="h-8 w-16" /> : newLeadsCount}
          </div>
          <span className="text-[11px] text-slate-400 font-mono mt-1 block">Awaiting advisor contact</span>
        </div>

        {/* AI Qualified */}
        <div className="group relative rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
            <span>AI Qualified</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <div className="font-serif text-3xl font-bold text-purple-600 dark:text-purple-400">
            {isLoading ? <Skeleton className="h-8 w-16" /> : qualifiedLeadsCount}
          </div>
          <span className="text-[11px] text-slate-400 font-mono mt-1 block">Budget & Typology verified</span>
        </div>

        {/* Converted */}
        <div className="group relative rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Conversion ({conversionRate}%)</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="font-serif text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            {isLoading ? <Skeleton className="h-8 w-16" /> : convertedLeadsCount}
          </div>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono font-medium mt-1 block">
            {conversionRate}% Pipeline closed
          </span>
        </div>
      </div>

      {/* Duplicate Merge Suggestions Notification Banner */}
      {duplicateSuggestionsCount > 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-amber-300/80 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4 dark:border-amber-700/60 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <GitMerge className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                {duplicateSuggestionsCount} Duplicate Prospect Inquiries Detected
              </p>
              <p className="text-[11px] text-amber-800 dark:text-amber-300">
                Identified cross-channel phone numbers. Open lead drawers to review and merge with 1-click.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main CRM Workspace (Table or Kanban) */}
      {viewMode === 'kanban' ? (
        <LeadsKanbanBoard onSelectLead={handleRowClick} />
      ) : (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900 space-y-4">
          {/* Controls: Tabs, Filters, and Search */}
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            {/* Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-100/80 p-1 dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50">
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
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-200 cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-white text-slate-900 shadow-card dark:bg-slate-900 dark:text-white'
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
                className="rounded-xl border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#B84A22]/30"
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
                  className="w-full rounded-xl border border-slate-200/90 bg-slate-50/50 py-1.5 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#B84A22] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/60 dark:text-white transition-all"
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
            <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200/90 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                  <tr>
                    <th className="py-3.5 pl-4 pr-2 w-8">
                      <input
                        type="checkbox"
                        checked={selectedLeadIds.length === leads.length && leads.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-300 text-[#B84A22] focus:ring-[#B84A22] cursor-pointer"
                      />
                    </th>
                    <th className="py-3.5 px-3">Lead Profile</th>
                    <th className="py-3.5 px-3">Contact Details</th>
                    <th className="py-3.5 px-3">Pipeline Status</th>
                    <th className="py-3.5 px-3">AI Score & Intent</th>
                    <th className="py-3.5 px-3">Assigned Advisor</th>
                    <th className="py-3.5 px-3">Source</th>
                    <th className="py-3.5 pr-4 text-right">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
                  {leads.map(lead => {
                    const isSelected = selectedLeadIds.includes(lead.id);
                    // Avatar initial and tone
                    const initial = lead.name ? lead.name.charAt(0).toUpperCase() : 'L';
                    const nameHash = (lead.name || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
                    const tones = [
                      'bg-gradient-to-br from-orange-100 to-amber-200 text-[#B84A22] dark:from-orange-950 dark:to-orange-900 dark:text-orange-300 shadow-xs',
                      'bg-gradient-to-br from-amber-100 to-yellow-200 text-[#A9822B] dark:from-yellow-950 dark:to-yellow-900 dark:text-amber-300 shadow-xs',
                      'bg-gradient-to-br from-emerald-100 to-teal-200 text-[#2F5D50] dark:from-teal-950 dark:to-teal-900 dark:text-teal-300 shadow-xs',
                    ];
                    const avatarTone = tones[nameHash % tones.length];

                    // 5-segment lead score calculation
                    const score = Math.max(0, Math.min(100, lead.intentScore || 0));
                    const filledSegments = Math.round((score / 100) * 5);
                    const isHot = score >= 70;
                    const scoreColor = isHot
                      ? 'bg-gradient-to-r from-orange-500 to-red-500'
                      : score >= 40
                        ? 'bg-gradient-to-r from-amber-400 to-yellow-500'
                        : 'bg-gradient-to-r from-emerald-400 to-teal-500';

                    // Clean phone for tel / WhatsApp
                    const cleanPhone = (lead.phone || '').replace(/[^0-9]/g, '');

                    return (
                      <tr
                        key={lead.id}
                        onClick={() => handleRowClick(lead)}
                        className={`group cursor-pointer transition-all duration-150 h-[52px] ${
                          isSelected
                            ? 'bg-orange-50/60 dark:bg-orange-950/20'
                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        {/* 1. Checkbox */}
                        <td className="py-2.5 pl-4 pr-2 w-8" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={e => toggleSelectLead(lead.id, e as unknown as React.MouseEvent)}
                            className="rounded border-slate-300 text-[#B84A22] focus:ring-[#B84A22] cursor-pointer"
                          />
                        </td>

                        {/* 2. Lead Profile */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-serif text-xs font-bold shrink-0 ${avatarTone}`}>
                              {initial}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-serif font-semibold text-xs text-slate-900 dark:text-white group-hover:text-[#B84A22] dark:group-hover:text-orange-400 transition-colors truncate">
                                  {lead.name}
                                </span>
                                {lead.phoneVerified && (
                                  <span title="Verified phone">
                                    <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                                  </span>
                                )}
                              </div>
                              <span className="font-mono text-[10px] text-slate-400 block truncate">
                                {lead.buyerDna?.localities?.[0] || 'Bangalore'} &bull; {lead.buyerDna?.bhk?.[0] || '3 BHK'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 3. Contact Details */}
                        <td className="py-2.5 px-3">
                          <div className="flex flex-col font-mono text-[11px] text-slate-600 dark:text-slate-300">
                            <span className="truncate">{lead.phone || '—'}</span>
                            {lead.email && (
                              <span className="text-[10px] text-slate-400 truncate max-w-[160px]">
                                {lead.email}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 4. Status (Inline dropdown with status pill style) */}
                        <td className="py-2.5 px-3" onClick={e => e.stopPropagation()}>
                          <select
                            value={lead.status}
                            onChange={e => handleInlineStatusChange(lead, e.target.value as LeadStatus, e)}
                            className="rounded-lg border border-slate-200 bg-white/90 px-2.5 py-1 text-[11px] font-mono font-medium text-slate-800 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#B84A22]"
                          >
                            <option value="new">New</option>
                            <option value="contacted">Contacted</option>
                            <option value="qualified">Qualified</option>
                            <option value="site_visit_scheduled">Site Visit</option>
                            <option value="negotiation">Negotiation</option>
                            <option value="booked">Booked</option>
                            <option value="lost">Lost</option>
                          </select>
                        </td>

                        {/* 5. Lead Score & Intent */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-0.5" title={`Score: ${score}/100`}>
                              {[0, 1, 2, 3, 4].map(segIdx => (
                                <div
                                  key={segIdx}
                                  className={`w-1.5 h-3.5 rounded-[2px] transition-colors ${
                                    segIdx < filledSegments
                                      ? scoreColor
                                      : 'bg-slate-200 dark:bg-slate-700/80'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                              {score}
                            </span>
                            {isHot && (
                              <span className="flex items-center gap-0.5 rounded-full bg-orange-100 dark:bg-orange-950/80 px-1.5 py-0.5 text-[9px] font-bold text-[#B84A22] dark:text-orange-300">
                                <Flame className="w-2.5 h-2.5 fill-current" />
                                <span>HOT</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 6. Assigned Advisor */}
                        <td className="py-2.5 px-3" onClick={e => openSingleAssign(lead.id, e)}>
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-700 dark:text-slate-300 hover:text-[#B84A22] dark:hover:text-orange-400 bg-slate-100/80 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700 truncate cursor-pointer">
                            <User className="h-3 w-3 text-slate-400" />
                            <span className="truncate">{lead.assignedAgentName || 'Unassigned'}</span>
                          </span>
                        </td>

                        {/* 7. Source Tag */}
                        <td className="py-2.5 px-3">
                          <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200/80 dark:border-slate-700">
                            {lead.source || 'Direct'}
                          </span>
                        </td>

                        {/* 8. Quick Actions (Call, WhatsApp, Schedule, Detail) */}
                        <td className="py-2.5 pr-4 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Direct Call */}
                            {cleanPhone && (
                              <a
                                href={`tel:${cleanPhone}`}
                                title={`Call ${lead.name}`}
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-xs hover:border-[#B84A22] hover:text-[#B84A22] hover:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-orange-400 transition-all duration-150"
                              >
                                <Phone className="h-3.5 w-3.5" />
                              </a>
                            )}

                            {/* WhatsApp */}
                            {cleanPhone && (
                              <a
                                href={`https://wa.me/${cleanPhone}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`WhatsApp ${lead.name}`}
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-xs hover:bg-emerald-100 hover:-translate-y-0.5 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 transition-all duration-150"
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                              </a>
                            )}

                            {/* View Full Drawer */}
                            <button
                              onClick={() => handleRowClick(lead)}
                              title="Open Dossier"
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-xs hover:border-blue-500 hover:text-blue-600 hover:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-blue-400 transition-all duration-150 cursor-pointer"
                            >
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
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
          onClose={() => setIsExportModalOpen(false)}
        />
      )}

      {/* CRM Reports Drawer */}
      <CrmReportsDrawer
        isOpen={isReportsDrawerOpen}
        onClose={() => setIsReportsDrawerOpen(false)}
      />

      {/* Assign Agent Modal */}
      <AssignAgentModal
        isOpen={isAssignModalOpen}
        leadId={assignTargetLeadId}
        leadIds={selectedLeadIds.length > 0 ? selectedLeadIds : undefined}
        onClose={() => {
          setIsAssignModalOpen(false);
          setAssignTargetLeadId(undefined);
        }}
      />

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

      {/* Add Lead Modal */}
      {isAddLeadModalOpen && (
        <AddLeadModal
          isOpen={isAddLeadModalOpen}
          onClose={() => setIsAddLeadModalOpen(false)}
        />
      )}
    </div>
  );
};

export default LeadsPage;
