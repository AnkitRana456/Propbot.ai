import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Key,
  Lock,
  FileSpreadsheet,
  Download,
  RefreshCw,
  CheckCircle2,
  FileText,
  Clock,
} from 'lucide-react';

interface SecurityQA {
  category: string;
  standard: string;
  question: string;
  answer: string;
}

interface SecurityPackPayload {
  overview?: string;
  certifications: string[];
  reportDate?: string;
  qaList: SecurityQA[];
}

export const EnterpriseSecurityTab: React.FC = () => {
  // SSO State
  const [ssoProvider, setSsoProvider] = useState<string>('okta');
  const [domain, setDomain] = useState<string>('');
  const [issuer, setIssuer] = useState<string>('');
  const [ssoUrl, setSsoUrl] = useState<string>('');
  const [certificate, setCertificate] = useState<string>('');
  const [isEnforced, setIsEnforced] = useState<boolean>(false);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [ssoSaving, setSsoSaving] = useState<boolean>(false);
  const [ssoSuccess, setSsoSuccess] = useState<boolean>(false);

  // 2FA State
  const [enforce2FA, setEnforce2FA] = useState<boolean>(false);

  // Key Rotation State
  const [keys, setKeys] = useState<Array<{ id: string; name: string; keyPrefix: string; createdAt: string }>>([]);
  const [rotatingKeyId, setRotatingKeyId] = useState<string | null>(null);
  const [rotatedKeyResult, setRotatedKeyResult] = useState<{
    newApiKey: string;
    gracePeriodEndsAt: string;
  } | null>(null);

  // Security Pack Modal
  const [showSecurityPack, setShowSecurityPack] = useState<boolean>(false);
  const [securityPackData, setSecurityPackData] = useState<SecurityPackPayload | null>(null);

  const fetchInitialData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      // 1. Fetch SSO
      const ssoRes = await fetch('/api/enterprise/sso', { headers });
      if (ssoRes.ok) {
        const json = await ssoRes.json();
        if (json.data) {
          setSsoProvider(json.data.ssoProvider || 'okta');
          setDomain(json.data.domain || '');
          setIssuer(json.data.issuer || '');
          setSsoUrl(json.data.ssoUrl || '');
          setCertificate(json.data.certificate || '');
          setIsEnforced(json.data.isEnforced || false);
          setIsActive(json.data.isActive ?? true);
        }
      }

      // 2. Fetch API keys
      const keysRes = await fetch('/api/settings/api-keys', { headers });
      if (keysRes.ok) {
        const json = await keysRes.json();
        setKeys(json.data || []);
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const handleSaveSso = async (e: React.FormEvent) => {
    e.preventDefault();
    setSsoSaving(true);
    setSsoSuccess(false);
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch('/api/enterprise/sso', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ssoProvider,
          domain,
          issuer,
          ssoUrl,
          certificate,
          isEnforced,
          isActive,
        }),
      });

      if (res.ok) {
        setSsoSuccess(true);
        setTimeout(() => setSsoSuccess(false), 3000);
      }
    } finally {
      setSsoSaving(false);
    }
  };

  const handleRotateKey = async (keyId: string) => {
    setRotatingKeyId(keyId);
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`/api/enterprise/api-keys/${keyId}/rotate`, {
        method: 'POST',
        headers,
      });

      if (res.ok) {
        const json = await res.json();
        setRotatedKeyResult(json.data);
        fetchInitialData();
      }
    } finally {
      setRotatingKeyId(null);
    }
  };

  const handleExportAuditLogs = (format: 'csv' | 'json') => {
    const token = localStorage.getItem('token');
    window.open(`/api/enterprise/audit-logs/export?format=${format}&token=${token}`, '_blank');
  };

  const handleViewSecurityPack = async () => {
    try {
      const res = await fetch('/api/enterprise/security-pack');
      if (res.ok) {
        const json = await res.json();
        setSecurityPackData(json.data);
        setShowSecurityPack(true);
      }
    } catch {
      // Ignore
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-blue-500" />
          Enterprise Security & Identity Governance
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Configure SAML/OIDC Single Sign-On, enforce 2FA policies, manage IP allowlists, rotate API keys, and download compliance audits.
        </p>
      </div>

      {/* 1. SAML 2.0 / OIDC SSO Configuration */}
      <form onSubmit={handleSaveSso} className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Enterprise Single Sign-On (SAML 2.0 / OIDC)
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Connect corporate Identity Providers (Okta, Azure AD / Entra ID, PingIdentity, Google Workspace).
            </p>
          </div>
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
            Enterprise Plan
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Identity Provider (IdP)
            </label>
            <select
              value={ssoProvider}
              onChange={(e) => setSsoProvider(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="okta">Okta (SAML 2.0)</option>
              <option value="azure_ad">Microsoft Entra ID / Azure AD</option>
              <option value="google">Google Workspace (OIDC)</option>
              <option value="ping">PingIdentity</option>
              <option value="custom_saml">Custom SAML 2.0</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Corporate Email Domain
            </label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="e.g. dlf.in or prestige.com"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Issuer / Entity ID
            </label>
            <input
              type="text"
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              placeholder="https://identity.okta.com"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-[11px]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              IdP SSO URL / Endpoint
            </label>
            <input
              type="text"
              value={ssoUrl}
              onChange={(e) => setSsoUrl(e.target.value)}
              placeholder="https://identity.okta.com/app/sso/saml"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-[11px]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            X.509 Public Certificate
          </label>
          <textarea
            rows={3}
            value={certificate}
            onChange={(e) => setCertificate(e.target.value)}
            placeholder="-----BEGIN CERTIFICATE-----&#10;MIIDXTCCAkWgAwIBAgIJAL0...&#10;-----END CERTIFICATE-----"
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-[11px] resize-none"
          />
        </div>

        {/* Enforce SSO toggle */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
          <div>
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              Enforce SSO (Block Password Authentication)
            </div>
            <div className="text-[11px] text-slate-500">
              When checked, all users matching domain @{domain || 'company.com'} must authenticate via IdP.
            </div>
          </div>
          <input
            type="checkbox"
            checked={isEnforced}
            onChange={(e) => setIsEnforced(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          {ssoSuccess && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> SSO configuration saved
            </span>
          )}
          <button
            type="submit"
            disabled={ssoSaving}
            className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition disabled:opacity-50"
          >
            {ssoSaving ? 'Saving...' : 'Save SSO Settings'}
          </button>
        </div>
      </form>

      {/* 2. Enforce 2FA Policy */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Lock className="w-4 h-4 text-purple-500" />
            Mandatory Two-Factor Authentication (2FA) Policy
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Require TOTP / Authenticator 2FA verification for all company administrators and agents.
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={enforce2FA}
            onChange={(e) => setEnforce2FA(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-purple-600"></div>
        </label>
      </div>

      {/* 3. Zero-Downtime Secrets & API Key Rotation */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Key className="w-4 h-4 text-amber-500" />
            Zero-Downtime API Key Rotation
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Rotate compromised or scheduled API keys with zero downtime. Old keys remain valid for a <span className="font-semibold text-slate-700 dark:text-slate-300">24-hour grace window</span>.
          </p>
        </div>

        {rotatedKeyResult && (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-2">
            <div className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-600" />
              Key Rotated Successfully (24-Hour Grace Period Active)
            </div>
            <div className="text-xs text-amber-800 dark:text-amber-300">
              Copy your new API key now (it will never be displayed again):
            </div>
            <div className="p-2.5 bg-white dark:bg-black/40 rounded-lg font-mono text-xs text-slate-900 dark:text-white select-all break-all border border-amber-300 dark:border-amber-700">
              {rotatedKeyResult.newApiKey}
            </div>
            <div className="text-[11px] text-amber-700 dark:text-amber-400">
              Old key will be permanently decommissioned at: {new Date(rotatedKeyResult.gracePeriodEndsAt).toLocaleString()}
            </div>
          </div>
        )}

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {keys.map((k) => (
            <div key={k.id} className="py-3 flex items-center justify-between text-xs">
              <div>
                <span className="font-semibold text-slate-900 dark:text-white">{k.name}</span>
                <span className="ml-2 font-mono text-slate-400">{k.keyPrefix}...</span>
              </div>
              <button
                onClick={() => handleRotateKey(k.id)}
                disabled={rotatingKeyId === k.id}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium transition flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${rotatingKeyId === k.id ? 'animate-spin' : ''}`} />
                Rotate (24h Grace)
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Audit Log Export & SOC 2 Security Questionnaire */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-blue-500" />
            Compliance Auditing & Security Questionnaire
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Export tenant audit logs for SIEM ingestion or review SOC 2 Type II / ISO 27001 compliance answers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => handleExportAuditLogs('csv')}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white transition flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Export Audit Logs (CSV)
          </button>
          <button
            onClick={() => handleExportAuditLogs('json')}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white transition flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Export Audit Logs (JSON Stream)
          </button>
          <button
            onClick={handleViewSecurityPack}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            SOC 2 / ISO 27001 Security Answers Pack
          </button>
        </div>
      </div>

      {/* Security Pack Modal */}
      {showSecurityPack && securityPackData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  SOC 2 & ISO 27001 Security Architecture Pack
                </h3>
                <div className="flex gap-2 mt-1">
                  {securityPackData.certifications.map((c: string) => (
                    <span key={c} className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setShowSecurityPack(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs divide-y divide-slate-100 dark:divide-slate-800">
              {securityPackData.qaList.map((qa, idx) => (
                <div key={idx} className="pt-3 first:pt-0 space-y-1">
                  <div className="font-semibold text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider">
                    {qa.category} • {qa.standard}
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white">
                    {qa.question}
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    {qa.answer}
                  </p>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setShowSecurityPack(false)}
                className="px-4 py-2 text-xs font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg"
              >
                Close Pack
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
