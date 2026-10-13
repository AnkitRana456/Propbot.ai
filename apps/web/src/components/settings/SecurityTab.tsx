import React, { useState } from 'react';
import { KeyRound, Shield, Laptop, Trash2 } from 'lucide-react';
import {
  useSetupTwoFactorMutation,
  useVerifyTwoFactorMutation,
  useDisableTwoFactorMutation,
  useUpdateIpAllowlistMutation,
} from '../../services/settings.service.js';
import { useUserSessions, useRevokeSessionMutation } from '../../services/users.service.js';
import type { UserSessionRecord } from '@propbot/shared';

interface SecurityTabProps {
  initialIpAllowlist?: string[];
  onSaveSecurity?: (data: { ipAllowlist: string[] }) => Promise<void>;
}

export const SecurityTab: React.FC<SecurityTabProps> = ({ initialIpAllowlist = [] }) => {
  // 2FA state
  const [isSettingUp2Fa, setIsSettingUp2Fa] = useState(false);
  const [totpSecret, setTotpSecret] = useState('');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);

  // Sessions query
  const { data: sessions = [] } = useUserSessions();
  const revokeSessionMutation = useRevokeSessionMutation();

  // IP Allowlist state
  const [ips, setIps] = useState<string[]>(initialIpAllowlist);
  const [newIp, setNewIp] = useState('');

  // Mutations
  const setup2FaMutation = useSetupTwoFactorMutation();
  const verify2FaMutation = useVerifyTwoFactorMutation();
  const disable2FaMutation = useDisableTwoFactorMutation();
  const updateIpAllowlistMutation = useUpdateIpAllowlistMutation();

  const handleStartSetup2Fa = async () => {
    try {
      const res = await setup2FaMutation.mutateAsync();
      setTotpSecret(res.data.secret);
      setOtpauthUrl(res.data.otpauthUrl);
      setIsSettingUp2Fa(true);
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to initiate 2FA setup.');
    }
  };

  const handleVerify2Fa = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await verify2FaMutation.mutateAsync(verificationCode.trim());
      setTwoFaEnabled(true);
      setIsSettingUp2Fa(false);
      setVerificationCode('');
      alert('Two-Factor Authentication is now enabled!');
    } catch (err: unknown) {
      alert((err as Error).message || 'Invalid verification code. (Hint: Use 123456 in dev/test)');
    }
  };

  const handleDisable2Fa = async () => {
    if (confirm('Are you sure you want to disable Two-Factor Authentication?')) {
      try {
        await disable2FaMutation.mutateAsync();
        setTwoFaEnabled(false);
        setIsSettingUp2Fa(false);
        alert('Two-Factor Authentication disabled.');
      } catch (err: unknown) {
        alert((err as Error).message || 'Failed to disable 2FA.');
      }
    }
  };

  const handleAddIp = () => {
    if (newIp.trim() && !ips.includes(newIp.trim())) {
      const updated = [...ips, newIp.trim()];
      setIps(updated);
      setNewIp('');
      updateIpAllowlistMutation.mutate(updated);
    }
  };

  const handleRemoveIp = (ipToRemove: string) => {
    const updated = ips.filter(ip => ip !== ipToRemove);
    setIps(updated);
    updateIpAllowlistMutation.mutate(updated);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* 1. Two-Factor Authentication */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Two-Factor Authentication (TOTP)
              </h3>
              <p className="text-xs text-slate-500">
                Secure your account with Google Authenticator, Authy, or 1Password
              </p>
            </div>
          </div>
          {twoFaEnabled ? (
            <button
              onClick={handleDisable2Fa}
              className="px-3.5 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors"
            >
              Disable 2FA
            </button>
          ) : (
            <button
              onClick={handleStartSetup2Fa}
              disabled={isSettingUp2Fa}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all"
            >
              Configure 2FA
            </button>
          )}
        </div>

        {/* Setup Wizard */}
        {isSettingUp2Fa && (
          <div className="mt-4 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4 animate-in fade-in duration-150">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Step 1: Save TOTP Key in Authenticator App
            </h4>
            <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-xs select-all text-center font-bold text-slate-800 dark:text-slate-200">
              {totpSecret}
            </div>
            <p className="text-[11px] text-slate-500 text-center">
              Add this key manually to your authenticator app, or copy URL: <br />
              <code className="text-[10px] select-all break-all">{otpauthUrl}</code>
            </p>

            <form onSubmit={handleVerify2Fa} className="space-y-3 pt-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Step 2: Enter 6-Digit Verification Code
              </h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={6}
                  required
                  placeholder="000000"
                  value={verificationCode}
                  onChange={e => setVerificationCode(e.target.value)}
                  className="w-40 px-3 py-2 text-center text-sm font-mono tracking-widest rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={verify2FaMutation.isPending}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
                >
                  Verify & Activate
                </button>
                <button
                  type="button"
                  onClick={() => setIsSettingUp2Fa(false)}
                  className="px-3 py-2 text-xs text-slate-500 hover:bg-slate-200 rounded-xl"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* 2. Active Sessions Management */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
          <Laptop className="w-4 h-4 text-indigo-600" />
          Active Login Sessions
        </h3>
        <p className="text-xs text-slate-500">
          Devices and browser sessions currently logged into your account
        </p>

        <div className="space-y-2 pt-1">
          {sessions.length === 0 ? (
            <p className="text-xs text-slate-400">1 active session (current browser)</p>
          ) : (
            sessions.map((sess: UserSessionRecord) => (
              <div
                key={sess.familyId}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs"
              >
                <div className="flex items-center gap-3">
                  <Laptop className="w-4 h-4 text-slate-500" />
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      {sess.device}
                      {sess.isCurrent && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Last active: {new Date(sess.lastActiveAt).toLocaleString()}
                    </div>
                  </div>
                </div>
                {!sess.isCurrent && (
                  <button
                    onClick={() => revokeSessionMutation.mutate(sess.familyId)}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Terminate session"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 3. Enterprise IP Allowlist */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
          <Shield className="w-4 h-4 text-purple-600" />
          Enterprise IP Allowlist
        </h3>
        <p className="text-xs text-slate-500">
          Restrict dashboard administrative access strictly to approved static corporate IP addresses
        </p>

        <div className="flex flex-wrap gap-2 pt-1">
          {ips.length === 0 ? (
            <p className="text-xs text-slate-400">
              No IP restrictions active. Access is allowed from any network.
            </p>
          ) : (
            ips.map(ip => (
              <span
                key={ip}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200"
              >
                {ip}
                <button
                  onClick={() => handleRemoveIp(ip)}
                  className="hover:text-rose-500 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <input
            type="text"
            value={newIp}
            onChange={e => setNewIp(e.target.value)}
            placeholder="e.g. 203.0.113.195 or 198.51.100.0/24"
            className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          />
          <button
            type="button"
            onClick={handleAddIp}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 text-white text-xs font-semibold rounded-xl"
          >
            Add IP
          </button>
        </div>
      </div>
    </div>
  );
};
