import React from 'react';
import type { ChatbotConfig, ChatbotType } from '@propbot/shared';
import { Globe, MessageSquare, Sparkles, Building2 } from 'lucide-react';

interface Step1IdentityProps {
  name: string;
  onChangeName: (name: string) => void;
  type: ChatbotType;
  onChangeType: (type: ChatbotType) => void;
  config: ChatbotConfig;
  onChangeConfig: (config: ChatbotConfig) => void;
}

export const Step1Identity: React.FC<Step1IdentityProps> = ({
  name,
  onChangeName,
  type,
  onChangeType,
  config,
  onChangeConfig,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          Bot Identity & Platform
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Give your AI real estate assistant a recognizable name and choose where it will be
          deployed.
        </p>
      </div>

      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
            Chatbot Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={e => onChangeName(e.target.value)}
            placeholder="e.g. Sunrise Homes Luxury Concierge"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
          <p className="text-xs text-slate-500 mt-1">
            Displayed in your dashboard and in the widget title bar.
          </p>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
            Internal Purpose / Description
          </label>
          <textarea
            rows={2}
            value={config.description || ''}
            onChange={e =>
              onChangeConfig({
                ...config,
                description: e.target.value,
              })
            }
            placeholder="e.g. Pre-sales qualifying bot for 3BHK and 4BHK luxury villas in Whitefield..."
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </div>

        {/* Platform Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            Target Platform <span className="text-rose-500">*</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => onChangeType('web')}
              className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                type === 'web'
                  ? 'border-blue-600 bg-blue-50/60 dark:border-blue-500 dark:bg-blue-950/30 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
              }`}
            >
              <div
                className={`p-2.5 rounded-lg shrink-0 ${
                  type === 'web'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900 dark:text-white">
                  <span>Website Widget</span>
                  {type === 'web' && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                      Selected
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Interactive floating chat badge for your property portal, landing pages, or
                  microsite.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onChangeType('whatsapp')}
              className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                type === 'whatsapp'
                  ? 'border-emerald-600 bg-emerald-50/60 dark:border-emerald-500 dark:bg-emerald-950/30 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
              }`}
            >
              <div
                className={`p-2.5 rounded-lg shrink-0 ${
                  type === 'whatsapp'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900 dark:text-white">
                  <span>WhatsApp Business AI</span>
                  {type === 'whatsapp' && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                      Selected
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Connect to your Meta Cloud WhatsApp Business Number for automated client
                  conversations.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Real Estate Agency Attribution */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-900/80 flex items-center gap-3">
          <Building2 className="h-5 w-5 text-slate-500 shrink-0" />
          <div className="text-xs text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-slate-900 dark:text-white">
              Multi-Tenant Context:
            </span>{' '}
            This chatbot will be strictly isolated under your company account and will only qualify
            leads for your team.
          </div>
        </div>
      </div>
    </div>
  );
};
