import React, { useState } from 'react';
import { Check, Copy, ExternalLink, ShieldCheck, X } from 'lucide-react';

interface WhatsAppSetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveCredentials: (creds: {
    token: string;
    phoneNumberId: string;
    wabaId: string;
  }) => Promise<void>;
  webhookUrl: string;
  webhookVerifyToken: string;
}

export const WhatsAppSetupWizard: React.FC<WhatsAppSetupWizardProps> = ({
  isOpen,
  onClose,
  onSaveCredentials,
  webhookUrl,
  webhookVerifyToken,
}) => {
  const [step, setStep] = useState(1);
  const [token, setToken] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleCopy = (text: string, type: 'url' | 'token') => {
    navigator.clipboard.writeText(text);
    if (type === 'url') {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  const handleFinish = async () => {
    setIsSaving(true);
    try {
      await onSaveCredentials({ token, phoneNumberId, wabaId });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#1c1c1c] border border-slate-200 dark:border-[#2a2a2a] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#262626] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center font-bold">
              WA
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Meta WhatsApp Business API Setup Guide
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#8a8a8a]">
                Step {step} of 4 &bull; Official Cloud API Integration
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-slate-700 dark:text-[#e6e6e6]">
          {step === 1 && (
            <div className="space-y-4">
              <h4 className="font-semibold text-base text-slate-900 dark:text-white">
                1. Create Meta Developer App & Add WhatsApp
              </h4>
              <p className="text-xs text-slate-500 dark:text-[#a3a3a3]">
                Navigate to your Meta for Developers dashboard. Create a new App of type{' '}
                <strong className="text-slate-800 dark:text-white">Other &rarr; Business</strong>, then click &quot;Set up&quot; under WhatsApp.
              </p>
              <div className="rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-slate-50 dark:bg-[#141414] p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span>Meta for Developers Console:</span>
                  <a
                    href="https://developers.facebook.com/apps/"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-blue-500 hover:underline"
                  >
                    Open Console <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
                <div className="text-xs text-slate-600 dark:text-[#a3a3a3] space-y-1">
                  <p>&bull; Select your verified Business Portfolio.</p>
                  <p>&bull; In the WhatsApp setup screen, note down the test sandbox or register your live agency phone number.</p>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h4 className="font-semibold text-base text-slate-900 dark:text-white">
                2. System User & Permanent Access Token
              </h4>
              <p className="text-xs text-slate-500 dark:text-[#a3a3a3]">
                Temporary 24h tokens will expire. Generate a permanent System User Token inside Meta Business Suite:
              </p>
              <div className="rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-slate-50 dark:bg-[#141414] p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Required Permissions:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono text-slate-600 dark:text-[#a3a3a3]">
                  <span className="p-2 rounded bg-slate-200/60 dark:bg-[#222]">whatsapp_business_management</span>
                  <span className="p-2 rounded bg-slate-200/60 dark:bg-[#222]">whatsapp_business_messaging</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Permanent Access Token (EAAB...)</label>
                <input
                  type="password"
                  placeholder="Paste your system-user token"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#141414] text-xs font-mono"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h4 className="font-semibold text-base text-slate-900 dark:text-white">
                3. Configure Real-Time Webhook
              </h4>
              <p className="text-xs text-slate-500 dark:text-[#a3a3a3]">
                Under WhatsApp &rarr; Configuration in your Meta App, configure the Webhook callback:
              </p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-[#a3a3a3]">Callback URL</label>
                  <div className="flex gap-2 mt-1">
                    <input
                      readOnly
                      value={webhookUrl}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-slate-50 dark:bg-[#141414] text-xs font-mono select-all"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy(webhookUrl, 'url')}
                      className="px-3 py-2 rounded-lg border border-slate-200 dark:border-[#2a2a2a] hover:bg-slate-100 dark:hover:bg-[#222] text-xs flex items-center gap-1"
                    >
                      {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-[#a3a3a3]">Verify Token</label>
                  <div className="flex gap-2 mt-1">
                    <input
                      readOnly
                      value={webhookVerifyToken}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-slate-50 dark:bg-[#141414] text-xs font-mono select-all"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy(webhookVerifyToken, 'token')}
                      className="px-3 py-2 rounded-lg border border-slate-200 dark:border-[#2a2a2a] hover:bg-slate-100 dark:hover:bg-[#222] text-xs flex items-center gap-1"
                    >
                      {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-[#8a8a8a]">
                  Subscribe to the <code className="text-blue-500">messages</code> field after saving the webhook.
                </p>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h4 className="font-semibold text-base text-slate-900 dark:text-white">
                4. Account & Phone Identifiers
              </h4>
              <p className="text-xs text-slate-500 dark:text-[#a3a3a3]">
                Enter the IDs from your Meta WhatsApp &rarr; API Setup screen:
              </p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Phone Number ID</label>
                  <input
                    type="text"
                    placeholder="e.g. 109876543210987"
                    value={phoneNumberId}
                    onChange={e => setPhoneNumberId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#141414] text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">WhatsApp Business Account ID (WABA ID)</label>
                  <input
                    type="text"
                    placeholder="e.g. 209876543210987"
                    value={wabaId}
                    onChange={e => setWabaId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#141414] text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-[#262626] bg-slate-50 dark:bg-[#181818] flex items-center justify-between">
          <button
            type="button"
            disabled={step === 1}
            onClick={() => setStep(s => Math.max(1, s - 1))}
            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-[#2a2a2a] text-xs font-medium disabled:opacity-40"
          >
            Back
          </button>
          <div className="flex gap-2">
            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep(s => Math.min(4, s + 1))}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
              >
                Next Step &rarr;
              </button>
            ) : (
              <button
                type="button"
                disabled={isSaving || !phoneNumberId}
                onClick={handleFinish}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                {isSaving ? 'Encrypting & Saving...' : 'Save & Encrypt Credentials'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
