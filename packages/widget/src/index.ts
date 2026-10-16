import { createShadowContainer } from './shadow-dom.js';
import { sanitizeHtml } from './sanitizer.js';
import { ChatWidgetUi } from './ui.js';

export interface PropBotConfig {
  publicKey: string;
  apiUrl?: string;
  theme?: string;
  botName?: string;
  primaryColor?: string;
  greetingMessage?: string;
  quickQuestions?: string[];
  themeMode?: 'light' | 'dark';
}

export interface PropBotApi {
  open: () => void;
  close: () => void;
  identify: (data: { name?: string; phone?: string; email?: string }) => void;
  track: (event: string, payload?: Record<string, unknown>) => void;
  setContext: (context: Record<string, unknown>) => void;
  init: (config: PropBotConfig) => void;
}

declare global {
  interface Window {
    PropBot?: PropBotApi;
  }
}

class PropBotWidgetInstance implements PropBotApi {
  private config: PropBotConfig | null = null;
  private ui: ChatWidgetUi | null = null;
  private isOpen = false;

  init(config: PropBotConfig): void {
    this.config = config;
    if (typeof document !== 'undefined') {
      const { shadowRoot } = createShadowContainer();
      const placeholder = document.createElement('div');
      placeholder.setAttribute('data-propbot-ready', 'true');
      shadowRoot.appendChild(placeholder);

      const apiUrl = config.apiUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

      this.ui = new ChatWidgetUi(shadowRoot, {
        publicKey: config.publicKey,
        apiUrl,
        botName: config.botName || 'Property Advisor AI',
        primaryColor: config.primaryColor || '#3b82f6',
        greetingMessage: config.greetingMessage || 'Hello! Welcome to our property portal. How can I assist you today?',
        quickQuestions: config.quickQuestions || [
          'What apartments/villas are available?',
          'What is the starting price range?',
          'Can I schedule a site visit?',
        ],
        themeMode: config.themeMode || 'dark',
      });
    }
  }

  open(): void {
    this.isOpen = true;
    if (this.ui) {
      this.ui.open();
    }
  }

  close(): void {
    this.isOpen = false;
    if (this.ui) {
      this.ui.close();
    }
  }

  identify(_data: { name?: string; phone?: string; email?: string }): void {
    // Visitor identity tracking
  }

  track(_event: string, _payload?: Record<string, unknown>): void {
    // Analytics telemetry tracking
  }

  setContext(_context: Record<string, unknown>): void {
    // Property or inventory page context
  }

  get state() {
    return {
      isOpen: this.isOpen,
      isConfigured: this.config !== null,
    };
  }
}

export const widget = new PropBotWidgetInstance();

if (typeof window !== 'undefined') {
  window.PropBot = widget;

  // Auto-init if script tag has data-public-key
  if (typeof document !== 'undefined') {
    const currentScript = document.currentScript as HTMLScriptElement | null;
    const scriptPublicKey = currentScript?.getAttribute('data-public-key');
    if (scriptPublicKey) {
      widget.init({ publicKey: scriptPublicKey });
    }
  }
}

export { createShadowContainer, sanitizeHtml, ChatWidgetUi };
