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
    <div className="w-80 border-r border-border bg-surface flex flex-col h-[700px]">
      {/* Search Bar */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-faint" />
          <input
            type="text"
            placeholder="Search leads, phone..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-surface transition"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex px-2 pt-2 border-b border-border overflow-x-auto no-scrollbar gap-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => onTabChange(t.id)}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md whitespace-nowrap transition ${
              currentTab === t.id
                ? 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300'
                : 'text-text-muted hover:text-text hover:bg-surface-2'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Conversation Items */}
      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {isLoading ? (
          <div className="p-4 text-center text-xs text-text-faint">Loading conversations...</div>
        ) : conversations.length === 0 ? (
          <div className="p-8 text-center text-xs text-text-faint">No conversations found</div>
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
                    ? 'bg-accent-soft border-accent'
                    : isNeedsHuman
                    ? 'border-amber-500 hover:bg-amber-500/10'
                    : 'border-transparent hover:bg-surface-2'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-text truncate">
                      {conv.visitorName || 'WhatsApp Visitor'}
                    </p>
                    <p className="text-[11px] text-text-muted font-mono">{conv.visitorPhone}</p>
                  </div>
                  {isHot && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-300 ml-2">
                      <Flame className="h-3 w-3 mr-0.5 fill-rose-500 text-rose-500" />
                      {conv.intentScore}
                    </span>
                  )}
                </div>

                <p className="mt-1 text-xs text-text-muted line-clamp-1">
                  {conv.lastMessageSnippet || 'No messages yet'}
                </p>

                <div className="mt-2 flex items-center justify-between text-[10px] text-text-faint">
                  <div className="flex items-center space-x-1.5">
                    {conv.status === 'needs_human' ? (
                      <span className="inline-flex items-center text-amber-600 dark:text-amber-300 font-medium">
                        <AlertCircle className="h-3 w-3 mr-0.5" /> Needs Human
                      </span>
                    ) : conv.status === 'bot' ? (
                      <span className="inline-flex items-center text-blue-600 dark:text-blue-300 font-medium">
                        <Bot className="h-3 w-3 mr-0.5" /> AI Handled
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-text-muted font-medium">
                        <CheckCircle2 className="h-3 w-3 mr-0.5" /> Closed
                      </span>
                    )}

                    {conv.assignedAgentName && (
                      <span className="inline-flex items-center text-text-muted">
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
