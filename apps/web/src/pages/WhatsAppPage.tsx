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
            <h1 className="text-xl font-serif font-bold text-[var(--text-primary)]">WhatsApp AI Bot & Shared Inbox</h1>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                isConnected ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-[var(--surface-muted)] text-[var(--text-muted)] border border-[var(--border)]'
              }`}
            >
              <Radio className={`h-3 w-3 mr-1 ${isConnected ? 'text-emerald-500 animate-pulse' : 'text-[var(--text-muted)]'}`} />
              {isConnected ? 'Meta Connected' : 'Test Simulator Mode'}
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            24/7 AI-driven property conversations with instant human handoff and lead qualification.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsSimulateOpen(true)}
            className="inline-flex items-center px-3.5 py-2 text-xs font-semibold bg-[var(--accent)] text-white hover:brightness-110 rounded-xl transition shadow-xs"
          >
            <Radio className="h-3.5 w-3.5 mr-1.5 text-white animate-pulse" />
            Simulate Inbound Message
          </button>
          <button
            onClick={() => setIsBroadcastOpen(true)}
            className="inline-flex items-center px-3.5 py-2 text-xs font-semibold bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--surface-muted)] rounded-xl transition shadow-xs"
          >
            <Send className="h-3.5 w-3.5 mr-1.5 text-[var(--accent)]" />
            New Broadcast
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)] space-x-6">
        <button
          onClick={() => setActiveTab('inbox')}
          className={`pb-3 text-xs font-bold flex items-center space-x-1.5 transition border-b-2 -mb-px ${
            activeTab === 'inbox'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          <span>Conversations (Shared Inbox)</span>
        </button>

        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 text-xs font-bold flex items-center space-x-1.5 transition border-b-2 -mb-px ${
            activeTab === 'overview'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <LayoutDashboard className="h-4 w-4" />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('config')}
          className={`pb-3 text-xs font-bold flex items-center space-x-1.5 transition border-b-2 -mb-px ${
            activeTab === 'config'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
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
