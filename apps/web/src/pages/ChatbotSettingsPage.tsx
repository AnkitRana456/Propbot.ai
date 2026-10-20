import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { ChatbotConfig, ChatbotStatus, ChatbotType } from '@propbot/shared';
import {
  useChatbot,
  useUpdateChatbot,
  useRotateKey,
  useDeleteChatbot,
} from '../services/chatbots.service.js';
import { LiveWidgetPreview } from '../components/chatbots/LiveWidgetPreview.js';
import { Step2Appearance } from '../components/chatbots/wizard/Step2Appearance.js';
import { Step3Greeting } from '../components/chatbots/wizard/Step3Greeting.js';
import { Step4Persona } from '../components/chatbots/wizard/Step4Persona.js';
import { Step5LeadCapture } from '../components/chatbots/wizard/Step5LeadCapture.js';
import { Step6BusinessHours } from '../components/chatbots/wizard/Step6BusinessHours.js';
import { Step7AllowedDomains } from '../components/chatbots/wizard/Step7AllowedDomains.js';
import { AgentPicker } from '../components/chatbots/AgentPicker.js';
import { ObjectionPlaybooksTab } from '../components/chatbots/ObjectionPlaybooksTab.js';
import {
  ChevronLeft,
  Save,
  Loader2,
  Settings,
  Palette,
  Bot,
  UserCheck,
  Clock,
  ShieldCheck,
  Globe2,
  BookOpen,
  Code2,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Copy,
  Check,
} from 'lucide-react';

const SETTINGS_TABS = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'persona', label: 'Persona & Greeting', icon: Bot },
  { id: 'leadCapture', label: 'Lead Capture', icon: UserCheck },
  { id: 'hours', label: 'Business Hours', icon: Clock },
  { id: 'domains', label: 'Allowed Domains', icon: ShieldCheck },
  { id: 'languages', label: 'Languages', icon: Globe2 },
  { id: 'playbooks', label: 'Objection Playbooks', icon: BookOpen },
  { id: 'embed', label: 'Embed Snippet', icon: Code2 },
  { id: 'danger', label: 'Danger Zone', icon: AlertTriangle },
] as const;

type SettingsTab = (typeof SETTINGS_TABS)[number]['id'];

export const ChatbotSettingsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: bot, isLoading, error } = useChatbot(id);
  const updateMutation = useUpdateChatbot();
  const rotateKeyMutation = useRotateKey();
  const deleteMutation = useDeleteChatbot();

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [name, setName] = useState('');
  const [type, setType] = useState<ChatbotType>('web');
  const [status, setStatus] = useState<ChatbotStatus>('draft');
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [config, setConfig] = useState<ChatbotConfig>({} as ChatbotConfig);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  useEffect(() => {
    if (bot) {
      setName(bot.name);
      setType(bot.type);
      setStatus(bot.status);
      setAllowedDomains(bot.allowedDomains || []);
      setConfig(bot.config);
    }
  }, [bot]);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !bot) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
        <h2 className="text-lg font-bold">Chatbot not found</h2>
        <p className="text-xs mt-1">
          This assistant may have been deleted or belongs to another company.
        </p>
        <button
          type="button"
          onClick={() => navigate('/chatbots')}
          className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white"
        >
          Return to Chatbots
        </button>
      </div>
    );
  }

  const handleSave = async () => {
    if (!id) return;
    try {
      await updateMutation.mutateAsync({
        id,
        input: {
          name,
          type,
          status,
          allowedDomains,
          config,
        },
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      // Error handled by TanStack
    }
  };

  const handleRotateKey = async () => {
    if (confirm('Rotate this public key? All current embeds will need updating.')) {
      await rotateKeyMutation.mutateAsync(id!);
    }
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to permanently delete this chatbot?')) {
      await deleteMutation.mutateAsync(id!);
      navigate('/chatbots');
    }
  };

  const embedScript = `<!-- PropBot Pro AI Real Estate Widget -->
<script
  src="https://cdn.propbotpro.com/widget.js"
  data-propbot-key="${bot.publicKey}"
  async
></script>`;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
        <div>
          <button
            type="button"
            onClick={() => navigate('/chatbots')}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors mb-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Chatbots List
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {bot.name}
            </h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${
                status === 'active'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
              }`}
            >
              {status}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
              <Check className="h-4 w-4" /> Saved!
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-all"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </button>
        </div>
      </div>

      {/* Main Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Navigation Tabs (2 cols on xl, 3 on lg) */}
        <div className="lg:col-span-3 xl:col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-xs space-y-1">
          {SETTINGS_TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-[var(--accent)] text-white shadow-xs'
                    : 'text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]'
                } ${tab.id === 'danger' ? 'text-rose-600 hover:bg-rose-500/10' : ''}`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-white' : ''}`} />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Center Tab Form (5 cols) */}
        <div className="lg:col-span-4 xl:col-span-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xs min-h-[560px]">
          {/* TAB 1: GENERAL */}
          {activeTab === 'general' && (
            <div className="space-y-5">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                General Information
              </h3>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Chatbot Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Internal Description
                </label>
                <textarea
                  rows={3}
                  value={config.description || ''}
                  onChange={e => setConfig({ ...config, description: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Deployment Status
                </label>
                <div className="flex gap-3">
                  {(['active', 'paused', 'draft'] as const).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={`flex-1 py-2 rounded-xl border-2 text-xs font-bold uppercase transition-all ${
                        status === s
                          ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-800'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: APPEARANCE */}
          {activeTab === 'appearance' && (
            <Step2Appearance config={config} onChangeConfig={setConfig} />
          )}

          {/* TAB 3: PERSONA & GREETING */}
          {activeTab === 'persona' && (
            <div className="space-y-6">
              {id && <AgentPicker chatbotId={id} agentId={bot?.agentId} />}
              <Step3Greeting config={config} onChangeConfig={setConfig} />
              <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
                <Step4Persona config={config} onChangeConfig={setConfig} />
              </div>
            </div>
          )}

          {/* TAB 4: LEAD CAPTURE */}
          {activeTab === 'leadCapture' && (
            <Step5LeadCapture config={config} onChangeConfig={setConfig} />
          )}

          {/* TAB 5: BUSINESS HOURS */}
          {activeTab === 'hours' && (
            <Step6BusinessHours config={config} onChangeConfig={setConfig} />
          )}

          {/* TAB 6: ALLOWED DOMAINS */}
          {activeTab === 'domains' && (
            <Step7AllowedDomains
              allowedDomains={allowedDomains}
              onChangeAllowedDomains={setAllowedDomains}
              config={config}
              onChangeConfig={setConfig}
            />
          )}

          {/* TAB 7: LANGUAGES */}
          {activeTab === 'languages' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Multilingual AI Capabilities
              </h3>
              <p className="text-xs text-slate-500">
                Your chatbot automatically detects the visitor&apos;s language and responds natively with verbatim RERA IDs and pricing units.
              </p>
              <div className="rounded-xl border border-slate-200 p-4 space-y-3 text-xs dark:border-slate-800">
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                  Supported Real Estate Languages (Auto-Detected):
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { code: 'EN', name: 'English' },
                    { code: 'HI', name: 'Hindi (हिंदी)' },
                    { code: 'HI-LATN', name: 'Hinglish (Hindi in Latin)' },
                    { code: 'MR', name: 'Marathi (मराठी)' },
                    { code: 'TA', name: 'Tamil (தமிழ்)' },
                    { code: 'TE', name: 'Telugu (తెలుగు)' },
                    { code: 'KN', name: 'Kannada (ಕನ್ನಡ)' },
                    { code: 'BN', name: 'Bengali (বাংলা)' },
                    { code: 'GU', name: 'Gujarati (ગુજરાતી)' },
                    { code: 'AR', name: 'Arabic (العربية)' },
                  ].map(l => (
                    <div
                      key={l.code}
                      className="rounded-lg bg-blue-50/70 border border-blue-100 p-2 text-xs font-semibold text-blue-800 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-300 flex items-center justify-between"
                    >
                      <span>{l.name}</span>
                      <span className="text-[10px] text-blue-500 uppercase">{l.code}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: OBJECTION PLAYBOOKS */}
          {activeTab === 'playbooks' && bot && (
            <ObjectionPlaybooksTab chatbotId={bot.id} />
          )}

          {/* TAB 9: EMBED SNIPPET */}
          {activeTab === 'embed' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Embed Snippet & Integration
              </h3>
              <div className="rounded-xl bg-slate-950 p-3.5 font-mono text-xs text-slate-300 overflow-x-auto border border-slate-800">
                <pre>{embedScript}</pre>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(embedScript);
                  setCopiedSnippet(true);
                  setTimeout(() => setCopiedSnippet(false), 2000);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                {copiedSnippet ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiedSnippet ? 'Copied to Clipboard' : 'Copy Embed Snippet'}
              </button>
            </div>
          )}

          {/* TAB 9: DANGER ZONE */}
          {activeTab === 'danger' && (
            <div className="space-y-5">
              <h3 className="text-base font-bold text-rose-600 dark:text-rose-400">Danger Zone</h3>

              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                <h4 className="font-bold text-xs text-amber-900 dark:text-amber-200">
                  Rotate Public Key
                </h4>
                <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
                  Generates a new public token. Existing embeds using the old key will stop working.
                </p>
                <button
                  type="button"
                  onClick={handleRotateKey}
                  className="mt-3 flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 dark:bg-slate-900 dark:text-amber-300"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Rotate Key Now
                </button>
              </div>

              <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 dark:border-rose-900/40 dark:bg-rose-950/20">
                <h4 className="font-bold text-xs text-rose-900 dark:text-rose-200">
                  Delete This Chatbot
                </h4>
                <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-1">
                  Soft-deletes the assistant. Past conversations and qualified leads remain safe in
                  your CRM.
                </p>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="mt-3 flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Chatbot
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Sticky Preview (5 cols on lg & xl) */}
        <div className="lg:col-span-5 xl:col-span-5 sticky top-16 h-[660px] min-h-[580px]">
          <LiveWidgetPreview name={name} type={type} config={config} />
        </div>
      </div>
    </div>
  );
};
