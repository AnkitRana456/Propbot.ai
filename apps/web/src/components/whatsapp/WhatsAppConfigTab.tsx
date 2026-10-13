import React, { useState, useEffect } from 'react';
import {
  Save,
  Copy,
  RefreshCw,
  Check,
  Key,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import {
  useWhatsappConfig,
  useUpdateWhatsappConfig,
  useGenerateVerifyToken,
  useQuickConnectSandbox,
} from '../../services/whatsapp.service.js';
import { useChatbots } from '../../services/chatbots.service.js';

export function WhatsAppConfigTab() {
  const { data: config, isLoading } = useWhatsappConfig();
  const { data: chatbotsData } = useChatbots();
  const updateConfigMutation = useUpdateWhatsappConfig();
  const generateTokenMutation = useGenerateVerifyToken();
  const quickConnectMutation = useQuickConnectSandbox();

  // Form State
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [businessPhoneNumber, setBusinessPhoneNumber] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [templateName, setTemplateName] = useState('property_inquiry_details');
  const [chatbotId, setChatbotId] = useState<string>('');

  // Automation Toggles
  const [enableAutomation, setEnableAutomation] = useState(true);
  const [aiAutoReplies, setAiAutoReplies] = useState(true);
  const [pauseAfterAgentReply, setPauseAfterAgentReply] = useState(true);
  const [frustrationHandoff, setFrustrationHandoff] = useState(true);
  const [autoAssignOwner, setAutoAssignOwner] = useState(true);
  const [handoffKeywords, setHandoffKeywords] = useState('agent, human, representative, complaint');
  const [handoffMessage, setHandoffMessage] = useState(
    'A property advisor will continue this conversation shortly.',
  );

  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (config) {
      setPhoneNumberId(config.phoneNumberId || '');
      setBusinessPhoneNumber(config.businessPhoneNumber || '');
      setAccessToken(config.maskedAccessToken || '');
      setTemplateName(config.templateName || 'property_inquiry_details');
      setChatbotId(config.chatbotId || '');
      setEnableAutomation(config.enableAutomation);
      setAiAutoReplies(config.aiAutoReplies);
      setPauseAfterAgentReply(config.pauseAfterAgentReply);
      setFrustrationHandoff(config.frustrationHandoff);
      setAutoAssignOwner(config.autoAssignOwner);
      setHandoffKeywords(config.handoffKeywords?.join(', ') || 'agent, human, representative, complaint');
      setHandoffMessage(config.handoffMessage || 'A property advisor will continue this conversation shortly.');
    }
  }, [config]);

  const handleCopy = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateConfigMutation.mutateAsync({
      phoneNumberId,
      businessPhoneNumber,
      accessToken,
      appSecret: appSecret || undefined,
      templateName,
      chatbotId: chatbotId || null,
      enableAutomation,
      aiAutoReplies,
      pauseAfterAgentReply,
      frustrationHandoff,
      autoAssignOwner,
      handoffKeywords: handoffKeywords
        .split(',')
        .map(k => k.trim())
        .filter(Boolean),
      handoffMessage,
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  if (isLoading) {
    return <div className="p-8 text-center text-xs text-gray-400">Loading configuration...</div>;
  }

  const callbackUrl = config?.callbackUrl || 'https://api.propbot.pro/api/webhooks/meta';
  const verifyToken = config?.verifyToken || '';
  const availableChatbots = chatbotsData?.chatbots || [];

  return (
    <form onSubmit={handleSaveAll} className="space-y-6 max-w-4xl">
      {/* Quick Sandbox Connect Card */}
      <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-gray-900">Meta Cloud API Connection</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  config?.status === 'connected'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {config?.status === 'connected' ? 'Connected (Active)' : 'Disconnected'}
              </span>
            </div>
            <p className="text-[11px] text-gray-600 mt-0.5">
              Connect your Meta Business WhatsApp phone number or use the instant 1-click sandbox to test AI replies.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => quickConnectMutation.mutate()}
          disabled={quickConnectMutation.isPending}
          className="shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center justify-center space-x-1.5 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${quickConnectMutation.isPending ? 'animate-spin' : ''}`} />
          <span>{config?.status === 'connected' ? 'Reconnect Sandbox' : 'Quick Connect Sandbox'}</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center space-x-2">
          <Check className="h-4 w-4 text-emerald-600" />
          <span>WhatsApp configuration and automation settings saved successfully!</span>
        </div>
      )}

      {/* 1. Inbox Automation Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-5">
        <div className="flex items-center space-x-2 border-b border-gray-100 pb-3">
          <Settings className="h-5 w-5 text-blue-600" />
          <div>
            <h3 className="text-sm font-bold text-gray-900">Inbox Automation Settings</h3>
            <p className="text-xs text-gray-500">Configure AI auto-replies and human handoff rules</p>
          </div>
        </div>

        <div className="space-y-3.5">
          <label className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100/60 rounded-xl cursor-pointer transition">
            <div>
              <p className="text-xs font-bold text-gray-900">Enable Automation</p>
              <p className="text-[11px] text-gray-500">Master switch for all incoming WhatsApp processing</p>
            </div>
            <input
              type="checkbox"
              checked={enableAutomation}
              onChange={e => setEnableAutomation(e.target.checked)}
              className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100/60 rounded-xl cursor-pointer transition">
            <div>
              <p className="text-xs font-bold text-gray-900">AI Auto-Replies</p>
              <p className="text-[11px] text-gray-500">Answer visitor questions using linked Chatbot & Knowledge Base</p>
            </div>
            <input
              type="checkbox"
              checked={aiAutoReplies}
              onChange={e => setAiAutoReplies(e.target.checked)}
              className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100/60 rounded-xl cursor-pointer transition">
            <div>
              <p className="text-xs font-bold text-gray-900">Pause After Agent Reply</p>
              <p className="text-[11px] text-gray-500">Pause AI when a team member manually replies from the Shared Inbox</p>
            </div>
            <input
              type="checkbox"
              checked={pauseAfterAgentReply}
              onChange={e => setPauseAfterAgentReply(e.target.checked)}
              className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100/60 rounded-xl cursor-pointer transition">
            <div>
              <p className="text-xs font-bold text-gray-900">Frustration Handoff (Sentiment Detection)</p>
              <p className="text-[11px] text-gray-500">Automatically trigger human takeover on frustrated tone or complaints</p>
            </div>
            <input
              type="checkbox"
              checked={frustrationHandoff}
              onChange={e => setFrustrationHandoff(e.target.checked)}
              className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100/60 rounded-xl cursor-pointer transition">
            <div>
              <p className="text-xs font-bold text-gray-900">Auto-Assign Owner (Round-Robin)</p>
              <p className="text-[11px] text-gray-500">Distribute handoff leads evenly across active sales agents</p>
            </div>
            <input
              type="checkbox"
              checked={autoAssignOwner}
              onChange={e => setAutoAssignOwner(e.target.checked)}
              className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Handoff Keywords</label>
            <input
              type="text"
              value={handoffKeywords}
              onChange={e => setHandoffKeywords(e.target.value)}
              placeholder="agent, human, representative, complaint"
              className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-gray-400 mt-1">Comma-separated triggers for agent takeover</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Handoff Message</label>
            <input
              type="text"
              value={handoffMessage}
              onChange={e => setHandoffMessage(e.target.value)}
              placeholder="A property advisor will continue this conversation shortly."
              className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-gray-400 mt-1">Sent to visitor upon handoff</p>
          </div>
        </div>
      </div>

      {/* 2. Meta API Credentials Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-5">
        <div className="flex items-center space-x-2 border-b border-gray-100 pb-3">
          <Key className="h-5 w-5 text-indigo-600" />
          <div>
            <h3 className="text-sm font-bold text-gray-900">Meta API Credentials</h3>
            <p className="text-xs text-gray-500">Configure your Meta WhatsApp Business Cloud API parameters</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Phone Number ID *</label>
            <input
              type="text"
              value={phoneNumberId}
              onChange={e => setPhoneNumberId(e.target.value)}
              placeholder="e.g. 104928172635412"
              required
              className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Business WhatsApp Number *</label>
            <input
              type="text"
              value={businessPhoneNumber}
              onChange={e => setBusinessPhoneNumber(e.target.value)}
              placeholder="+91 98765 43210"
              required
              className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Permanent Access Token *</label>
            <input
              type="text"
              value={accessToken}
              onChange={e => setAccessToken(e.target.value)}
              placeholder="EAAG••••••••"
              required
              className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <p className="text-[11px] text-gray-400 mt-1">Encrypted and masked server-side</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Meta App Secret (Optional)</label>
            <input
              type="password"
              value={appSecret}
              onChange={e => setAppSecret(e.target.value)}
              placeholder={config?.hasAppSecret ? '••••••••••••••••' : 'Enter Meta App Secret'}
              className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <p className="text-[11px] text-gray-400 mt-1">Used for X-Hub-Signature-256 HMAC verification</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Approved Details Template Name</label>
            <input
              type="text"
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              placeholder="property_inquiry_details"
              className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <p className="text-[11px] text-gray-400 mt-1">Used outside the 24h customer window</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Select Chatbot</label>
            <select
              value={chatbotId}
              onChange={e => setChatbotId(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Default AI Concierge</option>
              {availableChatbots.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.type})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-400 mt-1">Chatbot knowledge base used for WhatsApp replies</p>
          </div>
        </div>

        {/* Webhook Verify Token */}
        <div className="pt-2">
          <label className="block text-xs font-bold text-gray-700 mb-1">Webhook Verify Token</label>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              readOnly
              value={verifyToken}
              className="flex-1 text-xs px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg font-mono text-gray-700 select-all"
            />
            <button
              type="button"
              onClick={() => handleCopy(verifyToken, setCopiedToken)}
              className="px-3 py-2 text-xs font-semibold border border-gray-200 hover:bg-gray-50 rounded-lg flex items-center space-x-1"
            >
              {copiedToken ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              <span>{copiedToken ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              type="button"
              onClick={() => generateTokenMutation.mutate()}
              disabled={generateTokenMutation.isPending}
              className="px-3 py-2 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg flex items-center space-x-1"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Generate New</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Webhook Configuration Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center space-x-2 border-b border-gray-100 pb-3">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <div>
            <h3 className="text-sm font-bold text-gray-900">Webhook Configuration</h3>
            <p className="text-xs text-gray-500">Register this callback URL in your Meta Developers App</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">Callback URL</label>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              readOnly
              value={callbackUrl}
              className="flex-1 text-xs px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg font-mono text-gray-700 select-all"
            />
            <button
              type="button"
              onClick={() => handleCopy(callbackUrl, setCopiedUrl)}
              className="px-3 py-2 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-lg flex items-center space-x-1"
            >
              {copiedUrl ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* 6 Setup Instructions */}
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-700 space-y-2">
          <p className="font-bold text-gray-900">6-Step Meta Developer Setup Instructions:</p>
          <ol className="list-decimal list-inside space-y-1 text-gray-600">
            <li>Open the Meta developers dashboard (developers.facebook.com)</li>
            <li>Add the <strong>WhatsApp</strong> product to your Meta app</li>
            <li>Go to <strong>Configuration</strong> &rarr; Click <strong>Edit Webhook</strong></li>
            <li>Paste the <strong>Callback URL</strong> and <strong>Verify Token</strong> from above</li>
            <li>Click <strong>Verify and Save</strong> to complete the handshake</li>
            <li>Under Webhook fields &rarr; Click <strong>Manage</strong> &rarr; Subscribe to <strong>messages</strong></li>
          </ol>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={updateConfigMutation.isPending}
          className="inline-flex items-center px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition disabled:opacity-50"
        >
          <Save className="h-4 w-4 mr-1.5" />
          {updateConfigMutation.isPending ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </form>
  );
}
