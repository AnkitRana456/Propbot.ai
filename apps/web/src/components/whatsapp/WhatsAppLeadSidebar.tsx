import React from 'react';
import {
  Flame,
  User,
  Calendar,
  Building,
  MapPin,
  Clock,
  Compass,
  CreditCard,
  ExternalLink,
} from 'lucide-react';
import type { WhatsAppConversationDetail } from '@propbot/shared';
import { useNavigate } from 'react-router-dom';
import { formatInr } from '../../lib/format.js';

interface WhatsAppLeadSidebarProps {
  conversation: WhatsAppConversationDetail | null;
}

export function WhatsAppLeadSidebar({ conversation }: WhatsAppLeadSidebarProps) {
  const navigate = useNavigate();

  if (!conversation) {
    return (
      <div className="w-80 border-l border-border bg-surface p-6 flex items-center justify-center text-xs text-text-faint h-[700px]">
        Select conversation to view lead DNA
      </div>
    );
  }

  const dna = conversation.buyerDna || {};
  const isHot = conversation.intentScore >= 70;
  const isWarm = conversation.intentScore >= 35 && conversation.intentScore < 70;

  return (
    <div className="w-80 border-l border-border bg-surface flex flex-col h-[700px] overflow-y-auto">
      {/* Lead Profile Header */}
      <div className="p-4 border-b border-border bg-surface-2">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-sm">
            {conversation.visitorName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-xs font-bold text-text truncate">{conversation.visitorName}</h3>
            <p className="text-[11px] text-text-muted font-mono">{conversation.visitorPhone}</p>
          </div>
        </div>

        {/* Intent Score Badge */}
        <div className="mt-3 p-3 bg-surface rounded-xl border border-border flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[10px] font-semibold uppercase text-text-faint tracking-wider">
              Live Intent Score
            </p>
            <div className="flex items-center space-x-1.5 mt-0.5">
              <span
                className={`text-lg font-black ${
                  isHot ? 'text-rose-600 dark:text-rose-300' : isWarm ? 'text-amber-600 dark:text-amber-300' : 'text-blue-600 dark:text-blue-300'
                }`}
              >
                {conversation.intentScore}
              </span>
              <span className="text-xs text-text-faint">/ 100</span>
              <span
                className={`ml-1.5 px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                  isHot
                    ? 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300'
                    : isWarm
                    ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300'
                    : 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300'
                }`}
              >
                {conversation.intentLabel}
              </span>
            </div>
          </div>
          <Flame
            className={`h-7 w-7 ${
              isHot ? 'text-rose-500 fill-rose-500' : isWarm ? 'text-amber-500' : 'text-blue-400'
            }`}
          />
        </div>
      </div>

      {/* Buyer DNA Section */}
      <div className="p-4 space-y-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-text uppercase tracking-wider">Buyer DNA</h4>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-300 font-semibold bg-emerald-50 dark:bg-emerald-500/15 px-1.5 py-0.5 rounded">
            Extracted from Chat
          </span>
        </div>

        <div className="space-y-2.5 text-xs">
          <div className="flex items-start space-x-2 text-text-muted">
            <CreditCard className="h-4 w-4 text-text-faint flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-text/80">Budget: </span>
              {dna.budgetMin || dna.budgetMax ? (
                <span>
                  {dna.budgetMin ? formatInr(dna.budgetMin) : 'Any'} - {dna.budgetMax ? formatInr(dna.budgetMax) : 'Any'}
                </span>
              ) : (
                <span className="text-text-faint">Not specified</span>
              )}
            </div>
          </div>

          <div className="flex items-start space-x-2 text-text-muted">
            <Building className="h-4 w-4 text-text-faint flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-text/80">Configuration: </span>
              {dna.bhk?.length ? (
                <span>{dna.bhk.join(', ')}</span>
              ) : (
                <span className="text-text-faint">Not specified</span>
              )}
            </div>
          </div>

          <div className="flex items-start space-x-2 text-text-muted">
            <MapPin className="h-4 w-4 text-text-faint flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-text/80">Locations: </span>
              {dna.localities?.length ? (
                <span>{dna.localities.join(', ')}</span>
              ) : (
                <span className="text-text-faint">Not specified</span>
              )}
            </div>
          </div>

          <div className="flex items-start space-x-2 text-text-muted">
            <Compass className="h-4 w-4 text-text-faint flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-text/80">Purpose: </span>
              <span>{dna.purpose || 'End-use / Residential'}</span>
            </div>
          </div>

          <div className="flex items-start space-x-2 text-text-muted">
            <Clock className="h-4 w-4 text-text-faint flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-text/80">Timeline: </span>
              <span>{dna.timeline || 'Immediate (1-3 months)'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Assignment & Controls */}
      <div className="p-4 space-y-3">
        <h4 className="text-xs font-bold text-text uppercase tracking-wider">Assignment</h4>
        <div className="flex items-center space-x-2 text-xs text-text/80 p-2.5 bg-surface-2 rounded-lg">
          <User className="h-4 w-4 text-text-faint" />
          <span className="font-medium">
            {conversation.assignedAgentName || 'Unassigned (Pool)'}
          </span>
        </div>

        {/* Action Shortcuts */}
        <div className="pt-2 space-y-2">
          {conversation.leadId && (
            <button
              onClick={() => navigate('/leads')}
              className="w-full inline-flex items-center justify-center px-3 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 rounded-lg transition"
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> View Lead in CRM
            </button>
          )}

          <button
            onClick={() => navigate('/appointments')}
            className="w-full inline-flex items-center justify-center px-3 py-2 text-xs font-semibold text-text/80 border border-border hover:bg-surface-2 rounded-lg transition"
          >
            <Calendar className="h-3.5 w-3.5 mr-1.5" /> Book Site Visit
          </button>
        </div>
      </div>
    </div>
  );
}
