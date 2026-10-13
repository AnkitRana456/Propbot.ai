import React, { useState } from 'react';
import {
  MessageSquare,
  LayoutDashboard,
  Settings,
  Send,
  Radio,
} from 'lucide-react';
import { WhatsAppOverviewTab } from '../components/whatsapp/WhatsAppOverviewTab.js';
import { WhatsAppInboxTab } from '../components/whatsapp/WhatsAppInboxTab.js';
import { WhatsAppConfigTab } from '../components/whatsapp/WhatsAppConfigTab.js';
import { BroadcastCampaignModal } from '../components/whatsapp/BroadcastCampaignModal.js';
import { SimulateInboundModal } from '../components/whatsapp/SimulateInboundModal.js';
import { useWhatsappConfig } from '../services/whatsapp.service.js';

export function WhatsAppPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'inbox' | 'config'>('inbox');
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [isSimulateOpen, setIsSimulateOpen] = useState(false);
  const { data: config } = useWhatsappConfig();

  const isConnected = config?.status === 'connected';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-xl font-bold text-gray-900">WhatsApp AI Bot & Shared Inbox</h1>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                isConnected ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
              }`}
            >
              <Radio className={`h-3 w-3 mr-1 ${isConnected ? 'text-emerald-500 animate-pulse' : 'text-gray-400'}`} />
              {isConnected ? 'Meta Connected' : 'Disconnected'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            24/7 AI-driven property conversations with instant human handoff and lead qualification.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsSimulateOpen(true)}
            className="inline-flex items-center px-3.5 py-2 text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 rounded-xl transition shadow-xs"
          >
            <Radio className="h-3.5 w-3.5 mr-1.5 text-emerald-600 animate-pulse" />
            Simulate Inbound Message
          </button>
          <button
            onClick={() => setIsBroadcastOpen(true)}
            className="inline-flex items-center px-3.5 py-2 text-xs font-semibold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl transition shadow-xs"
          >
            <Send className="h-3.5 w-3.5 mr-1.5 text-purple-600" />
            New Broadcast
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 space-x-6">
        <button
          onClick={() => setActiveTab('inbox')}
          className={`pb-3 text-xs font-bold flex items-center space-x-1.5 transition border-b-2 -mb-px ${
            activeTab === 'inbox'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          <span>Conversations (Shared Inbox)</span>
        </button>

        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 text-xs font-bold flex items-center space-x-1.5 transition border-b-2 -mb-px ${
            activeTab === 'overview'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <LayoutDashboard className="h-4 w-4" />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('config')}
          className={`pb-3 text-xs font-bold flex items-center space-x-1.5 transition border-b-2 -mb-px ${
            activeTab === 'config'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Settings className="h-4 w-4" />
          <span>Configuration</span>
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'overview' && (
        <WhatsAppOverviewTab
          onGoToInbox={() => setActiveTab('inbox')}
          onGoToConfig={() => setActiveTab('config')}
          onOpenBroadcast={() => setIsBroadcastOpen(true)}
        />
      )}

      {activeTab === 'inbox' && <WhatsAppInboxTab />}

      {activeTab === 'config' && <WhatsAppConfigTab />}

      {/* Broadcast Campaign Modal */}
      <BroadcastCampaignModal
        isOpen={isBroadcastOpen}
        onClose={() => setIsBroadcastOpen(false)}
      />

      {/* Simulate Inbound Modal */}
      <SimulateInboundModal
        isOpen={isSimulateOpen}
        onClose={() => setIsSimulateOpen(false)}
      />
    </div>
  );
}
