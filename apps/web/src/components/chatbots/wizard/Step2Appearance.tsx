import React from 'react';
import type { ChatbotConfig } from '@propbot/shared';
import { Palette, Check, AlignRight, AlignLeft } from 'lucide-react';

interface Step2AppearanceProps {
  config: ChatbotConfig;
  onChangeConfig: (config: ChatbotConfig) => void;
}

const COLOR_PRESETS = [
  { name: 'Emerald', value: '#059669', bgClass: 'bg-emerald-600' },
  { name: 'Royal Blue', value: '#2563eb', bgClass: 'bg-blue-600' },
  { name: 'Indigo', value: '#4f46e5', bgClass: 'bg-indigo-600' },
  { name: 'Purple', value: '#7c3aed', bgClass: 'bg-purple-600' },
  { name: 'Rose', value: '#e11d48', bgClass: 'bg-rose-600' },
  { name: 'Amber Gold', value: '#d97706', bgClass: 'bg-amber-600' },
  { name: 'Slate Luxury', value: '#0f172a', bgClass: 'bg-slate-900' },
];

export const Step2Appearance: React.FC<Step2AppearanceProps> = ({ config, onChangeConfig }) => {
  const appearance = config.appearance || {
    primaryColor: '#059669',
    textColor: '#ffffff',
    backgroundColor: '#ffffff',
    headerColor: '#0f172a',
    borderRadius: 16,
    position: 'bottom-right',
    botName: 'Property Advisor AI',
  };

  const updateAppearance = (updates: Partial<typeof appearance>) => {
    onChangeConfig({
      ...config,
      appearance: {
        ...appearance,
        ...updates,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Palette className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          Widget Styling & Branding
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Customize the colors, curvature, and alignment to seamlessly match your agency website
          branding.
        </p>
      </div>

      <div className="space-y-5">
        {/* Bot Display Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
            Widget Header Title
          </label>
          <input
            type="text"
            value={appearance.botName || ''}
            onChange={e => updateAppearance({ botName: e.target.value })}
            placeholder="e.g. Aurora Homes Assistant"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </div>

        {/* Primary Color Picker */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            Primary Accent Color
          </label>
          <div className="flex flex-wrap items-center gap-2.5">
            {COLOR_PRESETS.map(preset => {
              const isSelected =
                appearance.primaryColor?.toLowerCase() === preset.value.toLowerCase();
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => updateAppearance({ primaryColor: preset.value })}
                  className={`h-9 w-9 rounded-full ${preset.bgClass} flex items-center justify-center text-white transition-all shadow-sm ${
                    isSelected ? 'ring-3 ring-offset-2 ring-blue-500 scale-110' : 'hover:scale-105'
                  }`}
                  title={preset.name}
                >
                  {isSelected && <Check className="h-4 w-4" />}
                </button>
              );
            })}

            <div className="flex items-center gap-2 ml-2 pl-3 border-l border-slate-200 dark:border-slate-700">
              <input
                type="color"
                value={appearance.primaryColor || '#059669'}
                onChange={e => updateAppearance({ primaryColor: e.target.value })}
                className="h-8 w-8 cursor-pointer rounded-lg border-0 bg-transparent"
              />
              <span className="font-mono text-xs text-slate-600 dark:text-slate-300 font-semibold uppercase">
                {appearance.primaryColor}
              </span>
            </div>
          </div>
        </div>

        {/* Header Background Color */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Header Background
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={appearance.headerColor || '#0f172a'}
                onChange={e => updateAppearance({ headerColor: e.target.value })}
                className="h-9 w-9 cursor-pointer rounded-lg border-0 bg-transparent"
              />
              <input
                type="text"
                value={appearance.headerColor || '#0f172a'}
                onChange={e => updateAppearance({ headerColor: e.target.value })}
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono uppercase text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Border Radius */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Border Radius
              </label>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {appearance.borderRadius ?? 16}px
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="32"
              step="2"
              value={appearance.borderRadius ?? 16}
              onChange={e => updateAppearance({ borderRadius: Number(e.target.value) })}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>
        </div>

        {/* Position on Screen */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            Screen Position
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => updateAppearance({ position: 'bottom-right' })}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 font-medium text-xs transition-all ${
                appearance.position === 'bottom-right'
                  ? 'border-blue-600 bg-blue-50/60 text-blue-700 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
              }`}
            >
              <AlignRight className="h-4 w-4" />
              Bottom Right (Standard)
            </button>
            <button
              type="button"
              onClick={() => updateAppearance({ position: 'bottom-left' })}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 font-medium text-xs transition-all ${
                appearance.position === 'bottom-left'
                  ? 'border-blue-600 bg-blue-50/60 text-blue-700 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
              }`}
            >
              <AlignLeft className="h-4 w-4" />
              Bottom Left
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
