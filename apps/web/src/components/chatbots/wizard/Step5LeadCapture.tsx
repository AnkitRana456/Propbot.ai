import React, { useState } from 'react';
import type { ChatbotConfig } from '@propbot/shared';
import { UserCheck, Sliders, CheckSquare, ShieldCheck, Mail, X, Plus } from 'lucide-react';

interface Step5LeadCaptureProps {
  config: ChatbotConfig;
  onChangeConfig: (config: ChatbotConfig) => void;
}

export const Step5LeadCapture: React.FC<Step5LeadCaptureProps> = ({ config, onChangeConfig }) => {
  const [newEmail, setNewEmail] = useState('');

  const leadCapture = config.leadCapture || {
    enabled: true,
    triggerAfterMessages: 2,
    title: 'Connect with a Property Consultant',
    subtitle:
      'Share your contact info to receive detailed floor plans and private viewing appointments.',
    fields: [
      { id: 'f1', name: 'fullName', label: 'Full Name', type: 'text', required: true },
      { id: 'f2', name: 'email', label: 'Email Address', type: 'email', required: true },
      { id: 'f3', name: 'phone', label: 'Phone Number', type: 'phone', required: true },
    ],
  };

  const updateLeadCapture = (updates: Partial<typeof leadCapture>) => {
    onChangeConfig({
      ...config,
      leadCapture: {
        ...leadCapture,
        ...updates,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          Lead Capture & Qualification
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Configure automated in-chat lead capture forms and trigger thresholds to convert curious
          visitors into qualified sales prospects.
        </p>
      </div>

      <div className="space-y-5">
        {/* Master Lead Capture Toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-xs">
          <div>
            <span className="font-bold text-sm text-slate-900 dark:text-white block">
              Automated Lead Capture
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Prompt users with a clean modal or inline card to capture contact credentials.
            </span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={leadCapture.enabled ?? true}
              onChange={e => updateLeadCapture({ enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
          </label>
        </div>

        {leadCapture.enabled && (
          <>
            {/* Trigger Message Threshold */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  <Sliders className="h-3.5 w-3.5 text-blue-600" />
                  <span>Trigger Threshold (After N Visitor Messages)</span>
                </div>
                <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {leadCapture.triggerAfterMessages ?? 2} messages
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="8"
                step="1"
                value={leadCapture.triggerAfterMessages ?? 2}
                onChange={e =>
                  updateLeadCapture({ triggerAfterMessages: parseInt(e.target.value, 10) })
                }
                className="w-full accent-blue-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-medium mt-1">
                <span>1 (Immediate)</span>
                <span>2 (Recommended - High Conversion)</span>
                <span>8 (Soft Touch)</span>
              </div>
            </div>

            {/* Form Title & Subtitle */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Lead Form Title
                </label>
                <input
                  type="text"
                  value={leadCapture.title || ''}
                  onChange={e => updateLeadCapture({ title: e.target.value })}
                  placeholder="e.g. Connect with a Property Consultant"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Lead Form Subtitle
                </label>
                <input
                  type="text"
                  value={leadCapture.subtitle || ''}
                  onChange={e => updateLeadCapture({ subtitle: e.target.value })}
                  placeholder="e.g. Leave your contact info to receive floor plans and instant callback."
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Captured Fields */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Mandatory Real Estate Lead Fields
              </label>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-blue-600" />
                    <span className="font-semibold text-slate-900 dark:text-white">Full Name</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded">
                    Required
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-blue-600" />
                    <span className="font-semibold text-slate-900 dark:text-white">
                      Email Address
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded">
                    Required
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-blue-600" />
                    <span className="font-semibold text-slate-900 dark:text-white">
                      Phone Number (WhatsApp Verification)
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded">
                    Required
                  </span>
                </div>
              </div>
            </div>

            {/* Alert Emails */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
                <Mail className="h-3.5 w-3.5 text-blue-600" />
                <span>Lead Alert Emails</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Jab bhi naya lead aaye, in emails pe notification jaayegi.
              </p>
              <div className="space-y-2 mb-3">
                {((leadCapture as Record<string, unknown>).alertEmails as string[] | undefined ?? []).map((email: string, i: number) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="text-xs text-slate-700 dark:text-slate-300 flex-1">{email}</span>
                    <button
                      onClick={() => {
                        const emails = ((leadCapture as Record<string, unknown>).alertEmails as string[] | undefined ?? []).filter((_: string, idx: number) => idx !== i);
                        updateLeadCapture({ alertEmails: emails } as never);
                      }}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newEmail.includes('@')) {
                      const emails = [...((leadCapture as Record<string, unknown>).alertEmails as string[] | undefined ?? []), newEmail.trim()];
                      updateLeadCapture({ alertEmails: emails } as never);
                      setNewEmail('');
                    }
                  }}
                  placeholder="sales@example.com"
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
                <button
                  onClick={() => {
                    if (!newEmail.includes('@')) return;
                    const emails = [...((leadCapture as Record<string, unknown>).alertEmails as string[] | undefined ?? []), newEmail.trim()];
                    updateLeadCapture({ alertEmails: emails } as never);
                    setNewEmail('');
                  }}
                  className="flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-xs text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200 flex items-center gap-2.5">
              <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0" />
              <span>
                All captured submissions automatically synchronize with your CRM leads pipeline.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
