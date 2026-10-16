import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Lock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  MessageSquare,
  FileSpreadsheet,
  Layers,
  CreditCard,
  Key,
  ShieldCheck,
} from 'lucide-react';
import { apiRequest } from '../../services/api-client.js';
import { useAuth } from '../../contexts/AuthContext.js';
import { WhatsAppSetupWizard } from './WhatsAppSetupWizard.js';

interface IntegrationData {
  id: string;
  provider: string;
  status: 'active' | 'inactive';
  config: Record<string, string>;
  events: string[];
}

export const IntegrationsTab: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isSuperAdmin = user?.role === 'super_admin';

  const [isWaWizardOpen, setIsWaWizardOpen] = useState(false);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ provider: string; message: string; success: boolean } | null>(null);

  // 1. Fetch Company Integrations
  const { data: integrations, isLoading: _isIntegrationsLoading } = useQuery({
    queryKey: ['company-integrations'],
    queryFn: () => apiRequest<IntegrationData[]>('/api/integrations'),
  });

  // 2. Fetch Platform Integrations (super_admin)
  const { data: platformData } = useQuery({
    queryKey: ['platform-integrations'],
    queryFn: () =>
      apiRequest<
        Record<
          string,
          {
            configured: boolean;
            maskedKey?: string;
            host?: string | null;
            bucket?: string | null;
            phoneNumberId?: string | null;
          }
        >
      >('/api/integrations/platform'),
    enabled: isSuperAdmin,
  });

  // Test sync mutation
  const testMutation = useMutation({
    mutationFn: (provider: string) =>
      apiRequest<{ success: boolean; message: string }>(`/api/integrations/${provider}/test`, {
        method: 'POST',
      }),
    onSuccess: (data, provider) => {
      setTestResult({ provider, message: data.message, success: data.success });
      setTestingProvider(null);
    },
    onError: (err: unknown, provider) => {
      const errorMessage =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as Record<string, unknown>).message)
            : 'Connection test failed';
      setTestResult({
        provider,
        message: errorMessage,
        success: false,
      });
      setTestingProvider(null);
    },
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: (provider: string) =>
      apiRequest(`/api/integrations/${provider}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-integrations'] });
    },
  });

  // Update integration mutation
  const updateMutation = useMutation({
    mutationFn: ({ provider, config }: { provider: string; config: Record<string, unknown> }) =>
      apiRequest(`/api/integrations/${provider}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'active', config }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-integrations'] });
    },
  });

  const handleTest = (provider: string) => {
    setTestingProvider(provider);
    setTestResult(null);
    testMutation.mutate(provider);
  };

  const getIntegrationByProvider = (provider: string) =>
    integrations?.find(i => i.provider === provider);

  const whatsappIntegration = getIntegrationByProvider('whatsapp');
  const googleSheetsIntegration = getIntegrationByProvider('google_sheets');
  const hubspotIntegration = getIntegrationByProvider('hubspot');

  return (
    <div className="space-y-8">
      {/* Encryption & Security Notice */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900/40 dark:bg-blue-950/20 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 dark:text-blue-200">
          <p className="font-semibold text-sm">Hardware-Grade At-Rest Encryption (AES-256-GCM)</p>
          <p className="mt-0.5 text-blue-700 dark:text-blue-300">
            All API keys, access tokens, and webhook secrets are encrypted at rest with AES-256-GCM using your master vault key. Plaintext secrets are never stored in the database or exposed in browser traces.
          </p>
        </div>
      </div>

      {/* Test Result Toast */}
      {testResult && (
        <div
          className={`rounded-xl border p-4 text-xs flex items-center justify-between ${
            testResult.success
              ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
              : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            )}
            <span>
              <strong>{testResult.provider}:</strong> {testResult.message}
            </span>
          </div>
          <button
            onClick={() => setTestResult(null)}
            className="text-xs font-semibold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* PLATFORM SCOPE (super_admin only) */}
      {isSuperAdmin && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-blue-500" />
                <span>Platform Keys & Foundation (Super Admin)</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#8a8a8a]">
                Global AI router, vector embeddings, cloud storage, and email configuration.
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold border border-purple-500/20">
              Super Admin Scope
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* OpenAI Card */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1c1c1c] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs flex items-center gap-1.5 text-slate-900 dark:text-white">
                  <Key className="w-3.5 h-3.5 text-blue-500" /> OpenAI LLM Router
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    platformData?.openai?.configured
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                  }`}
                >
                  {platformData?.openai?.configured ? 'Active' : 'Unconfigured'}
                </span>
              </div>
              <p className="text-xs font-mono text-slate-500 dark:text-[#8a8a8a]">
                {platformData?.openai?.maskedKey || 'No API key set in .env'}
              </p>
            </div>

            {/* Cloudflare R2 Card */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1c1c1c] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs flex items-center gap-1.5 text-slate-900 dark:text-white">
                  <Layers className="w-3.5 h-3.5 text-blue-500" /> Cloudflare R2 Storage
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    platformData?.storage?.configured
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                  }`}
                >
                  {platformData?.storage?.configured ? 'Active' : 'Unconfigured'}
                </span>
              </div>
              <p className="text-xs font-mono text-slate-500 dark:text-[#8a8a8a]">
                {platformData?.storage?.configured ? `Bucket: ${platformData.storage.bucket}` : 'Brochures & Floor plans offline'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* COMPANY SCOPE (company_admin) */}
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-500" />
            <span>Company Channels & Integrations</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-[#8a8a8a]">
            Connect WhatsApp Business, Google Sheets, CRMs, and payment gateways for your agency.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Meta WhatsApp Card */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1c1c1c] space-y-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">Meta WhatsApp Cloud API</h4>
                  <p className="text-xs text-slate-500 dark:text-[#8a8a8a]">24/7 autonomous buyer conversion bot</p>
                </div>
              </div>
              <span
                className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                  whatsappIntegration?.status === 'active'
                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                }`}
              >
                {whatsappIntegration?.status === 'active' ? 'Connected' : 'Setup Required'}
              </span>
            </div>

            <div className="text-xs space-y-1.5">
              <div className="flex justify-between text-slate-600 dark:text-[#a3a3a3]">
                <span>System Token:</span>
                <span className="font-mono">{whatsappIntegration?.config?.token || '••••••••'}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-[#a3a3a3]">
                <span>Phone ID:</span>
                <span className="font-mono">{whatsappIntegration?.config?.phoneNumberId || 'Not Configured'}</span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-[#262626]">
              <button
                type="button"
                onClick={() => setIsWaWizardOpen(true)}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                Launch Setup Wizard &rarr;
              </button>
              {whatsappIntegration && (
                <button
                  type="button"
                  onClick={() => disconnectMutation.mutate('whatsapp')}
                  className="text-xs text-red-500 hover:underline"
                >
                  Disconnect
                </button>
              )}
            </div>
          </div>

          {/* Google Sheets Sync Card */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1c1c1c] space-y-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">Google Sheets Sync</h4>
                  <p className="text-xs text-slate-500 dark:text-[#8a8a8a]">Auto-export captured leads to spreadsheets</p>
                </div>
              </div>
              <span
                className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                  googleSheetsIntegration?.status === 'active'
                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                    : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'
                }`}
              >
                {googleSheetsIntegration?.status === 'active' ? 'Active' : 'Disconnected'}
              </span>
            </div>

            <div className="text-xs space-y-1.5">
              <div className="flex justify-between text-slate-600 dark:text-[#a3a3a3]">
                <span>Target Sheet:</span>
                <span className="font-mono truncate max-w-[200px]">
                  {googleSheetsIntegration?.config?.sheetId || 'None'}
                </span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-[#262626]">
              <button
                type="button"
                disabled={testingProvider === 'google_sheets'}
                onClick={() => handleTest('google_sheets')}
                className="text-xs font-semibold text-slate-700 dark:text-[#e6e6e6] hover:underline flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${testingProvider === 'google_sheets' ? 'animate-spin' : ''}`} />
                Test Sync
              </button>
            </div>
          </div>

          {/* HubSpot / Zoho CRM Card */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1c1c1c] space-y-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500 flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">HubSpot / Zoho CRM</h4>
                  <p className="text-xs text-slate-500 dark:text-[#8a8a8a]">Enterprise contact & pipeline bidirectional sync</p>
                </div>
              </div>
              <span
                className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                  hubspotIntegration?.status === 'active'
                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                    : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'
                }`}
              >
                {hubspotIntegration?.status === 'active' ? 'Active' : 'Available'}
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-[#8a8a8a]">
              Push qualified leads and buyer DNA directly into your CRM deal stages.
            </p>
          </div>

          {/* Razorpay Gateway Card */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1c1c1c] space-y-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">Razorpay Subscriptions</h4>
                  <p className="text-xs text-slate-500 dark:text-[#8a8a8a]">Indian UPI / Card billing & site visit token booking</p>
                </div>
              </div>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-slate-500/10 text-slate-500 border border-slate-500/20">
                Phase 12
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-[#8a8a8a]">
              Configured via `RAZORPAY_KEY_ID` in your integrations vault.
            </p>
          </div>
        </div>
      </div>

      {/* Meta WhatsApp Guided Setup Modal */}
      <WhatsAppSetupWizard
        isOpen={isWaWizardOpen}
        onClose={() => setIsWaWizardOpen(false)}
        webhookUrl={`${window.location.origin}/api/whatsapp/webhook`}
        webhookVerifyToken="propbot_whatsapp_verify_token_secure"
        onSaveCredentials={async creds => {
          await updateMutation.mutateAsync({
            provider: 'whatsapp',
            config: creds,
          });
        }}
      />
    </div>
  );
};
