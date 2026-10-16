import React, { useState } from 'react';
import {
  useCompanySettings,
  useUpdateProfileMutation,
  useUpdateOperationsMutation,
  useUpdateAiControlsMutation,
} from '../services/settings.service.js';
import { GeneralBrandingTab } from '../components/settings/GeneralBrandingTab.js';
import { PipelineOperationsTab } from '../components/settings/PipelineOperationsTab.js';
import { AiControlsTab } from '../components/settings/AiControlsTab.js';
import { SecurityTab } from '../components/settings/SecurityTab.js';
import { ApiDataPrivacyTab } from '../components/settings/ApiDataPrivacyTab.js';
import { VoiceSettingsTab } from '../components/settings/VoiceSettingsTab.js';
import { EnterpriseSecurityTab } from '../components/settings/EnterpriseSecurityTab.js';
import { IntegrationsTab } from '../components/settings/IntegrationsTab.js';
import type { CompanyBranding, OperationsSettings, AiControlsSettings } from '@propbot/shared';

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    'branding' | 'pipeline' | 'ai' | 'voice' | 'security' | 'enterprise' | 'api' | 'integrations'
  >('branding');

  const { data: settingsData, isLoading } = useCompanySettings();

  const updateProfileMutation = useUpdateProfileMutation();
  const updateOperationsMutation = useUpdateOperationsMutation();
  const updateAiMutation = useUpdateAiControlsMutation();

  const handleSaveBranding = async (data: { name: string; branding: CompanyBranding }) => {
    await updateProfileMutation.mutateAsync(data);
  };

  const handleSaveOperations = async (data: OperationsSettings) => {
    await updateOperationsMutation.mutateAsync(data);
  };

  const handleSaveAi = async (data: AiControlsSettings) => {
    await updateAiMutation.mutateAsync(data);
  };

  if (isLoading) {
    return <div className="p-12 text-center text-slate-500">Loading company settings...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Agency & Company Settings
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Configure branding, white-label, sales pipeline stages, AI kill-switch controls, and security policies.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 text-sm font-medium overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('branding')}
          className={`pb-3 transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'branding'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          General & Branding
        </button>
        <button
          onClick={() => setActiveTab('pipeline')}
          className={`pb-3 transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'pipeline'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Pipeline & Operations
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`pb-3 transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'ai'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          AI Controls [v4]
        </button>
        <button
          onClick={() => setActiveTab('voice')}
          className={`pb-3 transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'voice'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          AI Voice & Telephony
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`pb-3 transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'security'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Security & Access
        </button>
        <button
          onClick={() => setActiveTab('enterprise')}
          className={`pb-3 transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'enterprise'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Enterprise & SSO
        </button>
        <button
          onClick={() => setActiveTab('api')}
          className={`pb-3 transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'api'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          API Keys & Data
        </button>
        <button
          onClick={() => setActiveTab('integrations')}
          className={`pb-3 transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'integrations'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Integrations & Vault
        </button>
      </div>

      {/* Active Tab Panel */}
      {activeTab === 'branding' && (
        <GeneralBrandingTab
          initialName={settingsData?.name}
          initialBranding={settingsData?.branding ?? undefined}
          onSave={handleSaveBranding}
        />
      )}

      {activeTab === 'pipeline' && (
        <PipelineOperationsTab
          initialSettings={settingsData?.operations ?? undefined}
          onSave={handleSaveOperations}
        />
      )}

      {activeTab === 'ai' && (
        <AiControlsTab initialSettings={settingsData?.aiControls ?? undefined} onSave={handleSaveAi} />
      )}

      {activeTab === 'voice' && <VoiceSettingsTab />}

      {activeTab === 'security' && (
        <SecurityTab initialIpAllowlist={settingsData?.security?.ipAllowlist ?? undefined} />
      )}

      {activeTab === 'enterprise' && <EnterpriseSecurityTab />}

      {activeTab === 'api' && <ApiDataPrivacyTab />}

      {activeTab === 'integrations' && <IntegrationsTab />}
    </div>
  );
};
