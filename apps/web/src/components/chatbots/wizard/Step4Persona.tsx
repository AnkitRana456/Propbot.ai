import React from 'react';
import type { ChatbotConfig, ChatbotTone } from '@propbot/shared';
import { Bot, Sliders, Globe2, Crown, Briefcase, HeartHandshake, Smile } from 'lucide-react';

interface Step4PersonaProps {
  config: ChatbotConfig;
  onChangeConfig: (config: ChatbotConfig) => void;
}

const TONES: {
  id: ChatbotTone;
  title: string;
  desc: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  {
    id: 'luxury',
    title: 'Luxury Concierge',
    desc: 'Bespoke, refined, polite, tailored for high-net-worth real estate buyers.',
    icon: Crown,
  },
  {
    id: 'professional',
    title: 'Corporate Advisor',
    desc: 'Accurate, authoritative, concise, focused on ROI and specifications.',
    icon: Briefcase,
  },
  {
    id: 'friendly',
    title: 'Friendly Consultant',
    desc: 'Approachable, warm, helpful, ideal for first-time home buyers.',
    icon: HeartHandshake,
  },
  {
    id: 'casual',
    title: 'Modern & Casual',
    desc: 'Contemporary, quick, conversational, great for young urban professionals.',
    icon: Smile,
  },
];

const AVAILABLE_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ar', label: 'Arabic' },
  { code: 'de', label: 'German' },
];

export const Step4Persona: React.FC<Step4PersonaProps> = ({ config, onChangeConfig }) => {
  const behavior = config.behavior || {
    systemPrompt:
      'You are a professional real estate assistant helping visitors explore properties, schedule visits, and answer pricing inquiries.',
    tone: 'luxury',
    defaultLanguage: 'en',
    supportedLanguages: ['en', 'es', 'fr', 'hi', 'ar'],
    temperature: 0.7,
    greetingMessage: '',
    quickQuestions: [],
  };

  const updateBehavior = (updates: Partial<typeof behavior>) => {
    onChangeConfig({
      ...config,
      behavior: {
        ...behavior,
        ...updates,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Bot className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          Tone & Persona
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Configure your AI advisor's voice, behavioral temperament, and default conversational
          language.
        </p>
      </div>

      <div className="space-y-5">
        {/* Tone Selector Cards */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            Conversational Tone
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TONES.map(tone => {
              const Icon = tone.icon;
              const isSelected = (behavior.tone || 'luxury') === tone.id;
              return (
                <button
                  key={tone.id}
                  type="button"
                  onClick={() => updateBehavior({ tone: tone.id })}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/60 dark:border-blue-500 dark:bg-blue-950/30 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg shrink-0 ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-900 dark:text-white">
                      {tone.title}
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      {tone.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* System Prompt Customization */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
            System Instructions / Custom Persona Rules
          </label>
          <textarea
            rows={3}
            value={behavior.systemPrompt || ''}
            onChange={e => updateBehavior({ systemPrompt: e.target.value })}
            placeholder="Specify custom instructions: e.g. Always emphasize panoramic sea views and high capital appreciation potential..."
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white leading-relaxed font-mono"
          />
        </div>

        {/* Temperature / Creativity Slider */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              <Sliders className="h-3.5 w-3.5 text-blue-600" />
              <span>AI Temperature (Response Precision)</span>
            </div>
            <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              {behavior.temperature ?? 0.7}
            </span>
          </div>

          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={behavior.temperature ?? 0.7}
            onChange={e => updateBehavior({ temperature: parseFloat(e.target.value) })}
            className="w-full accent-blue-600 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-medium mt-1">
            <span>0.0 (Strict & Factual)</span>
            <span>0.7 (Recommended for Sales)</span>
            <span>1.0 (Creative & Fluent)</span>
          </div>
        </div>

        {/* Primary Language */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Globe2 className="h-3.5 w-3.5 text-blue-600" />
            <span>Primary Language</span>
          </label>
          <select
            value={behavior.defaultLanguage || 'en'}
            onChange={e => updateBehavior({ defaultLanguage: e.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            {AVAILABLE_LANGUAGES.map(lang => (
              <option key={lang.code} value={lang.code}>
                {lang.label} ({lang.code.toUpperCase()})
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};
