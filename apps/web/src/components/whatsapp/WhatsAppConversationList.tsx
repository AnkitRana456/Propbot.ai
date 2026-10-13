import React from 'react';
import { Search, Flame, Bot, AlertCircle, CheckCircle2, User } from 'lucide-react';
import type {
  WhatsAppConversationItem,
  WhatsappConversationFilterTab,
} from '@propbot/shared';

interface WhatsAppConversationListProps {
  conversations: WhatsAppConversationItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  currentTab: WhatsappConversationFilterTab;
  onTabChange: (tab: WhatsappConversationFilterTab) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isLoading: boolean;
}

export function WhatsAppConversationList({
  conversations,
  selectedId,
  onSelect,
  currentTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  isLoading,
}: WhatsAppConversationListProps) {
  const tabs: Array<{ id: WhatsappConversationFilterTab; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'mine', label: 'Mine' },
    { id: 'needs_human', label: 'Needs Human' },
    { id: 'ai_handled', label: 'AI Handled' },
    { id: 'unassigned', label: 'Unassigned' },
    { id: 'closed', label: 'Closed' },
  ];

  return (
    <div className="w-80 border-r border-gray-200 bg-white flex flex-col h-[700px]">
      {/* Search Bar */}
      <div className="p-3 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search leads, phone..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex px-2 pt-2 border-b border-gray-100 overflow-x-auto no-scrollbar gap-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => onTabChange(t.id)}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md whitespace-nowrap transition ${
              currentTab === t.id
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Conversation Items */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
        {isLoading ? (
          <div className="p-4 text-center text-xs text-gray-400">Loading conversations...</div>
        ) : conversations.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-400">No conversations found</div>
        ) : (
          conversations.map(conv => {
            const isSelected = conv.id === selectedId;
            const isHot = conv.intentScore >= 70;
            const isNeedsHuman = conv.status === 'needs_human';

            return (
              <div
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={`p-3.5 cursor-pointer transition text-left border-l-4 ${
                  isSelected
                    ? 'bg-blue-50/60 border-blue-600'
                    : isNeedsHuman
                    ? 'border-amber-500 hover:bg-amber-50/30'
                    : 'border-transparent hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-gray-900 truncate">
                      {conv.visitorName || 'WhatsApp Visitor'}
                    </p>
                    <p className="text-[11px] text-gray-500 font-mono">{conv.visitorPhone}</p>
                  </div>
                  {isHot && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 ml-2">
                      <Flame className="h-3 w-3 mr-0.5 fill-rose-500 text-rose-500" />
                      {conv.intentScore}
                    </span>
                  )}
                </div>

                <p className="mt-1 text-xs text-gray-600 line-clamp-1">
                  {conv.lastMessageSnippet || 'No messages yet'}
                </p>

                <div className="mt-2 flex items-center justify-between text-[10px] text-gray-400">
                  <div className="flex items-center space-x-1.5">
                    {conv.status === 'needs_human' ? (
                      <span className="inline-flex items-center text-amber-600 font-medium">
                        <AlertCircle className="h-3 w-3 mr-0.5" /> Needs Human
                      </span>
                    ) : conv.status === 'bot' ? (
                      <span className="inline-flex items-center text-blue-600 font-medium">
                        <Bot className="h-3 w-3 mr-0.5" /> AI Handled
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-gray-500 font-medium">
                        <CheckCircle2 className="h-3 w-3 mr-0.5" /> Closed
                      </span>
                    )}

                    {conv.assignedAgentName && (
                      <span className="inline-flex items-center text-gray-500">
                        • <User className="h-2.5 w-2.5 mx-0.5" /> {conv.assignedAgentName}
                      </span>
                    )}
                  </div>

                  <span>
                    {new Date(conv.lastMessageAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
