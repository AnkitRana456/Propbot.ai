import React, { useState } from 'react';
import {
  X,
  Phone,
  Mail,
  Clock,
  GitMerge,
  CheckCircle2,
  MessageSquare,
  ChevronDown,
  User,
  Calendar,
  FileText,
  Clock3,
  Dna,
  History,
  FolderOpen,
  Sparkles,
} from 'lucide-react';
import type { LeadItemResponse, LeadStatus } from '@propbot/shared';
import { BuyerDnaCard } from './BuyerDnaCard.js';
import { IntentScoreGauge } from './IntentScoreGauge.js';
import { HandoffBriefCard } from './HandoffBriefCard.js';
import { NextBestActionBanner } from './NextBestActionBanner.js';
import { AgentCopilotPanel } from './AgentCopilotPanel.js';
import { VisitorTimeline } from '../crm/VisitorTimeline.js';
import { NotesPanel } from '../crm/NotesPanel.js';
import { TasksPanel } from '../crm/TasksPanel.js';
import { LostReasonModal } from '../crm/LostReasonModal.js';
import { AssignAgentModal } from '../crm/AssignAgentModal.js';
import { ShortlistPanel } from '../crm/ShortlistPanel.js';
import { AppointmentsPanel } from '../appointments/AppointmentsPanel.js';
import { LeadCallHistoryTab } from '../voice/LeadCallHistoryTab.js';
import { useUpdateLeadStatus, useMergeLead } from '../../services/leads.service.js';

interface LeadDetailDrawerProps {
  lead: LeadItemResponse | null;
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: 'new', label: 'New Lead' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'AI Qualified' },
  { value: 'site_visit_scheduled', label: 'Visit Scheduled' },
  { value: 'site_visit_done', label: 'Visit Done' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'booked', label: 'Booked / Converted' },
  { value: 'lost', label: 'Lost / Dropped' },
];

export const LeadDetailDrawer: React.FC<LeadDetailDrawerProps> = ({ lead, isOpen, onClose }) => {
  const updateStatusMutation = useUpdateLeadStatus();
  const mergeMutation = useMergeLead();

  const [activeTab, setActiveTab] = useState<
    'overview' | 'copilot' | 'dna' | 'calls' | 'timeline' | 'notes' | 'tasks' | 'appointments' | 'documents'
  >('overview');

  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isLostModalOpen, setIsLostModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  if (!isOpen || !lead) return null;

  const handleStatusChange = (newStatus: LeadStatus) => {
    setIsStatusDropdownOpen(false);
    if (newStatus === 'lost') {
      setIsLostModalOpen(true);
      return;
    }
    updateStatusMutation.mutate({
      leadId: lead.id,
      status: newStatus,
    });
  };

  const handleConfirmLost = (reason: string) => {
    updateStatusMutation.mutate({
      leadId: lead.id,
      status: 'lost',
      lostReason: reason,
    });
    setIsLostModalOpen(false);
  };

  const handleMerge = () => {
    if (!lead.duplicateMergeSuggestion) return;
    mergeMutation.mutate({
      targetLeadId: lead.id,
      sourceLeadId: lead.duplicateMergeSuggestion.existingLeadId,
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
        <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
          <div className="w-screen max-w-2xl bg-white shadow-2xl dark:bg-slate-900 flex flex-col">
            {/* Top Bar Header */}
            <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-base font-bold text-white shadow-sm">
                    {lead.name
                      .split(' ')
                      .map(n => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      {lead.name}
                      {lead.phoneVerified && (
                        <span className="flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" /> Verified
                        </span>
                      )}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {lead.phone && (
                        <a
                          href={`tel:${lead.phone}`}
                          className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                        >
                          <Phone className="h-3 w-3" /> {lead.phone}
                        </a>
                      )}
                      {lead.email && (
                        <a
                          href={`mailto:${lead.email}`}
                          className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                        >
                          <Mail className="h-3 w-3" /> {lead.email}
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Stage & Assigned Agent Bar */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <button
                      onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                    >
                      <span className="capitalize">{lead.status.replace('_', ' ')}</span>
                      <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                    </button>

                    {isStatusDropdownOpen && (
                      <div className="absolute left-0 mt-1.5 w-48 rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800 z-50">
                        {STATUS_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => handleStatusChange(opt.value)}
                            className="w-full px-3 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700 flex items-center justify-between cursor-pointer"
                          >
                            <span>{opt.label}</span>
                            {lead.status === opt.value && <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setIsAssignModalOpen(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                  >
                    <User className="h-3.5 w-3.5 text-blue-600" />
                    <span>{lead.assignedAgentName || 'Assign Agent'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Clock className="h-3 w-3" />
                  <span>Captured {new Date(lead.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="mt-4 flex flex-wrap gap-1 border-t border-slate-200/80 pt-3 dark:border-slate-800">
                {[
                  { id: 'overview', label: 'Overview', icon: FileText },
                  { id: 'copilot', label: 'AI Copilot', icon: Sparkles },
                  { id: 'dna', label: 'Buyer DNA & Intent', icon: Dna },
                  { id: 'calls', label: 'Calls', icon: Phone },
                  { id: 'timeline', label: 'Visitor Timeline', icon: History },
                  { id: 'notes', label: 'Notes', icon: MessageSquare },
                  { id: 'tasks', label: 'Tasks', icon: Calendar },
                  { id: 'appointments', label: 'Appointments', icon: Clock3 },
                  { id: 'documents', label: 'Shortlists & Docs', icon: FolderOpen },
                ].map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as typeof activeTab)}
                      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Duplicate Merge Suggestion Banner */}
            {lead.duplicateMergeSuggestion && (
              <div className="bg-amber-50 border-b border-amber-200 p-4 dark:bg-amber-950/40 dark:border-amber-900/60">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <GitMerge className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                        Duplicate Contact Detected
                      </h5>
                      <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                        Phone {lead.duplicateMergeSuggestion.matchingValue} matches an existing prospect.
                        Merge records to preserve conversation history and Buyer DNA.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleMerge}
                    disabled={mergeMutation.isPending}
                    className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 transition-colors shadow-xs cursor-pointer shrink-0"
                  >
                    {mergeMutation.isPending ? 'Merging...' : 'Merge Records'}
                  </button>
                </div>
              </div>
            )}

            {/* Drawer Body Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {lead.nextBestAction && (
                    <NextBestActionBanner leadId={lead.id} nba={lead.nextBestAction} />
                  )}

                  {lead.handoffBrief && (
                    <HandoffBriefCard brief={lead.handoffBrief} slaStartedAt={lead.slaStartedAt} />
                  )}

                  <IntentScoreGauge
                    score={lead.intentScore}
                    label={lead.intentLabel}
                    reasons={lead.scoreExplanation}
                  />

                  {lead.lostReason && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 dark:border-rose-900/60 dark:bg-rose-950/30">
                      <span className="text-xs font-bold text-rose-800 dark:text-rose-300">
                        Lost Status Reason:
                      </span>
                      <p className="mt-1 text-xs text-rose-700 dark:text-rose-200">
                        {lead.lostReason}
                      </p>
                    </div>
                  )}

                  {/* Summary Details Card */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Prospect Profile Summary
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400">Source:</span>
                        <p className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                          {lead.source}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400">Assigned Representative:</span>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">
                          {lead.assignedAgentName || 'Unassigned'}
                        </p>
                      </div>
                      {lead.pageUrl && (
                        <div className="col-span-2">
                          <span className="text-slate-400">Landing Page Origin:</span>
                          <p className="font-medium text-blue-600 truncate">{lead.pageUrl}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'copilot' && <AgentCopilotPanel lead={lead} />}

              {activeTab === 'dna' && (
                <div className="space-y-6">
                  <IntentScoreGauge
                    score={lead.intentScore}
                    label={lead.intentLabel}
                    reasons={lead.scoreExplanation}
                  />
                  <BuyerDnaCard dna={lead.buyerDna} />
                </div>
              )}

              {activeTab === 'calls' && (
                <LeadCallHistoryTab leadId={lead.id} leadName={lead.name} phone={lead.phone} />
              )}

              {activeTab === 'timeline' && <VisitorTimeline leadId={lead.id} />}

              {activeTab === 'notes' && <NotesPanel leadId={lead.id} />}

              {activeTab === 'tasks' && <TasksPanel leadId={lead.id} leadName={lead.name} />}

              {activeTab === 'appointments' && (
                <AppointmentsPanel leadId={lead.id} leadName={lead.name} />
              )}

              {activeTab === 'documents' && (
                <ShortlistPanel leadId={lead.id} leadName={lead.name} />
              )}
            </div>

            {/* Quick Action Footer */}
            <div className="border-t border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900 flex items-center justify-between">
              <span className="text-xs text-slate-500">Source: {lead.source} channel</span>
              <div className="flex items-center gap-2">
                {lead.phone && (
                  <a
                    href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-colors dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-300 cursor-pointer"
                  >
                    <MessageSquare className="h-3.5 w-3.5" /> WhatsApp Lead
                  </a>
                )}
                {lead.phone && (
                  <a
                    href={`tel:${lead.phone}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
                  >
                    <Phone className="h-3.5 w-3.5" /> Call Prospect
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {isLostModalOpen && (
        <LostReasonModal
          isOpen={isLostModalOpen}
          leadName={lead.name}
          onClose={() => setIsLostModalOpen(false)}
          onConfirm={handleConfirmLost}
        />
      )}

      {isAssignModalOpen && (
        <AssignAgentModal
          isOpen={isAssignModalOpen}
          leadId={lead.id}
          currentAgentId={lead.assignedAgentId}
          onClose={() => setIsAssignModalOpen(false)}
        />
      )}
    </>
  );
};
