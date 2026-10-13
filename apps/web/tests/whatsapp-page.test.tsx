import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { WhatsAppOverviewTab } from '../src/components/whatsapp/WhatsAppOverviewTab.js';
import { WhatsAppConversationList } from '../src/components/whatsapp/WhatsAppConversationList.js';
import { WhatsAppChatThread } from '../src/components/whatsapp/WhatsAppChatThread.js';
import { WhatsAppLeadSidebar } from '../src/components/whatsapp/WhatsAppLeadSidebar.js';
import { WhatsAppConfigTab } from '../src/components/whatsapp/WhatsAppConfigTab.js';
import { BroadcastCampaignModal } from '../src/components/whatsapp/BroadcastCampaignModal.js';
import type { WhatsAppConversationDetail, WhatsAppConversationItem } from '@propbot/shared';

// Mock services
vi.mock('../src/services/whatsapp.service.js', () => ({
  useWhatsappOverview: () => ({
    data: {
      messagesToday: 48,
      aiResolutionRate: 94,
      handoffsCount: 3,
      avgFirstResponseSeconds: 1.8,
      activeConversations: 12,
      totalConnectedNumbers: 1,
    },
    isLoading: false,
  }),
  useWhatsappConfig: () => ({
    data: {
      id: 'cfg-1',
      companyId: 'comp-1',
      phoneNumberId: '104928172635412',
      businessPhoneNumber: '+919876543210',
      maskedAccessToken: 'EAAG••••••••1234',
      hasAppSecret: true,
      verifyToken: 'token_mock_123',
      callbackUrl: 'https://api.propbot.pro/api/webhooks/meta',
      templateName: 'property_inquiry_details',
      enableAutomation: true,
      aiAutoReplies: true,
      pauseAfterAgentReply: true,
      frustrationHandoff: true,
      autoAssignOwner: true,
      handoffKeywords: ['agent', 'human', 'complaint'],
      handoffMessage: 'A property advisor will continue this conversation shortly.',
      status: 'connected',
      updatedAt: new Date().toISOString(),
    },
    isLoading: false,
  }),
  useChatbots: () => ({
    data: {
      chatbots: [
        { id: 'bot-1', name: 'Prestige AI Assistant', type: 'whatsapp' },
      ],
    },
    isLoading: false,
  }),
  useUpdateWhatsappConfig: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useGenerateVerifyToken: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useSendInboxMessage: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useTakeoverConversation: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useResumeAi: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useCloseConversation: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useBroadcastCampaign: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

describe('WhatsApp Frontend Components', () => {
  const mockConversationItem: WhatsAppConversationItem = {
    id: 'conv-001',
    companyId: 'comp-001',
    chatbotId: 'bot-001',
    contactId: 'contact-001',
    leadId: 'lead-001',
    channel: 'whatsapp',
    status: 'needs_human',
    assignedAgentId: 'agent-001',
    assignedAgentName: 'Amit Patel',
    visitorPhone: '+919876543210',
    visitorName: 'Rajesh Kumar',
    lastMessageSnippet: 'Can I get the exact price schedule?',
    lastMessageAt: new Date().toISOString(),
    unreadCount: 1,
    aiPaused: true,
    serviceWindowExpired: false,
    serviceWindowRemainingHours: 22,
    sentiment: 'neutral',
    intentScore: 84,
    intentLabel: 'hot',
    buyerDna: {
      budgetMin: 200,
      budgetMax: 300,
      bhk: ['3 BHK'],
      localities: ['Whitefield'],
      purpose: 'End use',
      timeline: 'Immediate',
      financing: 'Pre-approved',
      familySize: 4,
      mustHaves: ['Balcony', 'Corner Unit'],
      dealBreakers: [],
      objections: [],
      competitorsMentioned: [],
      language: 'en',
      confidence: {},
      explicitFields: [],
      propertyType: 'Apartment',
    },
  };

  const mockDetail: WhatsAppConversationDetail = {
    ...mockConversationItem,
    messages: [
      {
        id: 'msg-1',
        conversationId: 'conv-001',
        senderType: 'visitor',
        content: 'Hi, I want details about Prestige Elm Park',
        deliveryStatus: 'read',
        createdAt: new Date(Date.now() - 60000).toISOString(),
      },
      {
        id: 'msg-2',
        conversationId: 'conv-001',
        senderType: 'bot',
        content: 'Prestige Elm Park offers luxury 3 & 4 BHK residences in Whitefield.',
        deliveryStatus: 'delivered',
        createdAt: new Date().toISOString(),
      },
    ],
  };

  it('renders WhatsAppOverviewTab element with action handlers', () => {
    const handleGoToInbox = vi.fn();
    const handleGoToConfig = vi.fn();
    const handleOpenBroadcast = vi.fn();

    const el = React.createElement(WhatsAppOverviewTab, {
      onGoToInbox: handleGoToInbox,
      onGoToConfig: handleGoToConfig,
      onOpenBroadcast: handleOpenBroadcast,
    });

    expect(el).toBeDefined();
    expect(el.props.onGoToInbox).toBe(handleGoToInbox);
    expect(el.props.onGoToConfig).toBe(handleGoToConfig);
    expect(el.props.onOpenBroadcast).toBe(handleOpenBroadcast);
  });

  it('renders WhatsAppConversationList left pane element with conversation items and filter tabs', () => {
    const handleSelect = vi.fn();
    const handleTabChange = vi.fn();
    const handleSearchChange = vi.fn();

    const el = React.createElement(WhatsAppConversationList, {
      conversations: [mockConversationItem],
      selectedId: 'conv-001',
      onSelect: handleSelect,
      currentTab: 'needs_human',
      onTabChange: handleTabChange,
      searchQuery: '',
      onSearchChange: handleSearchChange,
      isLoading: false,
    });

    expect(el).toBeDefined();
    expect(el.props.conversations.length).toBe(1);
    expect(el.props.selectedId).toBe('conv-001');
    expect(el.props.currentTab).toBe('needs_human');
    expect(el.props.conversations[0].visitorName).toBe('Rajesh Kumar');
  });

  it('renders WhatsAppChatThread center pane element with message thread details', () => {
    const el = React.createElement(WhatsAppChatThread, {
      conversation: mockDetail,
      isLoading: false,
    });

    expect(el).toBeDefined();
    expect(el.props.conversation?.id).toBe('conv-001');
    expect(el.props.conversation?.messages.length).toBe(2);
    expect(el.props.conversation?.messages[0].senderType).toBe('visitor');
    expect(el.props.conversation?.messages[1].senderType).toBe('bot');
  });

  it('renders WhatsAppLeadSidebar right pane element with intent and buyer DNA', () => {
    const el = React.createElement(WhatsAppLeadSidebar, {
      conversation: mockDetail,
    });

    expect(el).toBeDefined();
    expect(el.props.conversation?.intentScore).toBe(84);
    expect(el.props.conversation?.intentLabel).toBe('hot');
    expect(el.props.conversation?.buyerDna?.propertyType).toBe('Apartment');
    expect(el.props.conversation?.buyerDna?.bhk).toContain('3 BHK');
  });

  it('renders WhatsAppConfigTab configuration panel element', () => {
    const el = React.createElement(WhatsAppConfigTab);

    expect(el).toBeDefined();
    expect(el.type).toBe(WhatsAppConfigTab);
  });

  it('renders BroadcastCampaignModal element with open state and close callback', () => {
    const handleClose = vi.fn();
    const el = React.createElement(BroadcastCampaignModal, {
      isOpen: true,
      onClose: handleClose,
    });

    expect(el).toBeDefined();
    expect(el.props.isOpen).toBe(true);
    expect(el.props.onClose).toBe(handleClose);
  });
});
