import React, { useState, useEffect } from 'react';
import { ShieldAlert, Cpu, Check, AlertOctagon } from 'lucide-react';
import type { AiControlsSettings } from '@propbot/shared';

interface AiControlsTabProps {
  initialSettings?: AiControlsSettings;
  onSave: (data: AiControlsSettings) => Promise<void>;
}

export const AiControlsTab: React.FC<AiControlsTabProps> = ({ initialSettings, onSave }) => {
  const [killSwitch, setKillSwitch] = useState(initialSettings?.killSwitch ?? false);
  const [allowedTiers, setAllowedTiers] = useState<('T0' | 'T1' | 'T2')[]>(
    initialSettings?.allowedTiers || ['T0', 'T1'],
  );
  const [dailyActionCap, setDailyActionCap] = useState(initialSettings?.dailyActionCap || 100);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (initialSettings) {
      setKillSwitch(initialSettings.killSwitch);
      setAllowedTiers(initialSettings.allowedTiers);
      setDailyActionCap(initialSettings.dailyActionCap);
    }
  }, [initialSettings]);

  const handleTierToggle = (tier: 'T0' | 'T1' | 'T2') => {
    if (allowedTiers.includes(tier)) {
      if (allowedTiers.length === 1) {
        alert('At least one action tier must remain enabled.');
        return;
      }
      setAllowedTiers(allowedTiers.filter(t => t !== tier));
    } else {
      setAllowedTiers([...allowedTiers, tier]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccess(false);
    try {
      await onSave({
        killSwitch,
        allowedTiers,
        dailyActionCap,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to update AI controls.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {savedSuccess && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-sm flex items-center gap-2">
          <Check className="w-4 h-4" />
          AI safety guardrails and governance controls updated.
        </div>
      )}

      {/* Emergency Kill Switch */}
      <div className="p-6 bg-rose-50/50 dark:bg-rose-950/20 rounded-2xl border border-rose-200 dark:border-rose-900/60 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-rose-950 dark:text-rose-200">
                Master AI Kill Switch
              </h3>
              <p className="text-xs text-rose-700 dark:text-rose-400">
                Instantly pauses all automated AI chat responses and WhatsApp automated replies. Human agents take over all active chats immediately.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setKillSwitch(k => !k)}
            className={`w-14 h-7 rounded-full p-0.5 transition-colors ${
              killSwitch ? 'bg-rose-600' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full bg-white shadow-md transition-transform ${
                killSwitch ? 'translate-x-7' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
        {killSwitch && (
          <div className="text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/50 p-2 rounded-lg">
            ⚠️ Kill switch is ACTIVE: Chatbots and WhatsApp auto-replies are paused.
          </div>
        )}
      </div>

      {/* Allowed Action Tiers */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-blue-600" />
          Guarded Action Layer — Permission Tiers
        </h3>
        <p className="text-xs text-slate-500">
          Govern which actions the AI can autonomously execute without human approval
        </p>

        <div className="space-y-3 pt-2">
          <div className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
            <input
              type="checkbox"
              id="tier-t0"
              checked={allowedTiers.includes('T0')}
              onChange={() => handleTierToggle('T0')}
              className="mt-1 w-4 h-4 rounded text-blue-600 cursor-pointer"
            />
            <label htmlFor="tier-t0" className="text-xs cursor-pointer flex-1">
              <span className="font-bold text-slate-900 dark:text-white block">
                Tier 0: Read-Only Actions (Autonomous)
              </span>
              <span className="text-slate-500">
                RAG knowledge queries, verified inventory searches, brochure downloads, FAQ answering.
              </span>
            </label>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
            <input
              type="checkbox"
              id="tier-t1"
              checked={allowedTiers.includes('T1')}
              onChange={() => handleTierToggle('T1')}
              className="mt-1 w-4 h-4 rounded text-blue-600 cursor-pointer"
            />
            <label htmlFor="tier-t1" className="text-xs cursor-pointer flex-1">
              <span className="font-bold text-slate-900 dark:text-white block">
                Tier 1: Non-Binding Conversational Actions (Autonomous)
              </span>
              <span className="text-slate-500">
                Capturing lead contact information, booking site visits, updating Buyer DNA preferences.
              </span>
            </label>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
            <input
              type="checkbox"
              id="tier-t2"
              checked={allowedTiers.includes('T2')}
              onChange={() => handleTierToggle('T2')}
              className="mt-1 w-4 h-4 rounded text-blue-600 cursor-pointer"
            />
            <label htmlFor="tier-t2" className="text-xs cursor-pointer flex-1">
              <span className="font-bold text-slate-900 dark:text-white block">
                Tier 2: Financial & Contractual Commitments (Human Approval Required)
              </span>
              <span className="text-slate-500">
                Price promises, custom discounts, payment plan agreements, token booking amounts. When unapproved, these proposals land in the <code>agent_actions</code> queue.
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Daily Action Cap */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
          <Cpu className="w-4 h-4 text-purple-600" />
          Daily Automated Action Cap
        </h3>
        <p className="text-xs text-slate-500">
          Circuit-breaker safeguard to cap autonomous actions per 24-hour window
        </p>

        <div className="flex items-center gap-4 pt-2">
          <input
            type="range"
            min={10}
            max={2000}
            step={10}
            value={dailyActionCap}
            onChange={e => setDailyActionCap(Number(e.target.value))}
            className="flex-1 accent-purple-600 cursor-pointer"
          />
          <span className="font-bold text-sm text-slate-900 dark:text-white w-24 text-right">
            {dailyActionCap} actions/day
          </span>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSaving}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-md transition-all disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save AI Controls'}
        </button>
      </div>
    </form>
  );
};
