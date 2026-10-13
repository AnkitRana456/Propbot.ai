import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  ShieldAlert,
  Clock,
  Check,
  CheckCheck,
  AlertTriangle,
  Play,
  Pause,
  XCircle,
  FileText,
  Languages,
  Sparkles,
  Mic,
} from 'lucide-react';
import type { WhatsAppConversationDetail } from '@propbot/shared';
import {
  useSendInboxMessage,
  useTakeoverConversation,
  useResumeAi,
  useCloseConversation,
} from '../../services/whatsapp.service.js';
import {
  useTranslateText,
  useCopilotSuggestReply,
} from '../../services/copilot.service.js';

interface WhatsAppChatThreadProps {
  conversation: WhatsAppConversationDetail | null;
  isLoading: boolean;
}

export function WhatsAppChatThread({ conversation, isLoading }: WhatsAppChatThreadProps) {
  const [messageText, setMessageText] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [translations, setTranslations] = useState<Record<string, { text: string; language: string }>>({});
  const [translatingIds, setTranslatingIds] = useState<Record<string, boolean>>({});
  const [suggestedReplies, setSuggestedReplies] = useState<Array<{ id: string; title: string; text: string }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sendMessageMutation = useSendInboxMessage();
  const takeoverMutation = useTakeoverConversation();
  const resumeAiMutation = useResumeAi();
  const closeMutation = useCloseConversation();
  const translateMutation = useTranslateText();
  const suggestReplyMutation = useCopilotSuggestReply(conversation?.leadId || '');

  const handleTranslate = async (msgId: string, content: string) => {
    if (translations[msgId]) {
      const next = { ...translations };
      delete next[msgId];
      setTranslations(next);
      return;
    }
    setTranslatingIds(prev => ({ ...prev, [msgId]: true }));
    try {
      const res = await translateMutation.mutateAsync({ text: content, targetLanguage: 'en' });
      setTranslations(prev => ({
        ...prev,
        [msgId]: { text: res.translatedText, language: res.detectedLanguageName || res.detectedLanguage },
      }));
    } finally {
      setTranslatingIds(prev => ({ ...prev, [msgId]: false }));
    }
  };

  const handleFetchSuggestions = async () => {
    if (!conversation?.leadId) return;
    const lastVisitorMsg = [...conversation.messages].reverse().find(m => m.senderType === 'visitor')?.content;
    const res = await suggestReplyMutation.mutateAsync({
      lastVisitorMessage: lastVisitorMsg,
      tone: 'warm',
    });
    if (res?.suggestions) {
      setSuggestedReplies(res.suggestions);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages]);

  if (isLoading || !conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 text-gray-400 text-xs">
        {isLoading ? 'Loading conversation thread...' : 'Select a conversation from the left pane'}
      </div>
    );
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() && !selectedTemplate) return;

    await sendMessageMutation.mutateAsync({
      conversationId: conversation.id,
      input: {
        content: messageText.trim() || 'Template message dispatched',
        templateName: selectedTemplate || undefined,
      },
    });

    setMessageText('');
    setSelectedTemplate('');
  };

  const isWindowExpired = conversation.serviceWindowExpired;

  return (
    <div className="flex-1 flex flex-col bg-white h-[700px]">
      {/* Thread Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white z-10">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-bold text-gray-900">{conversation.visitorName}</h2>
            <span
              className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                conversation.status === 'needs_human'
                  ? 'bg-amber-100 text-amber-800'
                  : conversation.status === 'bot'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {conversation.status === 'needs_human'
                ? 'Needs Human'
                : conversation.status === 'bot'
                ? 'AI Active'
                : 'Closed'}
            </span>
          </div>
          <p className="text-xs text-gray-500 font-mono mt-0.5">{conversation.visitorPhone}</p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          {conversation.aiPaused ? (
            <button
              onClick={() => resumeAiMutation.mutate(conversation.id)}
              disabled={resumeAiMutation.isPending}
              className="inline-flex items-center px-2.5 py-1 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg transition"
            >
              <Play className="h-3 w-3 mr-1" /> Resume AI
            </button>
          ) : (
            <button
              onClick={() => takeoverMutation.mutate(conversation.id)}
              disabled={takeoverMutation.isPending}
              className="inline-flex items-center px-2.5 py-1 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg transition"
            >
              <Pause className="h-3 w-3 mr-1" /> Take Over
            </button>
          )}

          {conversation.status !== 'closed' && (
            <button
              onClick={() => closeMutation.mutate(conversation.id)}
              disabled={closeMutation.isPending}
              className="inline-flex items-center px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100 border border-gray-200 rounded-lg transition"
            >
              <XCircle className="h-3 w-3 mr-1 text-gray-400" /> Close
            </button>
          )}
        </div>
      </div>

      {/* 24-Hour Window Notification Banner */}
      {isWindowExpired ? (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-xs text-amber-800">
          <div className="flex items-center space-x-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span>
              <strong>24-Hour Customer Window Expired.</strong> Freeform messaging blocked by Meta policy. Send an approved template.
            </span>
          </div>
          <button
            onClick={() => setSelectedTemplate('property_inquiry_details')}
            className="px-2 py-0.5 text-[11px] font-semibold bg-amber-200 hover:bg-amber-300 rounded text-amber-900 transition"
          >
            Select Template
          </button>
        </div>
      ) : (
        <div className="bg-emerald-50/60 border-b border-emerald-100 px-4 py-1.5 flex items-center space-x-2 text-[11px] text-emerald-800">
          <Clock className="h-3.5 w-3.5 text-emerald-600" />
          <span>
            24-Hour Window Active ({conversation.serviceWindowRemainingHours}h remaining) — Freeform messages permitted.
          </span>
        </div>
      )}

      {/* Messages Thread Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/40">
        {conversation.messages.length === 0 ? (
          <div className="text-center text-xs text-gray-400 py-10">No messages in this conversation</div>
        ) : (
          conversation.messages.map(msg => {
            const isVisitor = msg.senderType === 'visitor';
            const isBot = msg.senderType === 'bot';
            const isGuarded = msg.isGuardedHold;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isVisitor ? 'items-start' : 'items-end'}`}
              >
                {/* Sender Tag */}
                <div className="flex items-center space-x-1 text-[10px] text-gray-400 mb-1 px-1">
                  {isVisitor ? (
                    <span>{conversation.visitorName}</span>
                  ) : isBot ? (
                    <span className="inline-flex items-center text-blue-600 font-semibold">
                      <Bot className="h-2.5 w-2.5 mr-0.5" /> PropBot AI
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-indigo-600 font-semibold">
                      <User className="h-2.5 w-2.5 mr-0.5" /> Agent
                    </span>
                  )}
                  <span>•</span>
                  <span>
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {/* Message Bubble */}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs shadow-sm ${
                    isGuarded
                      ? 'bg-amber-50 border border-amber-300 text-amber-900'
                      : isVisitor
                      ? 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                      : isBot
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-indigo-600 text-white rounded-br-sm'
                  }`}
                >
                  {isGuarded && (
                    <div className="flex items-center text-amber-700 font-semibold text-[11px] mb-1">
                      <ShieldAlert className="h-3.5 w-3.5 mr-1" />
                      Guarded AI Reply (Held for Approval)
                    </div>
                  )}

                  {Boolean(msg.metadata?.isVoiceNote) && (
                    <div className="flex items-center text-purple-600 font-semibold text-[10px] mb-1 bg-purple-50 px-2 py-0.5 rounded-full inline-flex">
                      <Mic className="h-2.5 w-2.5 mr-1 text-purple-600 animate-pulse" />
                      Voice Note (Transcribed)
                    </div>
                  )}

                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

                  {/* Inline Translation on Visitor Message */}
                  {isVisitor && (
                    <div className="mt-1.5 pt-1 border-t border-gray-100 flex items-center justify-between text-[10px]">
                      <button
                        type="button"
                        onClick={() => handleTranslate(msg.id, msg.content)}
                        disabled={translatingIds[msg.id]}
                        className="inline-flex items-center text-gray-500 hover:text-blue-600 transition font-medium"
                      >
                        <Languages className="h-2.5 w-2.5 mr-1 text-gray-400" />
                        {translatingIds[msg.id]
                          ? 'Translating...'
                          : translations[msg.id]
                          ? 'Show Original'
                          : 'Translate to English'}
                      </button>
                    </div>
                  )}

                  {translations[msg.id] ? (
                    <div className="mt-1.5 p-2 bg-blue-50/80 border border-blue-100 rounded-lg text-blue-900 text-xs">
                      <div className="text-[10px] font-semibold text-blue-600 mb-0.5">
                        Translated from {translations[msg.id]?.language}:
                      </div>
                      <p className="leading-relaxed">{translations[msg.id]?.text}</p>
                    </div>
                  ) : null}

                  {/* Delivery Status Indicator */}
                  {!isVisitor && (
                    <div className="flex items-center justify-end space-x-1 mt-1 text-[10px] opacity-75">
                      {msg.deliveryStatus === 'read' ? (
                        <CheckCheck className="h-3 w-3 text-cyan-200" />
                      ) : msg.deliveryStatus === 'delivered' ? (
                        <CheckCheck className="h-3 w-3" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input / Send Area */}
      <form onSubmit={handleSend} className="p-3 border-t border-gray-200 bg-white space-y-2">
        {/* Suggest Replies Pills if any */}
        {suggestedReplies.length > 0 && (
          <div className="p-2 bg-purple-50/60 border border-purple-100 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-[10px] font-semibold text-purple-700">
              <span className="flex items-center">
                <Sparkles className="h-3 w-3 mr-1 text-purple-600" /> AI Suggested Replies
              </span>
              <button
                type="button"
                onClick={() => setSuggestedReplies([])}
                className="text-gray-400 hover:text-gray-600"
              >
                Dismiss
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {suggestedReplies.map(sug => (
                <button
                  key={sug.id}
                  type="button"
                  onClick={() => setMessageText(sug.text)}
                  className="text-left text-xs bg-white hover:bg-purple-100/70 border border-purple-200 text-purple-950 rounded-lg px-2.5 py-1.5 transition shadow-2xs"
                >
                  <span className="font-semibold block text-[11px] text-purple-800">{sug.title}</span>
                  <span className="text-gray-600 line-clamp-1 text-[11px]">{sug.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between space-x-2">
          {/* Quick Template Picker */}
          <div className="flex items-center space-x-2">
            <select
              value={selectedTemplate}
              onChange={e => {
                setSelectedTemplate(e.target.value);
                if (e.target.value) {
                  setMessageText(`[Template: ${e.target.value}]`);
                }
              }}
              className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Quick Replies / Templates</option>
              <option value="property_inquiry_details">Property Details Template</option>
              <option value="site_visit_invitation">Site Visit Invitation</option>
              <option value="brochure_share_followup">Brochure Share Follow-up</option>
            </select>

            {selectedTemplate && (
              <span className="inline-flex items-center text-[11px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded font-medium">
                <FileText className="h-3 w-3 mr-1" /> Template selected
              </span>
            )}
          </div>

          {/* AI Copilot Suggest Reply Button */}
          {conversation.leadId && (
            <button
              type="button"
              onClick={handleFetchSuggestions}
              disabled={suggestReplyMutation.isPending}
              className="inline-flex items-center text-xs font-semibold text-purple-700 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg px-2.5 py-1.5 transition"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1 text-purple-600" />
              {suggestReplyMutation.isPending ? 'Generating...' : 'Suggest Reply'}
            </button>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="text"
            placeholder={
              isWindowExpired
                ? 'Select an approved template above to message this lead...'
                : 'Type your message (sending will auto-pause AI)...'
            }
            disabled={isWindowExpired && !selectedTemplate}
            value={messageText}
            onChange={e => setMessageText(e.target.value)}
            className="flex-1 text-xs px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={
              (!messageText.trim() && !selectedTemplate) ||
              sendMessageMutation.isPending ||
              (isWindowExpired && !selectedTemplate)
            }
            className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-40 transition shadow-sm"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
