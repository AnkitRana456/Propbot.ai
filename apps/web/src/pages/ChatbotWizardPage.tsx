import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { ChatbotConfig, ChatbotType, ChatbotStatus } from '@propbot/shared';
import { useCreateChatbot, useUpdateChatbot, useChatbot } from '../services/chatbots.service.js';
import { LiveWidgetPreview } from '../components/chatbots/LiveWidgetPreview.js';
import { Step1Identity } from '../components/chatbots/wizard/Step1Identity.js';
import { Step2Appearance } from '../components/chatbots/wizard/Step2Appearance.js';
import { Step3Greeting } from '../components/chatbots/wizard/Step3Greeting.js';
import { Step4Persona } from '../components/chatbots/wizard/Step4Persona.js';
import { Step5LeadCapture } from '../components/chatbots/wizard/Step5LeadCapture.js';
import { Step6BusinessHours } from '../components/chatbots/wizard/Step6BusinessHours.js';
import { Step7AllowedDomains } from '../components/chatbots/wizard/Step7AllowedDomains.js';
import { Step8ReviewPublish } from '../components/chatbots/wizard/Step8ReviewPublish.js';
import {
  Sparkles,
  Palette,
  MessageSquareText,
  Bot,
  UserCheck,
  Clock,
  ShieldCheck,
  Rocket,
  ChevronLeft,
  ChevronRight,
  Save,
  Check,
  Loader2,
} from 'lucide-react';

const WIZARD_STEPS = [
  { step: 1, title: 'Identity', desc: 'Name & platform', icon: Sparkles },
  { step: 2, title: 'Appearance', desc: 'Colors & branding', icon: Palette },
  { step: 3, title: 'Greeting', desc: 'Welcome & prompts', icon: MessageSquareText },
  { step: 4, title: 'Persona', desc: 'Tone & language', icon: Bot },
  { step: 5, title: 'Lead Capture', desc: 'Qualification rules', icon: UserCheck },
  { step: 6, title: 'Hours', desc: 'Office schedule', icon: Clock },
  { step: 7, title: 'Domains', desc: 'Whitelist & files', icon: ShieldCheck },
  { step: 8, title: 'Launch', desc: 'Review & deploy', icon: Rocket },
];

const DEFAULT_CONFIG: ChatbotConfig = {
  description: '',
  appearance: {
    primaryColor: '#059669',
    textColor: '#ffffff',
    backgroundColor: '#ffffff',
    headerColor: '#0f172a',
    borderRadius: 16,
    position: 'bottom-right',
    botName: 'Property Advisor AI',
    botAvatarUrl: '',
    companyLogoUrl: '',
    themeMode: 'light',
  },
  behavior: {
    systemPrompt:
      'You are a professional real estate assistant helping visitors explore properties, schedule visits, and answer pricing inquiries.',
    tone: 'luxury',
    defaultLanguage: 'en',
    supportedLanguages: ['en', 'es', 'fr', 'hi', 'ar'],
    temperature: 0.7,
    greetingMessage:
      'Hello! Welcome to our luxury real estate showcase. How can I help you find your dream property today?',
    quickQuestions: [
      'Explore featured villas',
      'Schedule a private site visit',
      'Download pricing & brochure',
      'Check payment plan options',
    ],
    translatableStrings: {},
  },
  leadCapture: {
    enabled: true,
    requireEmail: false,
    requireLeadCapture: false,
    alertEmails: [],
    otpSettings: { enabled: false, expiryMinutes: 10, maxAttempts: 5, resendCooldownSeconds: 30 },
    triggerAfterMessages: 2,
    title: 'Connect with a Property Consultant',
    subtitle:
      'Share your contact info to receive detailed floor plans and private viewing appointments.',
    fields: [
      { id: 'f1', name: 'fullName', label: 'Full Name', type: 'text', required: true },
      { id: 'f2', name: 'email', label: 'Email Address', type: 'email', required: false },
      { id: 'f3', name: 'phone', label: 'Phone Number', type: 'phone', required: true },
    ],
  },
  tracking: {
    gtmEnabled: true,
    googleAds: { conversionId: '', conversionLabel: '', currency: 'INR', value: 1 },
    metaPixelId: '',
    taboolaEnabled: false,
    customScript: '',
  },
  businessHours: {
    enabled: false,
    timezone: 'Asia/Kolkata',
    schedule: [
      { day: 'mon', enabled: true, start: '09:00', end: '19:00' },
      { day: 'tue', enabled: true, start: '09:00', end: '19:00' },
      { day: 'wed', enabled: true, start: '09:00', end: '19:00' },
      { day: 'thu', enabled: true, start: '09:00', end: '19:00' },
      { day: 'fri', enabled: true, start: '09:00', end: '19:00' },
      { day: 'sat', enabled: true, start: '10:00', end: '17:00' },
      { day: 'sun', enabled: false, start: '10:00', end: '17:00' },
    ],
    offlineMessage:
      'Our sales office is currently closed. Leave your contact info and our property advisor will connect with you first thing tomorrow!',
    fallbackEmail: '',
    fallbackPhone: '',
  },
  brochures: [],
  wizardDraft: {
    currentStep: 1,
    isCompleted: false,
  },
};

export const ChatbotWizardPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEditing = Boolean(id);

  const { data: existingBot, isLoading: isFetchingBot } = useChatbot(id);
  const createMutation = useCreateChatbot();
  const updateMutation = useUpdateChatbot();

  const [currentStep, setCurrentStep] = useState(1);
  const [name, setName] = useState('New Property Assistant');
  const [type, setType] = useState<ChatbotType>('web');
  const [status, setStatus] = useState<ChatbotStatus>('draft');
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [config, setConfig] = useState<ChatbotConfig>(DEFAULT_CONFIG);
  const [saveStatus, setSaveStatus] = useState<string>('All changes saved locally');

  // Load existing data if editing or resume from localStorage draft
  useEffect(() => {
    if (existingBot) {
      setName(existingBot.name);
      setType(existingBot.type);
      setStatus(existingBot.status);
      setAllowedDomains(existingBot.allowedDomains || []);
      setConfig(existingBot.config);
      if (existingBot.config.wizardDraft?.currentStep) {
        setCurrentStep(existingBot.config.wizardDraft.currentStep);
      }
    } else if (!isEditing) {
      const savedDraft = localStorage.getItem('propbot_wizard_draft');
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          if (parsed.name) setName(parsed.name);
          if (parsed.type) setType(parsed.type);
          if (parsed.status) setStatus(parsed.status);
          if (parsed.allowedDomains) setAllowedDomains(parsed.allowedDomains);
          if (parsed.config) setConfig(parsed.config);
          if (parsed.step) setCurrentStep(parsed.step);
        } catch {
          // ignore corrupted draft
        }
      }
    }
  }, [existingBot, isEditing]);

  // Autosave to localStorage on changes
  useEffect(() => {
    if (!isEditing) {
      const draftPayload = {
        name,
        type,
        status,
        allowedDomains,
        config: {
          ...config,
          wizardDraft: { currentStep, isCompleted: false },
        },
        step: currentStep,
      };
      localStorage.setItem('propbot_wizard_draft', JSON.stringify(draftPayload));
      setSaveStatus('Autosaved to browser storage');
    }
  }, [name, type, status, allowedDomains, config, currentStep, isEditing]);

  const handleNext = () => {
    if (currentStep < 8) {
      setCurrentStep(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSaveDraft = async () => {
    setSaveStatus('Saving draft to server...');
    const payloadConfig: ChatbotConfig = {
      ...config,
      wizardDraft: {
        currentStep,
        isCompleted: false,
      },
    };

    try {
      if (isEditing && id) {
        await updateMutation.mutateAsync({
          id,
          input: {
            name,
            type,
            status: 'draft',
            allowedDomains,
            config: payloadConfig,
          },
        });
      } else {
        await createMutation.mutateAsync({
          name,
          type,
          status: 'draft',
          allowedDomains,
          config: payloadConfig,
        });
        localStorage.removeItem('propbot_wizard_draft');
      }
      setSaveStatus('Draft saved to server successfully!');
      setTimeout(() => setSaveStatus('All changes saved'), 3000);
    } catch {
      setSaveStatus('Error saving draft to server');
    }
  };

  const handlePublish = async () => {
    setSaveStatus('Publishing chatbot...');
    const payloadConfig: ChatbotConfig = {
      ...config,
      wizardDraft: {
        currentStep: 8,
        isCompleted: true,
      },
    };

    try {
      if (isEditing && id) {
        await updateMutation.mutateAsync({
          id,
          input: {
            name,
            type,
            status,
            allowedDomains,
            config: payloadConfig,
          },
        });
      } else {
        await createMutation.mutateAsync({
          name,
          type,
          status,
          allowedDomains,
          config: payloadConfig,
        });
        localStorage.removeItem('propbot_wizard_draft');
      }
      navigate('/chatbots');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setSaveStatus(`Failed to publish: ${msg}`);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (isFetchingBot) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

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
              {isEditing ? `Edit Chatbot: ${name}` : 'Create Real Estate Chatbot'}
            </h1>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              8-Step Wizard
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-medium hidden sm:inline-block">
            {saveStatus}
          </span>
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-all shadow-xs"
          >
            <Save className="h-4 w-4" />
            Save Draft
          </button>
        </div>
      </div>

      {/* Stepper Progress Bar */}
      <div className="overflow-x-auto pb-2">
        <div className="flex items-center gap-2 min-w-[760px]">
          {WIZARD_STEPS.map((s, idx) => {
            const Icon = s.icon;
            const isCurrent = currentStep === s.step;
            const isCompleted = currentStep > s.step;

            return (
              <React.Fragment key={s.step}>
                <button
                  type="button"
                  onClick={() => setCurrentStep(s.step)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all ${
                    isCurrent
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : isCompleted
                        ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 hover:bg-blue-100'
                        : 'bg-white text-slate-600 dark:bg-slate-800/80 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  } border border-slate-200/80 dark:border-slate-700/80`}
                >
                  <div
                    className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      isCurrent
                        ? 'bg-white text-blue-600'
                        : isCompleted
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {isCompleted ? <Check className="h-3.5 w-3.5" /> : s.step}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold leading-tight flex items-center gap-1">
                      <Icon className="h-3 w-3" />
                      {s.title}
                    </span>
                    <span
                      className={`text-[10px] leading-tight ${
                        isCurrent ? 'text-blue-100' : 'text-slate-400'
                      }`}
                    >
                      {s.desc}
                    </span>
                  </div>
                </button>
                {idx < WIZARD_STEPS.length - 1 && (
                  <div className="h-0.5 w-4 bg-slate-200 dark:bg-slate-800 shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Main Split-Screen Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Form Column (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-sm flex flex-col justify-between min-h-[580px]">
          <div>
            {currentStep === 1 && (
              <Step1Identity
                name={name}
                onChangeName={setName}
                type={type}
                onChangeType={setType}
                config={config}
                onChangeConfig={setConfig}
              />
            )}
            {currentStep === 2 && <Step2Appearance config={config} onChangeConfig={setConfig} />}
            {currentStep === 3 && <Step3Greeting config={config} onChangeConfig={setConfig} />}
            {currentStep === 4 && <Step4Persona config={config} onChangeConfig={setConfig} />}
            {currentStep === 5 && <Step5LeadCapture config={config} onChangeConfig={setConfig} />}
            {currentStep === 6 && <Step6BusinessHours config={config} onChangeConfig={setConfig} />}
            {currentStep === 7 && (
              <Step7AllowedDomains
                allowedDomains={allowedDomains}
                onChangeAllowedDomains={setAllowedDomains}
                config={config}
                onChangeConfig={setConfig}
              />
            )}
            {currentStep === 8 && (
              <Step8ReviewPublish
                name={name}
                type={type}
                status={status}
                onChangeStatus={setStatus}
                allowedDomains={allowedDomains}
                config={config}
                publicKey={existingBot?.publicKey}
              />
            )}
          </div>

          {/* Stepper Navigation Footer */}
          <div className="flex items-center justify-between border-t border-slate-200 pt-5 dark:border-slate-800 mt-8">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentStep === 1}
              className={`flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300 transition-all ${
                currentStep === 1
                  ? 'opacity-40 cursor-not-allowed'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous Step
            </button>

            <div className="flex items-center gap-3">
              {currentStep < 8 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-all"
                >
                  Next Step
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={isSaving}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-700 transition-all"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Rocket className="h-4 w-4" />
                  )}
                  {isEditing ? 'Save Changes' : 'Publish Chatbot'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Sticky Preview Column (5 cols) */}
        <div className="lg:col-span-5 sticky top-20 h-[640px]">
          <LiveWidgetPreview name={name} type={type} config={config} />
        </div>
      </div>
    </div>
  );
};
