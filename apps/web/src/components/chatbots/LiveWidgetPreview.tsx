import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ChatbotConfig, ChatbotType } from '@propbot/shared';
import { useCaptureLead } from '../../services/leads.service.js';
import { MessageSquare, X, Send, Sparkles, RotateCcw, Smartphone, Monitor, CheckCircle2, ChevronRight, Shield, Building, Loader2 } from 'lucide-react';

interface LiveWidgetPreviewProps {
  name: string;
  type?: ChatbotType;
  config: ChatbotConfig;
}

interface ChatMessage {
  id: string;
  sender: 'bot' | 'visitor';
  text: string;
  timestamp: string;
}

export const LiveWidgetPreview: React.FC<LiveWidgetPreviewProps> = ({ name, config }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [viewMode, setViewMode] = useState<'focus' | 'overlay'>('focus');
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [capturedLeadData, setCapturedLeadData] = useState<{ name: string; phone: string } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const captureLeadMutation = useCaptureLead();

  const [leadFormValues, setLeadFormValues] = useState({
    fullName: '',
    email: '',
    phone: '',
  });

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'bot',
      text:
        config.behavior?.greetingMessage ||
        'Hello! Welcome to our luxury real estate showcase. How can I help you find your dream property today?',
      timestamp: 'Just now',
    },
  ]);

  const appearance = config.appearance || {
    primaryColor: '#B84A22',
    textColor: '#ffffff',
    backgroundColor: '#ffffff',
    headerColor: '#14110E',
    borderRadius: 16,
    position: 'bottom-right',
    botName: 'Property Advisor AI',
  };

  const primaryColor = appearance.primaryColor || '#B84A22';
  const headerColor = appearance.headerColor || '#14110E';
  const borderRadius = appearance.borderRadius ?? 16;
  const position = appearance.position || 'bottom-right';
  const botName = appearance.botName || name || 'Property Advisor AI';
  const quickQuestions = config.behavior?.quickQuestions || [
    '2BHK & 3BHK Pricing',
    'RERA & Possession Date',
    'Schedule a Site Visit',
  ];

  const handleSendMessage = (textToSend?: string) => {
    const text = textToSend || inputValue;
    if (!text.trim()) return;

    const newVisitorMsg: ChatMessage = {
      id: String(Date.now()),
      sender: 'visitor',
      text: text.trim(),
      timestamp: 'Just now',
    };

    setMessages(prev => [...prev, newVisitorMsg]);
    if (!textToSend) setInputValue('');

    setTimeout(() => {
      const lower = text.toLowerCase();
      let replyText =
        'Thank you for asking! We have premium residences starting from ₹1.15 Cr with lake views and 80% open landscape.';

      if (lower.includes('visit') || lower.includes('tour')) {
        replyText =
          "We'd love to host you for a private physical walkthrough. Our advisors are available 7 days a week.";
      } else if (
        lower.includes('brochure') ||
        lower.includes('pricing') ||
        lower.includes('price')
      ) {
        replyText =
          'I can send you the official RERA master brochure, pricing breakdown, and exclusive payment schedules right away.';
      }

      const botReply: ChatMessage = {
        id: String(Date.now() + 1),
        sender: 'bot',
        text: replyText,
        timestamp: 'Just now',
      };

      setMessages(prev => [...prev, botReply]);

      if (config.leadCapture?.enabled !== false && !showLeadForm && !leadSubmitted) {
        setShowLeadForm(true);
      }
    }, 600);
  };

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadFormValues.fullName.trim() || !leadFormValues.phone.trim()) return;

    setSubmitError(null);
    try {
      await captureLeadMutation.mutateAsync({
        name: leadFormValues.fullName.trim(),
        phone: leadFormValues.phone.trim(),
        email: leadFormValues.email.trim() || undefined,
        budget: '₹1.80 Cr - ₹2.50 Cr',
        bhk: '3 BHK',
        location: 'Whitefield, Bangalore',
        purpose: 'End-use',
        timeline: 'Within 3 months',
        metadata: {
          source: 'Website Chatbot Widget',
          capturedVia: 'Live Preview Interactive Test',
          projectInterest: name || 'Prestige Lakeside Habitat',
        },
      });
      setCapturedLeadData({
        name: leadFormValues.fullName.trim(),
        phone: leadFormValues.phone.trim(),
      });
      setLeadSubmitted(true);
    } catch (err: unknown) {
      console.error('Lead capture error:', err);
      setSubmitError((err instanceof Error ? err.message : '') || 'Failed to submit lead to CRM. Please try again.');
    }
  };

  const handleReset = () => {
    setMessages([
      {
        id: '1',
        sender: 'bot',
        text:
          config.behavior?.greetingMessage ||
          'Hello! Welcome to our luxury real estate showcase. How can I help you find your dream property today?',
        timestamp: 'Just now',
      },
    ]);
    setShowLeadForm(false);
    setLeadSubmitted(false);
    setSubmitError(null);
    setInputValue('');
  };

  return (
    <div className="flex flex-col h-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-sm">
      {/* Device & Controls Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 gap-2 shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Mode Switch: Focus vs Website Overlay */}
          <div className="flex items-center rounded-lg bg-[var(--surface)] p-0.5 border border-[var(--border)] text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('focus')}
              className={`px-2 py-1 rounded-md transition-all ${
                viewMode === 'focus'
                  ? 'bg-[var(--accent)] text-white shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Full Widget
            </button>
            <button
              type="button"
              onClick={() => setViewMode('overlay')}
              className={`px-2 py-1 rounded-md transition-all ${
                viewMode === 'overlay'
                  ? 'bg-[var(--accent)] text-white shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Website Mock
            </button>
          </div>

          {/* Device Switch: Desktop vs Mobile */}
          <div className="flex items-center rounded-lg bg-[var(--surface)] p-0.5 border border-[var(--border)] text-[11px]">
            <button
              type="button"
              onClick={() => setDevice('desktop')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md font-medium transition-all ${
                device === 'desktop'
                  ? 'bg-[var(--accent)] text-white shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
              title="Desktop width"
            >
              <Monitor className="h-3 w-3" />
              <span>Desk</span>
            </button>
            <button
              type="button"
              onClick={() => setDevice('mobile')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md font-medium transition-all ${
                device === 'mobile'
                  ? 'bg-[var(--accent)] text-white shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
              title="Mobile width"
            >
              <Smartphone className="h-3 w-3" />
              <span>Mob</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Preview
          </span>
          <button
            type="button"
            onClick={handleReset}
            title="Reset conversation"
            className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Main Viewport Container */}
      <div className="relative flex-1 p-2 sm:p-3 overflow-hidden flex items-center justify-center bg-[var(--surface-muted)]/50">
        {/* VIEW 1: FULL WIDGET FOCUS (Clean, 100% visible, no clipping) */}
        {viewMode === 'focus' ? (
          <div
            className={`w-full h-full flex flex-col mx-auto transition-all duration-200 ${
              device === 'mobile' ? 'max-w-[340px]' : 'max-w-[420px]'
            }`}
          >
            <div
              style={{ borderRadius: `${borderRadius}px` }}
              className="w-full h-full flex flex-col bg-[var(--surface)] border border-[var(--border)] shadow-xl overflow-hidden"
            >
              {/* Header */}
              <div
                style={{ backgroundColor: headerColor }}
                className="px-3.5 py-3 text-white flex items-center justify-between shrink-0 shadow-sm"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    style={{ backgroundColor: primaryColor }}
                    className="h-8 w-8 rounded-full flex items-center justify-center text-white shrink-0 shadow-inner font-bold text-xs"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-xs leading-tight truncate">{botName}</span>
                    <div className="flex items-center gap-1 text-[10px] text-white/80">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <span className="truncate">Online | Instant replies</span>
                    </div>
                  </div>
                </div>
                <div className="text-white/70 text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white/10">
                  AI Active
                </div>
              </div>

              {/* Chat Feed */}
              <div className="flex-1 p-3 overflow-y-auto space-y-2.5 text-xs bg-[var(--surface-muted)]/30">
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === 'visitor' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      style={{
                        backgroundColor: msg.sender === 'visitor' ? primaryColor : undefined,
                        color: msg.sender === 'visitor' ? '#ffffff' : undefined,
                      }}
                      className={`max-w-[85%] px-3 py-2 rounded-2xl shadow-xs leading-relaxed break-words ${
                        msg.sender === 'visitor'
                          ? 'rounded-br-xs font-medium'
                          : 'bg-[var(--surface)] text-[var(--text-primary)] rounded-bl-xs border border-[var(--border)]'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}

                {/* Starter Quick Questions Chips */}
                {messages.length <= 2 && (
                  <div className="pt-1 flex flex-wrap gap-1.5">
                    {quickQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSendMessage(q)}
                        className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all shadow-xs"
                      >
                        <span className="truncate">{q}</span>
                        <ChevronRight className="h-3 w-3 opacity-60 shrink-0" />
                      </button>
                    ))}
                    {!showLeadForm && !leadSubmitted && (
                      <button
                        type="button"
                        onClick={() => setShowLeadForm(true)}
                        className="flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 hover:bg-emerald-500/20 transition-all shadow-xs"
                      >
                        <span>📞 Connect with Consultant</span>
                        <ChevronRight className="h-3 w-3 opacity-60 shrink-0" />
                      </button>
                    )}
                  </div>
                )}

                {/* Lead Capture Form Card */}
                {showLeadForm && (
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm space-y-2 mt-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[var(--text-primary)] font-bold text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <span>{config.leadCapture?.title || 'Connect with a Property Consultant'}</span>
                      </div>
                      {!leadSubmitted && (
                        <button
                          type="button"
                          onClick={() => setShowLeadForm(false)}
                          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] leading-tight">
                      {config.leadCapture?.subtitle ||
                        'Leave your contact details to receive floor plans, pricing sheets, and instant callback.'}
                    </p>

                    {submitError && (
                      <div className="rounded-md bg-rose-500/10 border border-rose-500/30 p-2 text-rose-600 text-xs">
                        {submitError}
                      </div>
                    )}

                    {leadSubmitted ? (
                      <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-center space-y-2 animate-in fade-in duration-300">
                        <div className="flex items-center justify-center gap-1.5 text-emerald-600 font-bold text-xs">
                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                          <span>Lead Captured & Added to CRM!</span>
                        </div>
                        <p className="text-[11px] text-[var(--text-muted)] leading-tight">
                          <strong className="text-[var(--text-primary)]">
                            {capturedLeadData?.name || leadFormValues.fullName}
                          </strong>{' '}
                          ({capturedLeadData?.phone || leadFormValues.phone}) is now logged in your CRM pipeline with 85% Hot Intent & Buyer DNA.
                        </p>
                        <div className="pt-1.5 flex flex-col gap-1.5">
                          <Link
                            to="/leads"
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors w-full"
                          >
                            <span>Open Leads Section</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              setLeadSubmitted(false);
                              setLeadFormValues({ fullName: '', email: '', phone: '' });
                            }}
                            className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                          >
                            Submit another test lead
                          </button>
                        </div>
                      </div>
                    ) : (
                      <form onSubmit={handleLeadSubmit} className="space-y-1.5 pt-1">
                        <input
                          type="text"
                          placeholder="Full Name (e.g. Rahul Sharma)"
                          required
                          value={leadFormValues.fullName}
                          onChange={e =>
                            setLeadFormValues(prev => ({ ...prev, fullName: e.target.value }))
                          }
                          className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                        />
                        <input
                          type="email"
                          placeholder="Email Address (e.g. rahul@example.com)"
                          value={leadFormValues.email}
                          onChange={e =>
                            setLeadFormValues(prev => ({ ...prev, email: e.target.value }))
                          }
                          className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                        />
                        <input
                          type="tel"
                          placeholder="Phone Number (e.g. +91 98765 43210)"
                          required
                          value={leadFormValues.phone}
                          onChange={e =>
                            setLeadFormValues(prev => ({ ...prev, phone: e.target.value }))
                          }
                          className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                        />
                        <button
                          type="submit"
                          disabled={captureLeadMutation.isPending}
                          style={{ backgroundColor: primaryColor }}
                          className="w-full rounded-md py-1.5 text-xs font-semibold text-white shadow-xs hover:brightness-110 transition-opacity mt-1 flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {captureLeadMutation.isPending ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>Saving to CRM Leads...</span>
                            </>
                          ) : (
                            <span>Request Priority Call</span>
                          )}
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>

              {/* Input Bar */}
              <div className="p-2 bg-[var(--surface)] border-t border-[var(--border)] flex items-center gap-1.5 shrink-0">
                <input
                  type="text"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Ask about properties, pricing..."
                  className="flex-1 min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
                />
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  style={{ backgroundColor: primaryColor }}
                  className="h-8 w-8 rounded-lg text-white flex items-center justify-center shrink-0 shadow-sm hover:brightness-110 transition-all"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* VIEW 2: SIMULATED WEBSITE OVERLAY */
          <div
            className={`relative w-full h-full bg-[var(--surface)] rounded-xl shadow-lg border border-[var(--border)] overflow-hidden flex flex-col transition-all duration-300 ${
              device === 'mobile' ? 'max-w-[340px] max-h-[580px] rounded-[28px] border-4' : 'w-full'
            }`}
          >
            {/* Mock Browser Header for Desktop */}
            {device === 'desktop' && (
              <div className="h-6 bg-[var(--surface-muted)] border-b border-[var(--border)] px-3 flex items-center gap-1.5 shrink-0">
                <div className="h-2 w-2 rounded-full bg-rose-400" />
                <div className="h-2 w-2 rounded-full bg-amber-400" />
                <div className="h-2 w-2 rounded-full bg-emerald-400" />
                <div className="mx-auto rounded bg-[var(--surface)] border border-[var(--border)] px-2 py-0.2 text-[9px] text-[var(--text-muted)] flex items-center gap-1 font-mono">
                  <Shield className="h-2.5 w-2.5 text-emerald-500" />
                  https://your-property-website.com
                </div>
              </div>
            )}

            {/* Mock Website Background */}
            <div className="flex-1 p-3 select-none opacity-30 overflow-hidden">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                <div className="flex items-center gap-1.5 font-bold text-xs text-[var(--text-primary)]">
                  <Building className="h-4 w-4" />
                  <span>Luxury Residences</span>
                </div>
              </div>
              <div className="mt-3 rounded-lg bg-[var(--surface-muted)] h-20 flex items-center justify-center text-[11px] text-[var(--text-muted)]">
                Property Showcase Hero
              </div>
            </div>

            {/* Floating Widget Popup (Carefully constrained to prevent clipping) */}
            <div
              className={`absolute bottom-3 ${
                position === 'bottom-left' ? 'left-3' : 'right-3'
              } z-20 flex flex-col items-end max-w-[calc(100%-1.5rem)]`}
            >
              {isOpen && (
                <div
                  style={{ borderRadius: `${borderRadius}px` }}
                  className="mb-2 flex flex-col bg-[var(--surface)] shadow-2xl border border-[var(--border)] overflow-hidden w-[310px] max-w-[calc(100vw-3rem)] h-[440px]"
                >
                  {/* Mini Header */}
                  <div
                    style={{ backgroundColor: headerColor }}
                    className="px-3 py-2 text-white flex items-center justify-between shrink-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        style={{ backgroundColor: primaryColor }}
                        className="h-6 w-6 rounded-full flex items-center justify-center text-white text-[10px]"
                      >
                        <Sparkles className="h-3 w-3" />
                      </div>
                      <span className="font-semibold text-xs truncate">{botName}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="p-1 rounded text-white/70 hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Mini Chat Feed */}
                  <div className="flex-1 p-2.5 overflow-y-auto space-y-2 text-xs bg-[var(--surface-muted)]/30">
                    {messages.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender === 'visitor' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          style={{
                            backgroundColor: msg.sender === 'visitor' ? primaryColor : undefined,
                            color: msg.sender === 'visitor' ? '#ffffff' : undefined,
                          }}
                          className={`max-w-[85%] px-2.5 py-1.5 rounded-xl shadow-xs leading-relaxed break-words text-[11px] ${
                            msg.sender === 'visitor'
                              ? 'font-medium'
                              : 'bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)]'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Mini Input */}
                  <div className="p-2 bg-[var(--surface)] border-t border-[var(--border)] flex items-center gap-1">
                    <input
                      type="text"
                      value={inputValue}
                      onChange={e => setInputValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Type a message..."
                      className="flex-1 min-w-0 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleSendMessage()}
                      style={{ backgroundColor: primaryColor }}
                      className="h-7 w-7 rounded-md text-white flex items-center justify-center shrink-0"
                    >
                      <Send className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}

              {/* Launcher Bubble */}
              <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                style={{ backgroundColor: primaryColor }}
                className="h-11 w-11 rounded-full text-white shadow-xl flex items-center justify-center hover:scale-105 transition-all"
              >
                {isOpen ? <X className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

