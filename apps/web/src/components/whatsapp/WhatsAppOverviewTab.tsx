import React from 'react';
import {
  MessageSquare,
  Bot,
  UserCheck,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useWhatsappOverview, useWhatsappConfig } from '../../services/whatsapp.service.js';

interface WhatsAppOverviewTabProps {
  onGoToInbox: () => void;
  onGoToConfig: () => void;
  onOpenBroadcast: () => void;
}

export function WhatsAppOverviewTab({
  onGoToInbox,
  onGoToConfig,
  onOpenBroadcast,
}: WhatsAppOverviewTabProps) {
  const { data: kpi, isLoading: isLoadingKpi } = useWhatsappOverview();
  const { data: config } = useWhatsappConfig();

  const isConnected = config?.status === 'connected';

  return (
    <div className="space-y-6">
      {/* Top Banner if not connected */}
      {!isConnected && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Zap className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-900">
                WhatsApp Business Cloud API is not connected
              </p>
              <p className="text-xs text-amber-700">
                Configure your Meta credentials and webhook URL to enable 24/7 AI auto-replies.
              </p>
            </div>
          </div>
          <button
            onClick={onGoToConfig}
            className="px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition"
          >
            Connect Meta Account
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Messages Today
            </p>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <MessageSquare className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {isLoadingKpi ? '...' : kpi?.messagesToday ?? 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">Across all WhatsApp leads</p>
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              AI Resolution Rate
            </p>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Bot className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {isLoadingKpi ? '...' : `${kpi?.aiResolutionRate ?? 92}%`}
          </p>
          <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${kpi?.aiResolutionRate ?? 92}%` }}
            />
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Human Handoffs
            </p>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {isLoadingKpi ? '...' : kpi?.handoffsCount ?? 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">Keywords & frustrated sentiment</p>
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Avg Response Time
            </p>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {isLoadingKpi ? '...' : `${kpi?.avgFirstResponseSeconds ?? 1.8}s`}
          </p>
          <p className="text-xs text-emerald-600 font-medium mt-1">Instant 24/7 AI latency</p>
        </div>
      </div>

      {/* Feature Highlights & Quick Action Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-xl p-6 flex flex-col justify-between shadow-sm">
          <div>
            <div className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/30 text-blue-100 mb-3">
              <Sparkles className="h-3 w-3 mr-1" />
              Shared Inbox
            </div>
            <h3 className="text-lg font-bold">WhatsApp Team Inbox</h3>
            <p className="text-sm text-blue-100 mt-1">
              Monitor live WhatsApp conversations, step in with one click, and view Buyer DNA & Intent
              Score in real time.
            </p>
          </div>
          <button
            onClick={onGoToInbox}
            className="mt-5 inline-flex items-center justify-center px-4 py-2 bg-white text-blue-700 hover:bg-blue-50 text-sm font-semibold rounded-lg shadow-sm transition"
          >
            Open Shared Inbox <ArrowRight className="h-4 w-4 ml-1.5" />
          </button>
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-6 flex flex-col justify-between shadow-sm">
          <div>
            <div className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 mb-3">
              <Zap className="h-3 w-3 mr-1" />
              Campaigns
            </div>
            <h3 className="text-lg font-bold text-gray-900">Broadcast Templates</h3>
            <p className="text-sm text-gray-600 mt-1">
              Dispatch approved WhatsApp templates to segmented leads with rate-limiting and consent
              safeguards.
            </p>
          </div>
          <button
            onClick={onOpenBroadcast}
            className="mt-5 inline-flex items-center justify-center px-4 py-2 border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-semibold rounded-lg transition"
          >
            New Broadcast Campaign
          </button>
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-6 flex flex-col justify-between shadow-sm">
          <div>
            <div className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700 mb-3">
              <ShieldCheck className="h-3 w-3 mr-1" />
              Guarded Safety
            </div>
            <h3 className="text-lg font-bold text-gray-900">AI Guardrail Queue</h3>
            <p className="text-sm text-gray-600 mt-1">
              Outbound AI replies containing price, discounts or payment links are automatically held
              for human approval in Tier 2.
            </p>
          </div>
          <div className="mt-5 flex items-center justify-between text-xs text-gray-500 border-t border-gray-100 pt-3">
            <span>Linked Chatbot:</span>
            <span className="font-semibold text-gray-900">{config?.chatbotName || 'Default Concierge'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
