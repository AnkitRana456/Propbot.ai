import React from 'react';
import {
  MessageSquare,
  Bot,
  User,
  ShieldCheck,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useLeadConversation } from '../../services/leads.service.js';
import { Skeleton } from '../common/Skeleton.js';

interface LeadConversationTabProps {
  leadId: string;
}

export const LeadConversationTab: React.FC<LeadConversationTabProps> = ({ leadId }) => {
  const { data, isLoading } = useLeadConversation(leadId);

  if (isLoading) {
    return (
      <div className="space-y-3 py-4">
        <Skeleton className="h-14 w-3/4 rounded-2xl" />
        <Skeleton className="h-20 w-4/5 rounded-2xl ml-auto" />
        <Skeleton className="h-16 w-2/3 rounded-2xl" />
      </div>
    );
  }

  const messages = data?.messages || [];

  if (messages.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center">
        <MessageSquare className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
        <h5 className="text-sm font-bold text-slate-700 dark:text-slate-300">
          No Chat Conversation Found
        </h5>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          This lead was created directly or via import, without an associated live website widget or WhatsApp chat.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header channel badge */}
      <div className="flex items-center justify-between px-1 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700 dark:text-slate-300">Channel:</span>
          <span className="capitalize px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-bold text-[10px]">
            {data?.channel || 'Web Widget'}
          </span>
          <span className="capitalize px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-bold text-[10px]">
            Status: {data?.status || 'Active'}
          </span>
        </div>
        <span>{messages.length} messages</span>
      </div>

      {/* Messages stream */}
      <div className="space-y-3 pt-1">
        {messages.map((m) => {
          const isVisitor = m.senderType === 'visitor';
          const isBot = m.senderType === 'bot';
          const citations = Array.isArray(m.metadata?.citations) ? m.metadata.citations : [];

          return (
            <div
              key={m.id}
              className={`flex flex-col ${isVisitor ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-slate-400">
                {isVisitor ? (
                  <>
                    <User className="h-3 w-3 text-slate-400" />
                    <span className="font-medium text-slate-600 dark:text-slate-300">Prospect</span>
                  </>
                ) : isBot ? (
                  <>
                    <Bot className="h-3 w-3 text-blue-500" />
                    <span className="font-bold text-blue-600 dark:text-blue-400">AI Assistant</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-3 w-3 text-emerald-500" />
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">Agent</span>
                  </>
                )}
                <span>•</span>
                <Clock className="h-2.5 w-2.5" />
                <span>
                  {new Date(m.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-xs ${
                  isVisitor
                    ? 'bg-blue-600 text-white rounded-tr-xs'
                    : isBot
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/80 rounded-tl-xs'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/60 rounded-tl-xs'
                }`}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>

                {/* Grounding citations pill if present */}
                {citations.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[10px] space-y-1">
                    <span className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                      <Sparkles className="h-2.5 w-2.5" /> Verified Sources:
                    </span>
                    {(citations as Array<{ sourceTitle?: string; sectionHeader?: string }>).map((c, idx) => (
                      <div key={idx} className="text-slate-500 dark:text-slate-400">
                        • {c.sourceTitle || 'Knowledge Base'} {c.sectionHeader ? `(${c.sectionHeader})` : ''}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
