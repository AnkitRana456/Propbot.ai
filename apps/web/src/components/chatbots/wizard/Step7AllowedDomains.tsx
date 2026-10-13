import React, { useState } from 'react';
import type { ChatbotConfig } from '@propbot/shared';
import { ShieldCheck, Plus, Trash2, FileText, Globe } from 'lucide-react';

interface Step7AllowedDomainsProps {
  allowedDomains: string[];
  onChangeAllowedDomains: (domains: string[]) => void;
  config: ChatbotConfig;
  onChangeConfig: (config: ChatbotConfig) => void;
}

export const Step7AllowedDomains: React.FC<Step7AllowedDomainsProps> = ({
  allowedDomains,
  onChangeAllowedDomains,
  config,
  onChangeConfig,
}) => {
  const [newDomainInput, setNewDomainInput] = useState('');
  const [brochureTitle, setBrochureTitle] = useState('');
  const [brochureUrl, setBrochureUrl] = useState('');

  const handleAddDomain = () => {
    if (!newDomainInput.trim()) return;
    let domain = newDomainInput.trim().toLowerCase();
    if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
      domain = `https://${domain}`;
    }
    if (!allowedDomains.includes(domain)) {
      onChangeAllowedDomains([...allowedDomains, domain]);
    }
    setNewDomainInput('');
  };

  const handleRemoveDomain = (domainToRemove: string) => {
    onChangeAllowedDomains(allowedDomains.filter(d => d !== domainToRemove));
  };

  const handleAddBrochure = () => {
    if (!brochureTitle.trim() || !brochureUrl.trim()) return;
    const currentBrochures = config.brochures || [];
    onChangeConfig({
      ...config,
      brochures: [
        ...currentBrochures,
        {
          id: String(Date.now()),
          title: brochureTitle.trim(),
          url: brochureUrl.trim(),
        },
      ],
    });
    setBrochureTitle('');
    setBrochureUrl('');
  };

  const handleRemoveBrochure = (idToRemove: string) => {
    const currentBrochures = config.brochures || [];
    onChangeConfig({
      ...config,
      brochures: currentBrochures.filter(b => b.id !== idToRemove),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          Allowed Domains & Collateral
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Lock down which websites can render your widget and attach official project brochures for
          instant client delivery.
        </p>
      </div>

      <div className="space-y-6">
        {/* Domain Whitelist */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-blue-600" />
              <span>Allowed Domains (CORS Security)</span>
            </label>
            <span className="text-xs text-slate-400">Leave empty to allow all test domains</span>
          </div>

          <div className="space-y-2 mb-3">
            {allowedDomains.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-3 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/40">
                No domain restrictions configured. Widget will embed on any authorized site with
                valid Public Key.
              </div>
            ) : (
              allowedDomains.map(domain => (
                <div
                  key={domain}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-2.5 px-3 dark:border-slate-800 dark:bg-slate-900"
                >
                  <span className="text-xs font-mono font-medium text-slate-800 dark:text-slate-200">
                    {domain}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveDomain(domain)}
                    className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newDomainInput}
              onChange={e => setNewDomainInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddDomain();
                }
              }}
              placeholder="e.g. prestigegroup.com or https://villas.realty.com"
              className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
            <button
              type="button"
              onClick={handleAddDomain}
              className="flex items-center gap-1 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Domain
            </button>
          </div>
        </div>

        {/* Brochure Attachments */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-5">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-blue-600" />
            <span>Digital Brochures & Floor Plans</span>
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            The AI assistant will directly send these verified PDF download links when buyers ask
            for pricing or floor plans.
          </p>

          <div className="space-y-2 mb-3">
            {config.brochures?.map(b => (
              <div
                key={b.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="truncate">
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    {b.title}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400 truncate block">
                    {b.url}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveBrochure(b.id)}
                  className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <input
              type="text"
              value={brochureTitle}
              onChange={e => setBrochureTitle(e.target.value)}
              placeholder="Brochure Title (e.g. Master Layout & Specs)"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
            <input
              type="url"
              value={brochureUrl}
              onChange={e => setBrochureUrl(e.target.value)}
              placeholder="PDF URL (https://cdn.example.com/brochure.pdf)"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <button
            type="button"
            onClick={handleAddBrochure}
            className="flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Attach Brochure
          </button>
        </div>
      </div>
    </div>
  );
};
