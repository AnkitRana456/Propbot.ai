import React, { useState } from 'react';
import { PhoneCall, Clock, CheckCircle2, Bot, Sparkles } from 'lucide-react';

interface VoiceSettingsTabProps {
  initialVoiceCalling?: boolean;
  initialCallerId?: string;
  onSave?: (settings: { voiceCalling: boolean; telephonyCallerId: string }) => Promise<void>;
}

export const VoiceSettingsTab: React.FC<VoiceSettingsTabProps> = ({
  initialVoiceCalling = true,
  initialCallerId = '+918040001000',
  onSave,
}) => {
  const [voiceCalling, setVoiceCalling] = useState<boolean>(initialVoiceCalling);
  const [callerId, setCallerId] = useState<string>(initialCallerId);
  const [saved, setSaved] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      if (onSave) {
        await onSave({ voiceCalling, telephonyCallerId: callerId });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Title */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <PhoneCall className="w-5 h-5 text-blue-500" />
          Autonomous AI Voice Calling & Telephony
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Configure automated ~30-second lead callback dispatching, permitted calling windows, and virtual caller ID.
        </p>
      </div>

      {/* Main Feature Toggle */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Bot className="w-4 h-4 text-emerald-500" />
            Automated ~30-Second Voice Callback
          </div>
          <p className="text-xs text-slate-500 max-w-xl">
            When a prospect provides phone number and consent via chatbot or web portal, automatically trigger an AI voice callback within 30 seconds.
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={voiceCalling}
            onChange={(e) => setVoiceCalling(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
        </label>
      </div>

      {/* Mandatory AI Disclosure Notice */}
      <div className="p-4 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
        <div className="text-xs text-indigo-900 dark:text-indigo-200 space-y-1">
          <div className="font-bold">Mandatory AI Assistant Disclosure (Enforced by Default)</div>
          <p>
            Per PropBot Pro safety guidelines and telecom compliance, every outbound call begins with:
            <span className="italic block mt-1 font-mono text-[11px] bg-white/60 dark:bg-black/20 p-2 rounded">
              "Namaste! This is Aria, an AI Assistant calling on behalf of [Company Name]..."
            </span>
            This disclosure cannot be disabled. If the lead asks to speak with a human or discusses price discounts, the call automatically transfers to a human agent.
          </p>
        </div>
      </div>

      {/* Permitted Calling Window & DND Compliance */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
          <Clock className="w-4 h-4 text-blue-500" />
          Permitted Calling Window (TRAI / FCC Compliant)
        </div>
        <p className="text-xs text-slate-500">
          Automated telecalling is strictly restricted to <span className="font-semibold text-slate-700 dark:text-slate-300">09:00 AM to 08:00 PM local time</span>. Any inquiries received outside these hours are automatically queued for next-morning dispatch.
        </p>
        <div className="flex items-center gap-4 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
          <div>⏰ Calling Hours: 09:00 - 20:00</div>
          <div>🚫 National DND Scrubbing: Active</div>
          <div>🛑 Opt-Out Keyword ("Stop"): Immediate DND Flag</div>
        </div>
      </div>

      {/* Virtual Caller ID Number */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <label className="block text-sm font-bold text-slate-900 dark:text-white">
          Telephony Outbound Caller ID (DID Virtual Number)
        </label>
        <p className="text-xs text-slate-500">
          The verified telephony number presented on prospect caller ID screens.
        </p>
        <input
          type="text"
          value={callerId}
          onChange={(e) => setCallerId(e.target.value)}
          placeholder="+918040001000"
          className="w-full max-w-sm px-3.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
        />
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {saved && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
            <CheckCircle2 className="w-4 h-4" /> Settings updated
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Voice Calling Settings'}
        </button>
      </div>
    </div>
  );
};
