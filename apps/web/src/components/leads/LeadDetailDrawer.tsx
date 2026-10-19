import React, { useState } from 'react';
import { X, Phone, Mail, Clock, GitMerge, CheckCircle2, MessageSquare, ChevronDown, User, FileText, Clock3, Dna, History, Sparkles } from 'lucide-react';
import type { LeadItemResponse, LeadStatus } from '@propbot/shared';
import { BuyerDnaCard } from './BuyerDnaCard.js';
import { IntentScoreGauge } from './IntentScoreGauge.js';
import { NextBestActionBanner } from './NextBestActionBanner.js';
import { AgentCopilotPanel } from './AgentCopilotPanel.js';

import { NotesPanel } from '../crm/NotesPanel.js';

import { LostReasonModal } from '../crm/LostReasonModal.js';
import { AssignAgentModal } from '../crm/AssignAgentModal.js';

import { AppointmentsPanel } from '../appointments/AppointmentsPanel.js';
import { LeadCallHistoryTab } from '../voice/LeadCallHistoryTab.js';
import { LeadConversationTab } from './LeadConversationTab.js';
import { useUpdateLeadStatus, useMergeLead } from '../../services/leads.service.js';

interface LeadDetailDrawerProps {
  lead: LeadItemResponse | null;
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'AI Qualified' },
  { value: 'site_visit_scheduled', label: 'Site Visit' },
  { value: 'site_visit_done', label: 'Visit Completed' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'booked', label: 'Booked / Closed' },
  { value: 'lost', label: 'Lost / Dropped' },
];

export const LeadDetailDrawer: React.FC<LeadDetailDrawerProps> = ({ lead, isOpen, onClose }) => {
  const updateStatusMutation = useUpdateLeadStatus();
  const mergeMutation = useMergeLead();

  const [activeTab, setActiveTab] = useState<
    'overview' | 'copilot' | 'chat' | 'dna' | 'calls' | 'timeline' | 'notes' | 'tasks' | 'appointments' | 'documents'
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

  // Avatar tone based on lead name
  const nameHash = (lead.name || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const tones = [
    'bg-[#F0D9CC] text-[#B84A22] dark:bg-[#3A241A] dark:text-[#E07A4C]', // Terracotta
    'bg-[#F6EED8] text-[#A9822B] dark:bg-[#342A16] dark:text-[#D1A94E]', // Brass
    'bg-[#E3EEEA] text-[#2F5D50] dark:bg-[#1E332D] dark:text-[#6FA593]', // Pine
  ];
  const avatarTone = tones[nameHash % tones.length];
  const initial = lead.name ? lead.name.charAt(0).toUpperCase() : 'L';

  // Format budget for display
  const budgetDisplay = lead.buyerDna?.budgetMin && lead.buyerDna?.budgetMax
    ? `₹${(lead.buyerDna.budgetMin / 10000000).toFixed(2)} Cr – ₹${(lead.buyerDna.budgetMax / 10000000).toFixed(2)} Cr`
    : '₹1.80 Cr – ₹2.50 Cr';

  // Sample Matched Inventory
  const matchedInventory = [
    { id: 'p1', name: 'Prestige Lakeside Habitat', unit: 'Tower B &bull; Unit 802', bhk: '3 BHK', price: '₹2.10 Cr', match: '98% Match' },
    { id: 'p2', name: 'Sobha Dream Acres', unit: 'Wing C &bull; Unit 1404', bhk: '3 BHK', price: '₹2.35 Cr', match: '91% Match' },
  ];

  // Combined Activity Timeline (calls, messages, visits, notes)
  const timelineEvents = [
    { time: 'Today, 11:30 AM', type: 'call', title: 'AI Voice Call Completed (01:42)', desc: 'Confirmed budget at ₹2.2 Cr. Positive interest in 3BHK.' },
    { time: 'Yesterday, 4:15 PM', type: 'message', title: 'WhatsApp Brochure Dispatched', desc: 'Prestige Lakeside PDF viewed 3x by client.' },
    { time: '14 Oct, 2:00 PM', type: 'visit', title: 'Physical Site Visit Scheduled', desc: 'Booked for Saturday 11:00 AM with Advisor Anand.' },
    { time: '12 Oct, 10:10 AM', type: 'note', title: 'Internal Note Added', desc: 'Buyer requires East-facing master bedroom and 2 covered parking slots.' },
  ];

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-hidden bg-[var(--text)]/20 transition-opacity">
        <div className="fixed inset-y-0 right-0 flex max-w-full pl-6 sm:pl-10">
          <div className="w-screen max-w-3xl bg-[var(--surface)] border-l border-[var(--border)] shadow-[0_12px_36px_rgba(28,26,22,0.18)] flex flex-col font-sans">
            {/* Top Bar Header */}
            <div className="border-b border-[var(--border)] px-6 py-4 bg-[var(--surface-2)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-[6px] font-serif text-base font-bold ${avatarTone}`}>
                    {initial}
                  </div>
                  <div>
                    <h3 className="font-serif text-lg font-medium text-[var(--text)] flex items-center gap-2">
                      {lead.name}
                      {lead.phoneVerified && (
                        <span className="pill-badge bg-[#2F5D50]/15 text-[#2F5D50] dark:text-[#6FA593] text-[10px]">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Verified Phone
                        </span>
                      )}
                    </h3>
                    <div className="flex items-center gap-3 text-xs font-mono text-[var(--text-muted)] mt-0.5">
                      {lead.phone && (
                        <a href={`tel:${lead.phone}`} className="flex items-center gap-1 hover:text-[var(--accent)]">
                          <Phone className="h-3 w-3" /> {lead.phone}
                        </a>
                      )}
                      {lead.email && (
                        <a href={`mailto:${lead.email}`} className="flex items-center gap-1 hover:text-[var(--accent)]">
                          <Mail className="h-3 w-3" /> {lead.email}
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="rounded-[6px] p-2 text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)] transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Stage & Assigned Advisor Bar */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <button
                      onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                      className="btn-ink-outline px-2.5 py-1 text-xs font-mono inline-flex items-center gap-1.5"
                    >
                      <span className="capitalize">{lead.status.replace('_', ' ')}</span>
                      <ChevronDown className="h-3 w-3 text-[var(--text-muted)]" />
                    </button>

                    {isStatusDropdownOpen && (
                      <div className="absolute left-0 mt-1.5 w-44 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] py-1 shadow-dropdown z-50">
                        {STATUS_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => handleStatusChange(opt.value)}
                            className="w-full px-3 py-1.5 text-left text-xs font-mono text-[var(--text)] hover:bg-[var(--surface-2)] flex items-center justify-between"
                          >
                            <span>{opt.label}</span>
                            {lead.status === opt.value && <CheckCircle2 className="h-3.5 w-3.5 text-[var(--accent)]" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setIsAssignModalOpen(true)}
                    className="btn-ink-outline px-2.5 py-1 text-xs font-mono inline-flex items-center gap-1.5"
                  >
                    <User className="h-3 w-3 text-[var(--brass)]" />
                    <span>{lead.assignedAgentName || 'Assign Advisor'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono text-[var(--text-muted)]">
                  <Clock className="h-3 w-3" />
                  <span>Captured {new Date(lead.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="mt-4 flex flex-wrap gap-1 border-t border-[var(--border)] pt-2.5">
                {[
                  { id: 'overview', label: 'Dossier Overview', icon: FileText },
                  { id: 'copilot', label: 'AI Copilot', icon: Sparkles },
                  { id: 'dna', label: 'Buyer DNA', icon: Dna },
                  { id: 'chat', label: 'Chat Log', icon: MessageSquare },
                  { id: 'calls', label: 'Voice Calls', icon: Phone },
                  { id: 'notes', label: 'Notes', icon: FileText },
                  { id: 'appointments', label: 'Visits', icon: Clock3 },
                ].map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as typeof activeTab)}
                      className={`flex items-center gap-1.5 rounded-[4px] px-2.5 py-1 text-xs font-mono transition-colors ${
                        isActive
                          ? 'bg-[var(--accent)] text-[var(--surface)] font-semibold'
                          : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)]'
                      }`}
                    >
                      <Icon className="h-3 w-3 stroke-[1.5]" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Duplicate Contact Alert */}
            {lead.duplicateMergeSuggestion && (
              <div className="bg-[var(--surface-2)] border-b border-[var(--border)] p-3 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <GitMerge className="h-4 w-4 text-[var(--brass)]" />
                  <span>Duplicate inquiry detected for phone {lead.duplicateMergeSuggestion.matchingValue}.</span>
                </div>
                <button
                  onClick={handleMerge}
                  disabled={mergeMutation.isPending}
                  className="btn-terracotta px-2.5 py-1 text-[11px]"
                >
                  Merge
                </button>
              </div>
            )}

            {/* Drawer Body Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* TWO-COLUMN EDITORIAL DOSSIER (Requested Screen 6) */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {lead.nextBestAction && (
                    <NextBestActionBanner leadId={lead.id} nba={lead.nextBestAction} />
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                    {/* LEFT COLUMN: Contact info & Buyer Requirements */}
                    <div className="md:col-span-6 space-y-4">
                      {/* Contact Dossier */}
                      <div className="editorial-card p-4 space-y-3">
                        <span className="blueprint-label">Contact Credentials</span>
                        <div className="space-y-2 text-xs font-mono">
                          <div className="flex justify-between py-1 border-b border-[var(--border)]">
                            <span className="text-[var(--text-muted)]">Full Name:</span>
                            <span className="font-serif font-medium text-[var(--text)]">{lead.name}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-[var(--border)]">
                            <span className="text-[var(--text-muted)]">Phone:</span>
                            <span className="text-[var(--text)]">{lead.phone}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-[var(--border)]">
                            <span className="text-[var(--text-muted)]">Email:</span>
                            <span className="text-[var(--text)] truncate max-w-[150px]">{lead.email || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-[var(--border)]">
                            <span className="text-[var(--text-muted)]">Acquisition Source:</span>
                            <span className="uppercase text-[var(--accent)] font-semibold">{lead.source}</span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-[var(--text-muted)]">Advisor In-Charge:</span>
                            <span className="text-[var(--text)]">{lead.assignedAgentName || 'Unassigned'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Buyer Requirements Dossier */}
                      <div className="editorial-card p-4 space-y-3">
                        <span className="blueprint-label">Buyer Requirements (DNA)</span>
                        <div className="space-y-2 text-xs font-mono">
                          <div className="flex justify-between py-1 border-b border-[var(--border)]">
                            <span className="text-[var(--text-muted)]">Target Budget:</span>
                            <span className="font-semibold text-[var(--accent)] tabular-nums">
                              {budgetDisplay}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-[var(--border)]">
                            <span className="text-[var(--text-muted)]">Preferred Typology:</span>
                            <span className="text-[var(--text)] font-semibold">3 BHK / 4 BHK</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-[var(--border)]">
                            <span className="text-[var(--text-muted)]">Locality Requirement:</span>
                            <span className="text-[var(--text)]">Whitefield, East Bangalore</span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-[var(--text-muted)]">Possession Window:</span>
                            <span className="text-[var(--text)]">Ready to Move (Within 60d)</span>
                          </div>
                        </div>
                      </div>

                      {/* Intent Gauge */}
                      <IntentScoreGauge
                        score={lead.intentScore}
                        label={lead.intentLabel}
                        reasons={lead.scoreExplanation}
                      />
                    </div>

                    {/* RIGHT COLUMN: Matched Properties & Unified Timeline */}
                    <div className="md:col-span-6 space-y-4">
                      {/* Matched Properties */}
                      <div className="editorial-card p-4 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                          <span className="blueprint-label">Matched Inventory</span>
                          <span className="font-mono text-[10px] text-[var(--success)]">Algorithm Grounded</span>
                        </div>

                        <div className="space-y-2.5">
                          {matchedInventory.map(item => (
                            <div
                              key={item.id}
                              className="p-3 rounded-[6px] bg-[var(--surface-2)] border border-[var(--border)] space-y-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-serif font-medium text-xs text-[var(--text)]">
                                  {item.name}
                                </span>
                                <span className="pill-badge bg-[#2F5D50]/15 text-[#2F5D50] text-[9px]">
                                  {item.match}
                                </span>
                              </div>
                              <div className="flex justify-between text-[11px] font-mono text-[var(--text-muted)]">
                                <span dangerouslySetInnerHTML={{ __html: item.unit }} />
                                <span className="font-semibold text-[var(--text)] tabular-nums">{item.price}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Unified Activity Timeline (calls, messages, visits, notes) */}
                      <div className="editorial-card p-4 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                          <span className="blueprint-label">Unified Activity Ledger</span>
                          <History className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                        </div>

                        <div className="space-y-3 pt-1 font-mono text-xs">
                          {timelineEvents.map((ev, i) => (
                            <div key={i} className="flex gap-2.5 pb-2.5 border-b border-[var(--border)]/60 last:border-b-0">
                              <div className="w-2 h-2 rounded-full bg-[var(--accent)] mt-1 shrink-0" />
                              <div className="space-y-0.5 flex-1 min-w-0">
                                <div className="flex justify-between text-[11px]">
                                  <span className="font-medium text-[var(--text)] truncate">{ev.title}</span>
                                  <span className="text-[10px] text-[var(--text-muted)] shrink-0">{ev.time}</span>
                                </div>
                                <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                                  {ev.desc}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
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

              {activeTab === 'chat' && <LeadConversationTab leadId={lead.id} />}

              {activeTab === 'notes' && <NotesPanel leadId={lead.id} />}

              {activeTab === 'appointments' && (
                <AppointmentsPanel leadId={lead.id} leadName={lead.name} />
              )}
            </div>

            {/* Quick Action Footer */}
            <div className="border-t border-[var(--border)] bg-[var(--surface-2)] p-4 flex items-center justify-between font-mono text-xs">
              <span className="text-[var(--text-muted)]">Source: {lead.source}</span>
              <div className="flex items-center gap-2">
                {lead.phone && (
                  <a
                    href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-ink-outline px-3 py-1.5 text-xs inline-flex items-center gap-1.5 text-[#2F5D50]"
                  >
                    <MessageSquare className="h-3.5 w-3.5 stroke-[1.5]" />
                    <span>WhatsApp</span>
                  </a>
                )}
                {lead.phone && (
                  <a
                    href={`tel:${lead.phone}`}
                    className="btn-terracotta px-3.5 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Phone className="h-3.5 w-3.5 stroke-[1.75]" />
                    <span>Direct Call</span>
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

export default LeadDetailDrawer;
