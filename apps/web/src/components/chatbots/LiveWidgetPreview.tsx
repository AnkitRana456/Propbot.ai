import React, { useState } from 'react';
import type { ChatbotConfig, ChatbotType } from '@propbot/shared';
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  RotateCcw,
  Smartphone,
  Monitor,
  CheckCircle2,
  ChevronRight,
  Shield,
  Building,
} from 'lucide-react';

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
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [leadSubmitted, setLeadSubmitted] = useState(false);

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
    primaryColor: '#059669',
    textColor: '#ffffff',
    backgroundColor: '#ffffff',
    headerColor: '#0f172a',
    borderRadius: 16,
    position: 'bottom-right',
    botName: 'Property Advisor AI',
  };

  const primaryColor = appearance.primaryColor || '#059669';
  const headerColor = appearance.headerColor || '#0f172a';
  const borderRadius = appearance.borderRadius ?? 16;
  const position = appearance.position || 'bottom-right';
  const botName = appearance.botName || name || 'Property Advisor AI';
  const quickQuestions = config.behavior?.quickQuestions || [];

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

    // Trigger lead form if messages match threshold or simulated intent
    setTimeout(() => {
      const lower = text.toLowerCase();
      let replyText =
        'Thank you for asking! We have premium 3BHK & 4BHK residences with panoramic skyline views, private plunge pools, and flexible 20:80 payment plans.';

      if (lower.includes('visit') || lower.includes('tour')) {
        replyText =
          "We'd love to host you for a private site tour. Our advisors are available 7 days a week.";
      } else if (
        lower.includes('brochure') ||
        lower.includes('pricing') ||
        lower.includes('price')
      ) {
        replyText =
          'I can send you the master floor plan, pricing breakdown, and exclusive payment schedules right away.';
      }

      const botReply: ChatMessage = {
        id: String(Date.now() + 1),
        sender: 'bot',
        text: replyText,
        timestamp: 'Just now',
      };

      setMessages(prev => [...prev, botReply]);

      if (config.leadCapture?.enabled && !showLeadForm && !leadSubmitted) {
        setShowLeadForm(true);
      }
    }, 600);
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
    setInputValue('');
  };

  return (
    <div className="flex flex-col h-full rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60 overflow-hidden shadow-sm">
      {/* Device & Controls Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setDevice('desktop')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                device === 'desktop'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              <Monitor className="h-3.5 w-3.5" />
              Desktop
            </button>
            <button
              type="button"
              onClick={() => setDevice('mobile')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                device === 'mobile'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              Mobile
            </button>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Preview
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            title="Reset conversation"
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        </div>
      </div>

      {/* Simulated Browser Viewport */}
      <div className="relative flex-1 p-4 overflow-hidden flex items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-950 dark:to-slate-900">
        {/* Mock background website */}
        <div
          className={`relative w-full h-full bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col transition-all duration-300 ${
            device === 'mobile'
              ? 'max-w-[375px] max-h-[640px] rounded-[32px] border-4 border-slate-800 dark:border-slate-700'
              : 'w-full'
          }`}
        >
          {/* Mock Browser Header for Desktop */}
          {device === 'desktop' && (
            <div className="h-7 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 px-3 flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-rose-400" />
              <div className="h-2 w-2 rounded-full bg-amber-400" />
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <div className="mx-auto rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-0.5 text-[10px] text-slate-400 flex items-center gap-1">
                <Shield className="h-2.5 w-2.5 text-emerald-500" />
                https://your-property-website.com
              </div>
            </div>
          )}

          {/* Mock Website Content Behind Widget */}
          <div className="flex-1 p-5 overflow-hidden select-none opacity-40">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Building className="h-5 w-5 text-blue-600" />
                <span className="font-bold text-sm tracking-tight text-slate-800 dark:text-slate-200">
                  Sobha Windsor Estates
                </span>
              </div>
              <div className="flex gap-3 text-xs text-slate-500 font-medium">
                <span>Residences</span>
                <span>Amenities</span>
                <span>Location</span>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-slate-200 dark:bg-slate-800 h-28 flex items-center justify-center text-xs text-slate-400 font-medium">
              Featured Property Gallery & Virtual Tour
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="h-16 rounded-lg bg-slate-100 dark:bg-slate-800" />
              <div className="h-16 rounded-lg bg-slate-100 dark:bg-slate-800" />
            </div>
          </div>

          {/* Floating Widget Container */}
          <div
            className={`absolute bottom-4 ${
              position === 'bottom-left' ? 'left-4' : 'right-4'
            } z-20 flex flex-col items-end`}
          >
            {/* Widget Opened Dialog */}
            {isOpen && (
              <div
                style={{
                  borderRadius: `${borderRadius}px`,
                }}
                className={`mb-3 flex flex-col bg-white dark:bg-slate-900 shadow-2xl border border-slate-200/90 dark:border-slate-700 overflow-hidden transition-all duration-200 ${
                  device === 'mobile'
                    ? 'w-[calc(100vw-3rem)] max-w-[340px] h-[480px]'
                    : 'w-[370px] h-[520px]'
                }`}
              >
                {/* Widget Header */}
                <div
                  style={{ backgroundColor: headerColor }}
                  className="px-4 py-3.5 text-white flex items-center justify-between shrink-0 shadow-sm"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      style={{ backgroundColor: primaryColor }}
                      className="h-9 w-9 rounded-full flex items-center justify-center text-white shadow-inner font-bold text-sm"
                    >
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm leading-tight">{botName}</span>
                      <div className="flex items-center gap-1 text-[11px] text-white/80">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        <span>Online | Instant replies</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-white/80">
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                      title="Minimize widget"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Chat Feed */}
                <div className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-slate-50/70 dark:bg-slate-950/40 text-xs">
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
                        className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl shadow-xs leading-relaxed ${
                          msg.sender === 'visitor'
                            ? 'rounded-br-xs font-medium'
                            : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-xs border border-slate-200/80 dark:border-slate-700/80'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))}

                  {/* Starter Quick Questions Chips */}
                  {messages.length <= 2 && quickQuestions.length > 0 && (
                    <div className="pt-1 flex flex-wrap gap-1.5">
                      {quickQuestions.map((q, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSendMessage(q)}
                          className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-all shadow-xs"
                        >
                          <span>{q}</span>
                          <ChevronRight className="h-3 w-3 text-slate-400" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Interactive Lead Capture Form Card */}
                  {showLeadForm && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50/90 dark:border-blue-900/60 dark:bg-blue-950/40 p-3 shadow-xs space-y-2 mt-2">
                      <div className="flex items-center gap-1.5 text-blue-900 dark:text-blue-200 font-semibold text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                        <span>
                          {config.leadCapture?.title || 'Connect with a Property Consultant'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-tight">
                        {config.leadCapture?.subtitle ||
                          'Leave your contact details to receive floor plans and instant callback.'}
                      </p>

                      {leadSubmitted ? (
                        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-200 text-center font-medium">
                          ✓ Inquiry submitted! An advisor will call shortly.
                        </div>
                      ) : (
                        <form
                          onSubmit={e => {
                            e.preventDefault();
                            setLeadSubmitted(true);
                          }}
                          className="space-y-1.5 pt-1"
                        >
                          <input
                            type="text"
                            placeholder="Full Name"
                            required
                            value={leadFormValues.fullName}
                            onChange={e =>
                              setLeadFormValues(prev => ({ ...prev, fullName: e.target.value }))
                            }
                            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          />
                          <input
                            type="email"
                            placeholder="Email Address"
                            required
                            value={leadFormValues.email}
                            onChange={e =>
                              setLeadFormValues(prev => ({ ...prev, email: e.target.value }))
                            }
                            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          />
                          <input
                            type="tel"
                            placeholder="Phone Number"
                            required
                            value={leadFormValues.phone}
                            onChange={e =>
                              setLeadFormValues(prev => ({ ...prev, phone: e.target.value }))
                            }
                            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          />
                          <button
                            type="submit"
                            style={{ backgroundColor: primaryColor }}
                            className="w-full rounded-md py-1.5 text-xs font-semibold text-white shadow-xs hover:opacity-90 transition-opacity mt-1"
                          >
                            Request Priority Call
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </div>

                {/* Input Bar */}
                <div className="p-2.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-1.5">
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
                    className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
                    style={{ backgroundColor: primaryColor }}
                    className="h-8 w-8 rounded-lg text-white flex items-center justify-center shrink-0 shadow-sm hover:opacity-90 transition-opacity"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Floating Launcher Button */}
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              style={{ backgroundColor: primaryColor }}
              className="h-14 w-14 rounded-full text-white shadow-xl flex items-center justify-center hover:scale-105 transition-all duration-200 relative group"
            >
              {isOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <>
                  <MessageSquare className="h-6 w-6" />
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 text-[9px] font-bold text-white items-center justify-center">
                      1
                    </span>
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
