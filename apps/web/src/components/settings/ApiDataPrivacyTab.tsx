import React, { useState } from 'react';
import { Key, Plus, Trash2, Download, FileJson, Check, Copy } from 'lucide-react';
import {
  useApiKeys,
  useCreateApiKeyMutation,
  useRevokeApiKeyMutation,
} from '../../services/settings.service.js';
import { apiRequest } from '../../services/api-client.js';
import type { ApiKeyRecord } from '@propbot/shared';

export const ApiDataPrivacyTab: React.FC = () => {
  const { data: apiKeys = [], isLoading } = useApiKeys();
  const createApiKeyMutation = useCreateApiKeyMutation();
  const revokeApiKeyMutation = useRevokeApiKeyMutation();

  const [isCreateKeyOpen, setIsCreateKeyOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [createdKeySecret, setCreatedKeySecret] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await createApiKeyMutation.mutateAsync({
        name: keyName.trim(),
        permissions: ['read', 'write'],
      });
      setCreatedKeySecret(res.data.apiKey);
      setKeyName('');
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to create API key.');
    }
  };

  const handleRevokeKey = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to revoke API key "${name}"? External integrations using this key will immediately stop working.`)) {
      try {
        await revokeApiKeyMutation.mutateAsync(id);
      } catch (err: unknown) {
        alert((err as Error).message || 'Failed to revoke API key.');
      }
    }
  };

  const handleCopySecret = () => {
    if (createdKeySecret) {
      navigator.clipboard.writeText(createdKeySecret);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const data = await apiRequest<Record<string, unknown>>('/api/settings/data/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `propbot-tenant-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to export tenant data.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* 1. API Keys */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <Key className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">API Keys</h3>
              <p className="text-xs text-slate-500">
                Generate authenticated API keys for custom backend and CRM integrations
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setCreatedKeySecret(null);
              setIsCreateKeyOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            New API Key
          </button>
        </div>

        {/* Modal for Creating Key */}
        {isCreateKeyOpen && (
          <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
            {createdKeySecret ? (
              <div className="space-y-3">
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs space-y-2">
                  <div className="font-bold flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-600" />
                    API Key Created Successfully
                  </div>
                  <p>
                    Please copy this secret key now. For security, it will <strong>never be displayed again</strong>.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      readOnly
                      value={createdKeySecret}
                      className="flex-1 px-3 py-1.5 font-mono text-xs bg-white border border-emerald-300 rounded-lg select-all"
                    />
                    <button
                      type="button"
                      onClick={handleCopySecret}
                      className="px-3 py-1.5 bg-emerald-700 text-white rounded-lg font-semibold flex items-center gap-1"
                    >
                      {hasCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {hasCopied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateKeyOpen(false)}
                  className="w-full py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateKey} className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Key Label
                </h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="e.g. Zapier Lead Ingestion, Analytics Webhook"
                    value={keyName}
                    onChange={e => setKeyName(e.target.value)}
                    className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                  <button
                    type="submit"
                    disabled={createApiKeyMutation.isPending}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm"
                  >
                    Generate
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCreateKeyOpen(false)}
                    className="px-3 py-2 text-xs text-slate-500 hover:bg-slate-200 rounded-xl"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Keys Table */}
        <div className="pt-2">
          {isLoading ? (
            <p className="text-xs text-slate-500">Loading keys...</p>
          ) : apiKeys.length === 0 ? (
            <p className="text-xs text-slate-400">No active API keys found.</p>
          ) : (
            <div className="space-y-2">
              {apiKeys.map((key: ApiKeyRecord) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs"
                >
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      {key.name}
                      <span className="font-mono text-[11px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                        {key.keyPrefix}...
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Created: {new Date(key.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRevokeKey(key.id, key.name)}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Revoke key"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2. Data Export & Privacy */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
              <FileJson className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Data Portability & GDPR / DPDP Export
              </h3>
              <p className="text-xs text-slate-500">
                Download a complete JSON archive of all company leads, chats, contacts, and inventory
              </p>
            </div>
          </div>
          <button
            onClick={handleExportData}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 text-white font-semibold text-xs rounded-xl shadow-md transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {isExporting ? 'Exporting...' : 'Export Data (JSON)'}
          </button>
        </div>
      </div>
    </div>
  );
};
