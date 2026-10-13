import React, { useState, useEffect } from 'react';
import { Building2, Palette, Sparkles, Check } from 'lucide-react';
import type { CompanyBranding } from '@propbot/shared';

interface GeneralBrandingTabProps {
  initialName?: string;
  initialBranding?: CompanyBranding;
  onSave: (data: { name: string; branding: CompanyBranding }) => Promise<void>;
}

export const GeneralBrandingTab: React.FC<GeneralBrandingTabProps> = ({
  initialName = '',
  initialBranding = {},
  onSave,
}) => {
  const [name, setName] = useState(initialName);
  const [logoUrl, setLogoUrl] = useState(initialBranding.logoUrl || '');
  const [primaryColor, setPrimaryColor] = useState(initialBranding.primaryColor || '#2563eb');
  const [secondaryColor, setSecondaryColor] = useState(
    initialBranding.secondaryColor || '#4f46e5',
  );
  const [faviconUrl, setFaviconUrl] = useState(initialBranding.faviconUrl || '');
  const [whiteLabel, setWhiteLabel] = useState(initialBranding.whiteLabel || false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setName(initialName);
    setLogoUrl(initialBranding.logoUrl || '');
    setPrimaryColor(initialBranding.primaryColor || '#2563eb');
    setSecondaryColor(initialBranding.secondaryColor || '#4f46e5');
    setFaviconUrl(initialBranding.faviconUrl || '');
    setWhiteLabel(initialBranding.whiteLabel || false);
  }, [initialName, initialBranding]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccess(false);
    try {
      await onSave({
        name,
        branding: {
          logoUrl,
          primaryColor,
          secondaryColor,
          faviconUrl,
          whiteLabel,
        },
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to update branding.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {savedSuccess && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-sm flex items-center gap-2">
          <Check className="w-4 h-4" />
          Company branding settings saved successfully.
        </div>
      )}

      {/* Basic Company Identity */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-600" />
          Company Identity
        </h3>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            Company Name
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            Logo URL
          </label>
          <input
            type="url"
            value={logoUrl}
            onChange={e => setLogoUrl(e.target.value)}
            placeholder="https://example.com/logo.png"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
          />
        </div>
      </div>

      {/* Colors & Visual Theme */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
          <Palette className="w-4 h-4 text-indigo-600" />
          Brand Palette & Widget Theme
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Primary Brand Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={primaryColor}
                onChange={e => setPrimaryColor(e.target.value)}
                className="w-10 h-10 rounded-xl cursor-pointer border border-slate-200"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={e => setPrimaryColor(e.target.value)}
                className="flex-1 px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Secondary Brand Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={secondaryColor}
                onChange={e => setSecondaryColor(e.target.value)}
                className="w-10 h-10 rounded-xl cursor-pointer border border-slate-200"
              />
              <input
                type="text"
                value={secondaryColor}
                onChange={e => setSecondaryColor(e.target.value)}
                className="flex-1 px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* White-Label Settings */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                White-Label Mode
              </h3>
              <p className="text-xs text-slate-500">
                Hide 'Powered by PropBot Pro' branding badges on all visitor chatbots and Shortlist Rooms
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={whiteLabel}
            onChange={e => setWhiteLabel(e.target.checked)}
            className="w-5 h-5 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSaving}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-md transition-all disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save Branding'}
        </button>
      </div>
    </form>
  );
};
