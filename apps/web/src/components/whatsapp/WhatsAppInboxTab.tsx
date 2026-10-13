import React, { useState } from 'react';
import type { WhatsappConversationFilterTab } from '@propbot/shared';
import {
  useWhatsappConversations,
  useWhatsappConversationDetail,
} from '../../services/whatsapp.service.js';
import { WhatsAppConversationList } from './WhatsAppConversationList.js';
import { WhatsAppChatThread } from './WhatsAppChatThread.js';
import { WhatsAppLeadSidebar } from './WhatsAppLeadSidebar.js';

export function WhatsAppInboxTab() {
  const [currentTab, setCurrentTab] = useState<WhatsappConversationFilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: convData, isLoading: isLoadingList } = useWhatsappConversations({
    tab: currentTab,
    search: searchQuery,
  });

  const conversations = convData?.items || [];

  // Default to first conversation if none selected
  const activeId = selectedId || (conversations.length > 0 ? conversations[0]?.id ?? null : null);

  const { data: activeDetail, isLoading: isLoadingDetail } = useWhatsappConversationDetail(activeId);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col md:flex-row">
      {/* Left Pane: Conversation List */}
      <WhatsAppConversationList
        conversations={conversations}
        selectedId={activeId}
        onSelect={id => setSelectedId(id)}
        currentTab={currentTab}
        onTabChange={tab => {
          setCurrentTab(tab);
          setSelectedId(null);
        }}
        searchQuery={searchQuery}
        onSearchChange={q => setSearchQuery(q)}
        isLoading={isLoadingList}
      />

      {/* Center Pane: Active Message Thread */}
      <WhatsAppChatThread
        conversation={activeDetail || null}
        isLoading={isLoadingDetail && !activeDetail}
      />

      {/* Right Pane: Lead Sidebar & Buyer DNA */}
      <WhatsAppLeadSidebar conversation={activeDetail || null} />
    </div>
  );
}
