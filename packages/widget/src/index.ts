import { createShadowContainer } from './shadow-dom.js';
import { sanitizeHtml } from './sanitizer.js';

export interface PropBotConfig {
  publicKey: string;
  apiUrl?: string;
  theme?: string;
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
  private isOpen = false;

  init(config: PropBotConfig): void {
    this.config = config;
    if (typeof document !== 'undefined') {
      const { shadowRoot } = createShadowContainer();
      const placeholder = document.createElement('div');
      placeholder.setAttribute('data-propbot-ready', 'true');
      shadowRoot.appendChild(placeholder);
    }
  }

  open(): void {
    this.isOpen = true;
  }

  close(): void {
    this.isOpen = false;
  }

  identify(_data: { name?: string; phone?: string; email?: string }): void {
    // Lead identity will be piped to visitor timeline in Phase 4
  }

  track(_event: string, _payload?: Record<string, unknown>): void {
    // Visitor activity events will be piped in Phase 4
  }

  setContext(_context: Record<string, unknown>): void {
    // Project context will be piped in Phase 4
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
}

export { createShadowContainer, sanitizeHtml };
