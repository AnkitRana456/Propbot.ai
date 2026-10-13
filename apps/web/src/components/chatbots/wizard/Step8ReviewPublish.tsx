import React, { useState } from 'react';
import type { ChatbotConfig, ChatbotStatus, ChatbotType } from '@propbot/shared';
import {
  Copy,
  Check,
  Code2,
  Sparkles,
  Rocket,
  Layers,
  Palette,
  Bot,
  UserCheck,
} from 'lucide-react';

interface Step8ReviewPublishProps {
  name: string;
  type: ChatbotType;
  status: ChatbotStatus;
  onChangeStatus: (status: ChatbotStatus) => void;
  allowedDomains: string[];
  config: ChatbotConfig;
  publicKey?: string;
}

export const Step8ReviewPublish: React.FC<Step8ReviewPublishProps> = ({
  name,
  type,
  status,
  onChangeStatus,
  allowedDomains: _allowedDomains,
  config,
  publicKey = 'pb_live_demo_1234567890abcdef12345678',
}) => {
  const [copied, setCopied] = useState(false);

  const embedScript = `<!-- PropBot Pro AI Real Estate Widget -->
<script
  src="https://cdn.propbotpro.com/widget.js"
  data-propbot-key="${publicKey}"
  async
></script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(embedScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Rocket className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          Review & Launch Configuration
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Review your configured assistant parameters and choose whether to publish immediately or
          save as draft.
        </p>
      </div>

      <div className="space-y-5">
        {/* Status Selection */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            Initial Bot Status
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onChangeStatus('active')}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                status === 'active'
                  ? 'border-emerald-600 bg-emerald-50/60 dark:border-emerald-500 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Active (Live)
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Immediately responds to real visitors on all whitelisted domains.
              </p>
            </button>

            <button
              type="button"
              onClick={() => onChangeStatus('draft')}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                status === 'draft'
                  ? 'border-amber-600 bg-amber-50/60 dark:border-amber-500 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Draft Mode
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Save configuration without activating widget on live sites.
              </p>
            </button>
          </div>
        </div>

        {/* Configuration Checklist Review */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 space-y-3">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
            Assistant Summary
          </span>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 flex items-center gap-1">
                <Layers className="h-3 w-3 text-blue-500" />
                Name & Platform
              </span>
              <span className="font-bold text-slate-900 dark:text-white block mt-0.5 truncate">
                {name || 'Untitled Bot'} ({type === 'web' ? 'Website' : 'WhatsApp'})
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 flex items-center gap-1">
                <Palette className="h-3 w-3 text-emerald-500" />
                Accent & Position
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  style={{ backgroundColor: config.appearance?.primaryColor || '#059669' }}
                  className="h-3 w-3 rounded-full inline-block"
                />
                <span className="font-bold text-slate-900 dark:text-white">
                  {config.appearance?.position || 'bottom-right'}
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 flex items-center gap-1">
                <Bot className="h-3 w-3 text-purple-500" />
                Tone & Language
              </span>
              <span className="font-bold text-slate-900 dark:text-white block mt-0.5 capitalize">
                {config.behavior?.tone || 'luxury'} (
                {config.behavior?.defaultLanguage?.toUpperCase() || 'EN'})
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 flex items-center gap-1">
                <UserCheck className="h-3 w-3 text-blue-500" />
                Lead Capture
              </span>
              <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
                {config.leadCapture?.enabled
                  ? `Enabled (after ${config.leadCapture.triggerAfterMessages} msgs)`
                  : 'Disabled'}
              </span>
            </div>
          </div>
        </div>

        {/* 1-Click Embed Snippet Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Code2 className="h-3.5 w-3.5 text-blue-600" />
              <span>Embed Code Snippet</span>
            </label>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 text-slate-500" />
                  Copy Script
                </>
              )}
            </button>
          </div>

          <div className="rounded-lg bg-slate-950 p-3 font-mono text-xs text-slate-300 overflow-x-auto border border-slate-800">
            <pre>{embedScript}</pre>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
            Paste this snippet right before the closing{' '}
            <code className="text-blue-500">&lt;/body&gt;</code> tag on WordPress, Webflow, Shopify,
            or custom HTML.
          </p>
        </div>

        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div className="text-xs text-emerald-900 dark:text-emerald-200">
            <span className="font-bold">Ready to Launch:</span> Click "Finish & Save" below to store
            your configuration under company tenant context.
          </div>
        </div>
      </div>
    </div>
  );
};
