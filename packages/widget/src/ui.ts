import { sanitizeHtml } from './sanitizer.js';
import { validatePhone } from '@propbot/shared/phone';
import { captureUtmParams } from './utm.js';
import { renderMediaItems, MEDIA_STYLES } from './media.js';
import { fireLeadConversion, LEAD_FORM_BODY_SELECTOR, type WidgetTrackingConfig } from './tracking.js';

export interface WidgetUiConfig {
  publicKey: string;
  apiUrl: string;
  botName: string;
  primaryColor: string;
  greetingMessage: string;
  quickQuestions: string[];
  themeMode?: 'light' | 'dark';
}

export class ChatWidgetUi {
  private shadow: ShadowRoot;
  private config: WidgetUiConfig;
  private sessionToken: string | null = null;
  private conversationId: string | null = null;
  private tracking: WidgetTrackingConfig | undefined;
  private chatbotId: string | undefined;
  private isOpen = false;
  private isAiOffline = false;
  private activeLanguage: 'en' | 'hi' | 'hinglish' = 'en';
  private leadCaptured = false;
  private leadFormShown = false;
  private visitorMessageCount = 0;

  private isRecording = false;
  private isSpeaking = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private recognition: any = null;
  private micBtn!: HTMLButtonElement;

  private containerEl!: HTMLElement;
  private launcherContainerEl!: HTMLElement;
  private launcherBtn!: HTMLButtonElement;
  private proactiveBubbleEl!: HTMLElement;
  private chatBoxEl!: HTMLElement;
  private messagesListEl!: HTMLElement;
  private inputEl!: HTMLInputElement;
  private sendBtn!: HTMLButtonElement;

  constructor(shadow: ShadowRoot, config: WidgetUiConfig) {
    this.shadow = shadow;
    this.config = config;
    this.render();
  }

  private getStyles(): string {
    const isDark = this.config.themeMode !== 'light';
    const bgApp = isDark ? '#070F1E' : '#FFFFFF';
    const bgCard = isDark ? '#0B1B3A' : '#FAF8F5';
    const bgSubtle = isDark ? '#102246' : '#F1F5F9';
    const textMain = isDark ? '#F8FAFC' : '#0B1B3A';
    const textMuted = isDark ? '#94A3B8' : '#64748B';
    const borderCol = isDark ? '#182F5D' : '#E2E8F0';
    const primary = this.config.primaryColor || '#2563EB';

    return `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", "Segoe UI", Roboto, sans-serif;
      }
      .propbot-root {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 2147483647;
      }
      /* Proactive speech bubble */
      .propbot-launcher-wrap {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 10px;
      }
      .propbot-bubble {
        background: ${bgCard};
        border: 1px solid ${borderCol};
        color: ${textMain};
        padding: 10px 14px;
        border-radius: 16px;
        border-bottom-right-radius: 4px;
        font-size: 13px;
        font-weight: 600;
        box-shadow: 0 4px 20px rgba(11, 27, 58, 0.15);
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        animation: propbot-float 3s ease-in-out infinite alternate;
        max-width: 260px;
        transition: opacity 0.2s, transform 0.2s;
      }
      .propbot-bubble:hover {
        transform: translateY(-2px);
      }
      .propbot-bubble-close {
        background: none;
        border: none;
        color: ${textMuted};
        cursor: pointer;
        font-size: 16px;
        padding: 2px;
        line-height: 1;
      }
      @keyframes propbot-float {
        0% { transform: translateY(0); }
        100% { transform: translateY(-4px); }
      }

      /* Launcher button with pulse ring */
      .propbot-launcher {
        position: relative;
        width: 62px;
        height: 62px;
        border-radius: 50%;
        background: linear-gradient(135deg, ${primary}, #1D4ED8);
        color: white;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 8px 24px rgba(37, 99, 235, 0.35);
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s;
      }
      .propbot-launcher:hover {
        transform: scale(1.06);
        box-shadow: 0 10px 28px rgba(37, 99, 235, 0.45);
      }
      .propbot-launcher svg {
        width: 30px;
        height: 30px;
        fill: currentColor;
      }
      .propbot-online-badge {
        position: absolute;
        top: 2px;
        right: 2px;
        width: 14px;
        height: 14px;
        background: #14B8A6;
        border: 2px solid ${bgApp};
        border-radius: 50%;
      }

      /* Main Chatbox */
      .propbot-chatbox {
        position: fixed;
        bottom: 96px;
        right: 24px;
        width: 400px;
        height: 640px;
        max-width: calc(100vw - 32px);
        max-height: calc(100vh - 120px);
        background: ${bgApp};
        border: 1px solid ${borderCol};
        border-radius: 20px;
        display: none;
        flex-direction: column;
        overflow: hidden;
        box-shadow: 0 16px 48px rgba(11, 27, 58, 0.25);
        animation: propbot-slideup 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      }
      @keyframes propbot-slideup {
        from { opacity: 0; transform: translateY(12px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .propbot-chatbox.open {
        display: flex;
      }

      /* Header */
      .propbot-header {
        padding: 14px 18px;
        background: ${bgCard};
        border-bottom: 1px solid ${borderCol};
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .propbot-header-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .propbot-avatar {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: linear-gradient(135deg, ${primary}, #1D4ED8);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 700;
        font-size: 16px;
        box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
      }
      .propbot-title {
        font-size: 15px;
        font-weight: 700;
        color: ${textMain};
        letter-spacing: -0.01em;
      }
      .propbot-subtitle {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: ${textMuted};
        font-weight: 500;
      }
      .propbot-status-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #14B8A6;
      }
      .propbot-status-dot.offline {
        background: #F5B942;
      }
      .propbot-header-actions {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .propbot-lang-select {
        background: ${bgSubtle};
        border: 1px solid ${borderCol};
        color: ${textMain};
        font-size: 11px;
        font-weight: 600;
        border-radius: 8px;
        padding: 4px 6px;
        cursor: pointer;
        outline: none;
      }
      .propbot-close-btn {
        background: none;
        border: none;
        color: ${textMuted};
        cursor: pointer;
        padding: 6px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.15s;
      }
      .propbot-close-btn:hover {
        background: ${bgSubtle};
        color: ${textMain};
      }

      /* Messages area */
      .propbot-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      /* Welcome Action Cards Grid (v5 Requirement) */
      .propbot-welcome-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin: 8px 0;
      }
      .propbot-action-card {
        background: ${bgCard};
        border: 1px solid ${borderCol};
        border-radius: 12px;
        padding: 12px 10px;
        text-align: left;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .propbot-action-card:hover {
        border-color: ${primary};
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(11, 27, 58, 0.08);
      }
      .propbot-action-icon {
        font-size: 18px;
        line-height: 1;
      }
      .propbot-action-title {
        font-size: 12px;
        font-weight: 700;
        color: ${textMain};
      }
      .propbot-action-desc {
        font-size: 10px;
        color: ${textMuted};
        line-height: 1.3;
      }

      ${MEDIA_STYLES}

      /* Message Bubbles */
      .propbot-msg {
        max-width: 86%;
        padding: 12px 15px;
        border-radius: 14px;
        font-size: 13.5px;
        line-height: 1.5;
        word-break: break-word;
      }
      .propbot-msg.visitor {
        align-self: flex-end;
        background: linear-gradient(135deg, ${primary}, #1D4ED8);
        color: white;
        border-bottom-right-radius: 3px;
        box-shadow: 0 2px 8px rgba(37, 99, 235, 0.2);
      }
      .propbot-msg.bot {
        align-self: flex-start;
        background: ${bgCard};
        color: ${textMain};
        border: 1px solid ${borderCol};
        border-bottom-left-radius: 3px;
      }

      /* Property Carousel Card in Chat */
      .propbot-property-card {
        background: ${bgSubtle};
        border: 1px solid ${borderCol};
        border-radius: 12px;
        overflow: hidden;
        margin-top: 8px;
        display: flex;
        flex-direction: column;
      }
      .propbot-property-img {
        height: 110px;
        background: linear-gradient(135deg, #102246, #0B1B3A);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #94A3B8;
        font-size: 11px;
        font-weight: 600;
      }
      .propbot-property-body {
        padding: 10px 12px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .propbot-property-title {
        font-size: 13px;
        font-weight: 700;
        color: ${textMain};
      }
      .propbot-property-meta {
        font-size: 11px;
        color: ${textMuted};
        display: flex;
        gap: 8px;
      }
      .propbot-property-price {
        font-size: 14px;
        font-weight: 800;
        color: ${primary};
      }
      .propbot-property-actions {
        display: flex;
        gap: 6px;
        margin-top: 6px;
      }
      .propbot-btn-mini {
        flex: 1;
        padding: 6px;
        border-radius: 8px;
        font-size: 11px;
        font-weight: 700;
        border: none;
        cursor: pointer;
        text-align: center;
      }
      .propbot-btn-mini.primary {
        background: ${primary};
        color: white;
      }
      .propbot-btn-mini.secondary {
        background: ${bgCard};
        border: 1px solid ${borderCol};
        color: ${textMain};
      }

      /* Quick replies */
      .propbot-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 6px;
      }
      .propbot-pill {
        background: ${bgCard};
        border: 1px solid ${borderCol};
        color: ${primary};
        border-radius: 20px;
        padding: 6px 12px;
        font-size: 11.5px;
        font-weight: 600;
        cursor: pointer;
        text-align: left;
        transition: all 0.15s;
      }
      .propbot-pill:hover {
        border-color: ${primary};
        background: ${bgSubtle};
      }

      /* Input Footer */
      .propbot-footer {
        padding: 10px 14px;
        background: ${bgCard};
        border-top: 1px solid ${borderCol};
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .propbot-input-row {
        display: flex;
        gap: 8px;
      }
      .propbot-input {
        flex: 1;
        background: ${bgApp};
        border: 1px solid ${borderCol};
        border-radius: 12px;
        padding: 10px 14px;
        color: ${textMain};
        font-size: 13.5px;
        outline: none;
        transition: border-color 0.15s;
      }
      .propbot-input:focus {
        border-color: ${primary};
      }
      .propbot-send-btn {
        background: ${primary};
        color: white;
        border: none;
        border-radius: 12px;
        width: 42px;
        height: 42px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.15s;
      }
      .propbot-send-btn:hover {
        transform: scale(1.04);
      }

      /* Trust Row */
      .propbot-trust-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 10px;
        color: ${textMuted};
        padding: 0 4px;
      }
      .propbot-rera-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        color: #14B8A6;
        font-weight: 700;
      }

      /* Lead form banner */
      .propbot-lead-banner {
        background: ${isDark ? '#102246' : '#EFF6FF'};
        border: 1px solid ${isDark ? '#182F5D' : '#BFDBFE'};
        border-radius: 12px;
        padding: 12px;
        margin-top: 6px;
      }
      .propbot-lead-banner h4 {
        font-size: 12.5px;
        font-weight: 700;
        color: ${textMain};
        margin-bottom: 6px;
      }
      .propbot-lead-form input {
        width: 100%;
        margin-bottom: 6px;
        padding: 8px 10px;
        font-size: 12.5px;
        border-radius: 8px;
        border: 1px solid ${borderCol};
        background: ${bgApp};
        color: ${textMain};
      }
      .propbot-lead-form button {
        width: 100%;
        padding: 9px;
        background: ${primary};
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }

      /* Mic / TTS buttons */
      .propbot-mic-btn,
      .propbot-tts-btn {
        background: none;
        border: none;
        color: ${textMuted};
        cursor: pointer;
        padding: 2px 4px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        transition: color 0.15s, background 0.15s;
        margin-bottom: 6px;
        margin-left: 4px;
        vertical-align: middle;
      }
      .propbot-mic-btn:hover,
      .propbot-tts-btn:hover {
        color: ${primary};
        background: ${bgSubtle};
      }
      .propbot-mic-btn.recording {
        color: #EF4444;
        animation: propbot-pulse 0.8s ease-in-out infinite alternate;
      }
      .propbot-tts-btn.speaking {
        color: ${primary};
      }
      @keyframes propbot-pulse {
        from { opacity: 1; }
        to { opacity: 0.5; }
      }

      /* Mobile Responsive (<= 640px) */
      @media (max-width: 640px) {
        .propbot-chatbox {
          bottom: 0;
          right: 0;
          width: 100vw;
          height: 100vh;
          max-width: 100vw;
          max-height: 100vh;
          border-radius: 0;
          border: none;
        }
        .propbot-root {
          bottom: 16px;
          right: 16px;
        }
      }
    `;
  }

  private render(): void {
    const styleEl = document.createElement('style');
    styleEl.textContent = this.getStyles();
    this.shadow.appendChild(styleEl);

    this.containerEl = document.createElement('div');
    this.containerEl.className = 'propbot-root';

    // Launcher wrap with proactive bubble
    this.launcherContainerEl = document.createElement('div');
    this.launcherContainerEl.className = 'propbot-launcher-wrap';

    this.proactiveBubbleEl = document.createElement('div');
    this.proactiveBubbleEl.className = 'propbot-bubble';
    this.proactiveBubbleEl.innerHTML = `
      <span>Looking for a home? Ask me anything</span>
      <button class="propbot-bubble-close" aria-label="Dismiss">&times;</button>
    `;
    this.proactiveBubbleEl.onclick = (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('propbot-bubble-close')) {
        this.proactiveBubbleEl.style.display = 'none';
        e.stopPropagation();
      } else {
        this.open();
      }
    };

    // Launcher button
    this.launcherBtn = document.createElement('button');
    this.launcherBtn.className = 'propbot-launcher';
    this.launcherBtn.setAttribute('aria-label', 'Open Aurora property assistant');
    this.launcherBtn.innerHTML = `
      <span class="propbot-online-badge"></span>
      <svg viewBox="0 0 24 24">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
      </svg>
    `;
    this.launcherBtn.onclick = () => this.toggle();

    this.launcherContainerEl.appendChild(this.proactiveBubbleEl);
    this.launcherContainerEl.appendChild(this.launcherBtn);

    // Chatbox
    this.chatBoxEl = document.createElement('div');
    this.chatBoxEl.className = 'propbot-chatbox';

    const initial = (this.config.botName || 'P')[0]?.toUpperCase();
    this.chatBoxEl.innerHTML = `
      <div class="propbot-header">
        <div class="propbot-header-left">
          <div class="propbot-avatar">${initial}</div>
          <div>
            <div class="propbot-title">${this.config.botName}</div>
            <div class="propbot-subtitle">
              <span class="propbot-status-dot" id="status-dot"></span>
              <span id="status-text">Replies instantly</span>
            </div>
          </div>
        </div>
        <div class="propbot-header-actions">
          <select class="propbot-lang-select" id="lang-select" aria-label="Select Language">
            <option value="en">EN</option>
            <option value="hi">हिंदी</option>
            <option value="hinglish">Hinglish</option>
          </select>
          <button class="propbot-close-btn" aria-label="Minimize chat">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="propbot-messages" id="propbot-msgs"></div>

      <div class="propbot-footer">
        <div class="propbot-input-row">
          <button class="propbot-mic-btn" id="propbot-mic-btn" aria-label="Speak message" title="Click to speak">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          </button>
          <input class="propbot-input" placeholder="Ask about 2BHK/3BHK, pricing, site visits..." />
          <button class="propbot-send-btn" aria-label="Send message">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
        <div class="propbot-trust-row">
          <span class="propbot-rera-badge">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
            </svg>
            RERA Verified Data
          </span>
          <span>Powered by PropBot Pro</span>
        </div>
      </div>
    `;

    this.containerEl.appendChild(this.chatBoxEl);
    this.containerEl.appendChild(this.launcherContainerEl);
    this.shadow.appendChild(this.containerEl);

    // Event bindings
    const closeBtn = this.chatBoxEl.querySelector('.propbot-close-btn') as HTMLButtonElement;
    closeBtn.onclick = () => this.close();

    const langSelect = this.chatBoxEl.querySelector('#lang-select') as HTMLSelectElement;
    langSelect.onchange = (e) => {
      this.activeLanguage = (e.target as HTMLSelectElement).value as 'en' | 'hi' | 'hinglish';
    };

    this.messagesListEl = this.chatBoxEl.querySelector('#propbot-msgs') as HTMLElement;
    this.inputEl = this.chatBoxEl.querySelector('.propbot-input') as HTMLInputElement;
    this.sendBtn = this.chatBoxEl.querySelector('.propbot-send-btn') as HTMLButtonElement;

    this.sendBtn.onclick = () => this.handleSend();
    this.inputEl.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    };

    this.micBtn = this.chatBoxEl.querySelector('#propbot-mic-btn') as HTMLButtonElement;
    this.micBtn.onclick = () => this.toggleMic();
  }

  private toggleMic(): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SpeechRecognitionApi = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (!SpeechRecognitionApi) {
      alert('Voice input is not supported in this browser. Please use Chrome.');
      return;
    }

    if (this.isRecording) {
      this.recognition?.stop();
      return;
    }

    this.recognition = new SpeechRecognitionApi();
    this.recognition.lang = this.activeLanguage === 'hi' ? 'hi-IN' : 'en-IN';
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.isRecording = true;
      this.micBtn.classList.add('recording');
      this.micBtn.title = 'Recording... click to stop';
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.recognition.onresult = (event: any) => {
      const transcript = (event.results[0][0] as { transcript: string }).transcript;
      this.inputEl.value = transcript;
      this.handleSend();
    };

    this.recognition.onerror = () => {
      this.isRecording = false;
      this.micBtn.classList.remove('recording');
    };

    this.recognition.onend = () => {
      this.isRecording = false;
      this.micBtn.classList.remove('recording');
      this.micBtn.title = 'Click to speak';
    };

    this.recognition.start();
  }

  private speakText(text: string): void {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/<[^>]+>/g, '').trim();
    if (!clean) return;
    const utt = new SpeechSynthesisUtterance(clean);
    utt.lang = this.activeLanguage === 'hi' ? 'hi-IN' : 'en-IN';
    utt.rate = 1;
    utt.pitch = 1;
    utt.onstart = () => { this.isSpeaking = true; };
    utt.onend = () => { this.isSpeaking = false; };
    window.speechSynthesis.speak(utt);
  }

  async initSession(): Promise<void> {
    if (this.sessionToken) return;

    try {
      const res = await fetch(`${this.config.apiUrl}/public/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicKey: this.config.publicKey,
          pageUrl: window.location.href,
          referrer: document.referrer,
          utmParams: captureUtmParams(),
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to initialize session: HTTP ${res.status}`);
      }

      const data = await res.json();
      this.sessionToken = data.data.sessionToken;
      this.conversationId = data.data.conversationId;
      this.tracking = data.data.config?.tracking as WidgetTrackingConfig | undefined;
      this.chatbotId = data.data.chatbotId as string | undefined;

      // 1. Initial Greeting
      this.addBotMessage(this.config.greetingMessage);

      // 2. Render 4 Action Cards (v5 R2.2 requirement)
      this.renderWelcomeActionCards();

      // 3. Render Quick Question Pills
      if (this.config.quickQuestions && this.config.quickQuestions.length > 0) {
        const pillsContainer = document.createElement('div');
        pillsContainer.className = 'propbot-pills';
        for (const q of this.config.quickQuestions) {
          const pill = document.createElement('button');
          pill.className = 'propbot-pill';
          pill.textContent = q;
          pill.onclick = () => {
            this.inputEl.value = q;
            this.handleSend();
          };
          pillsContainer.appendChild(pill);
        }
        this.messagesListEl.appendChild(pillsContainer);
      }
    } catch (err) {
      console.warn('PropBot session initialization failed:', err);
      this.addBotMessage(this.config.greetingMessage);
      this.renderWelcomeActionCards();
    }
  }

  private renderWelcomeActionCards(): void {
    const wrap = document.createElement('div');
    wrap.className = 'propbot-welcome-actions';

    const cards = [
      {
        icon: '🏡',
        title: 'Find My Home',
        desc: 'Explore 2BHK, 3BHK & Villas',
        prompt: 'Show me available 2BHK and 3BHK residences with price and carpet area.',
      },
      {
        icon: '📅',
        title: 'Book Site Visit',
        desc: 'Pick weekend slots with pickup',
        prompt: 'I want to schedule a site visit this Saturday. What slots are available?',
      },
      {
        icon: '📄',
        title: 'Get Brochure',
        desc: 'Official master plan & specs',
        prompt: 'Please send me the master floor plans and project brochure.',
      },
      {
        icon: '📞',
        title: 'Talk to Advisor',
        desc: 'Request an instant callback',
        prompt: 'I would like to speak to a senior property advisor regarding payment plans.',
      },
    ];

    for (const c of cards) {
      const cardEl = document.createElement('div');
      cardEl.className = 'propbot-action-card';
      cardEl.innerHTML = `
        <span class="propbot-action-icon">${c.icon}</span>
        <span class="propbot-action-title">${c.title}</span>
        <span class="propbot-action-desc">${c.desc}</span>
      `;
      cardEl.onclick = () => {
        this.inputEl.value = c.prompt;
        this.handleSend();
      };
      wrap.appendChild(cardEl);
    }

    this.messagesListEl.appendChild(wrap);
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open(): void {
    this.isOpen = true;
    this.chatBoxEl.classList.add('open');
    this.proactiveBubbleEl.style.display = 'none';
    this.initSession();
    setTimeout(() => this.inputEl.focus(), 100);
  }

  close(): void {
    this.isOpen = false;
    this.chatBoxEl.classList.remove('open');
  }

  private addVisitorMessage(text: string): void {
    const msg = document.createElement('div');
    msg.className = 'propbot-msg visitor';
    msg.textContent = text;
    this.messagesListEl.appendChild(msg);
    this.scrollToBottom();
  }

  private addBotMessage(text: string): HTMLElement {
    const msg = document.createElement('div');
    msg.className = 'propbot-msg bot';
    msg.innerHTML = sanitizeHtml(text);

    const ttsBtn = document.createElement('button');
    ttsBtn.className = 'propbot-tts-btn';
    ttsBtn.setAttribute('aria-label', 'Read aloud');
    ttsBtn.title = 'Read aloud';
    ttsBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
    ttsBtn.onclick = () => {
      const rawText = msg.textContent || '';
      this.speakText(rawText);
    };

    this.messagesListEl.appendChild(msg);
    this.messagesListEl.appendChild(ttsBtn);
    this.scrollToBottom();
    return msg;
  }

  private renderLeadCaptureForm(): void {
    if (this.leadFormShown || this.leadCaptured) return;
    this.leadFormShown = true;
    const banner = document.createElement('div');
    banner.className = 'propbot-lead-banner';
    banner.innerHTML = `
      <h4>Request Verified Pricing & Floor Plans</h4>
      <div class="propbot-lead-form propbot-lead-form-body">
        <input type="text" placeholder="Your Full Name" id="lead-name" />
        <input type="tel" placeholder="Phone Number (e.g. +91 98765 43210)" id="lead-phone" />
        <button type="button" id="lead-submit">Get Priority Callback</button>
      </div>
    `;

    const submitBtn = banner.querySelector('#lead-submit') as HTMLButtonElement;
    submitBtn.onclick = async () => {
      const nameInput = banner.querySelector('#lead-name') as HTMLInputElement;
      const phoneInput = banner.querySelector('#lead-phone') as HTMLInputElement;
      if (!nameInput.value.trim() || !phoneInput.value.trim()) {
        alert('Please provide your name and phone number');
        return;
      }
      // Same rules as the server (shared validator), so bad numbers never reach the network.
      if (!validatePhone(phoneInput.value).valid) {
        alert('Please enter a valid phone number (India: 10 digits starting 6-9; or include your country code).');
        return;
      }
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';

      try {
        const leadRes = await fetch(`${this.config.apiUrl}/public/lead`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.sessionToken}`,
          },
          body: JSON.stringify({
            fullName: nameInput.value.trim(),
            name: nameInput.value.trim(),
            phone: phoneInput.value.trim(),
            conversationId: this.conversationId,
            utmParams: captureUtmParams(),
          }),
        });
        if (!leadRes.ok) {
          const errBody = (await leadRes.json().catch(() => ({}))) as { error?: { message?: string } };
          alert(errBody.error?.message || 'We could not save your details. Please try again.');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Try Again';
          return;
        }

        // Conversion pixels, fired only after the server confirmed the lead was saved. Fire-and-forget:
        // tracking problems must never affect the visitor's confirmation.
        void fireLeadConversion(
          this.tracking,
          {
            name: nameInput.value.trim(),
            phone: phoneInput.value.trim(),
            chatbotId: this.chatbotId,
            conversationId: this.conversationId,
            source: 'chat',
            utmParams: captureUtmParams(),
            pageUrl: window.location.href,
          },
          banner.querySelector(LEAD_FORM_BODY_SELECTOR),
        ).catch(() => undefined);

        this.leadCaptured = true;
        banner.innerHTML = `
          <div style="color: #14B8A6; font-size: 13px; font-weight: 700; text-align: center; padding: 6px 0;">
            ✓ Thank you! An advisor will connect with verified floor plans shortly.
          </div>
        `;
      } catch {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Try Again';
      }
    };

    this.messagesListEl.appendChild(banner);
    this.scrollToBottom();
  }

  /** Shows photos / floor plans / master plan / map under the bot's reply. Never throws. */
  private appendMedia(afterEl: HTMLElement, media: unknown): void {
    try {
      const el = renderMediaItems(media, afterEl.ownerDocument);
      if (el) {
        afterEl.after(el);
        this.scrollToBottom();
      }
    } catch {
      /* media is optional */
    }
  }

  private async handleSend(): Promise<void> {
    const text = this.inputEl.value.trim();
    if (!text) return;

    // Ensure session is initialized before sending
    if (!this.sessionToken || !this.conversationId) {
      await this.initSession();
    }
    if (!this.sessionToken || !this.conversationId) return; // session init failed

    this.inputEl.value = '';
    this.visitorMessageCount++;
    this.addVisitorMessage(text);

    // Create bot placeholder for streaming
    const botMsgEl = this.addBotMessage('...');
    this.sendBtn.disabled = true;

    try {
      const res = await fetch(`${this.config.apiUrl}/public/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.sessionToken}`,
        },
        body: JSON.stringify({
          message: text,
          conversationId: this.conversationId,
          language: this.activeLanguage,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      if (res.headers.get('content-type')?.includes('text/event-stream')) {
        // SSE Stream reading
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = '';
        botMsgEl.textContent = '';

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const dataStr = line.slice(6).trim();
                if (dataStr === '[DONE]') continue;
                try {
                  const parsed = JSON.parse(dataStr);
                  const piece = parsed.chunk ?? parsed.delta;
                  if (typeof piece === 'string') {
                    accumulatedText += piece;
                    botMsgEl.innerHTML = sanitizeHtml(accumulatedText);
                    this.scrollToBottom();
                  } else if (parsed.done) {
                    this.appendMedia(botMsgEl, parsed.media);
                    if (parsed.aiOffline) {
                      this.isAiOffline = true;
                      this.updateOfflineStatus();
                    }
                  } else if (parsed.aiOffline) {
                    this.isAiOffline = true;
                    this.updateOfflineStatus();
                  }
                } catch {
                  // Ignore JSON parse error on partial chunks
                }
              }
            }
          }
        }
      } else {
        const json = await res.json();
        botMsgEl.innerHTML = sanitizeHtml(json.data?.reply || 'Thank you for your inquiry.');
        this.appendMedia(botMsgEl, json.data?.media);
        if (json.data?.aiOffline) {
          this.isAiOffline = true;
          this.updateOfflineStatus();
        }
      }

      // Show lead capture form once after the 2nd message if visitor shows buying intent
      if (!this.leadCaptured && !this.leadFormShown && this.visitorMessageCount >= 2) {
        const lower = text.toLowerCase();
        const hasIntent =
          lower.includes('site visit') ||
          lower.includes('book') ||
          lower.includes('brochure') ||
          lower.includes('price') ||
          lower.includes('payment') ||
          lower.includes('floor plan') ||
          lower.includes('buy') ||
          lower.includes('interested') ||
          lower.includes('callback');
        if (hasIntent) {
          this.renderLeadCaptureForm();
        }
      }
    } catch {
      botMsgEl.textContent =
        'Our verified property advisors are available to share live inventory. Please leave your contact number.';
      // Only show form on error if not already shown and visitor has sent at least 1 message
      if (!this.leadCaptured && !this.leadFormShown && this.visitorMessageCount >= 1) {
        this.renderLeadCaptureForm();
      }
    } finally {
      this.sendBtn.disabled = false;
      this.scrollToBottom();
    }
  }

  private updateOfflineStatus(): void {
    const dot = this.chatBoxEl.querySelector('#status-dot');
    const text = this.chatBoxEl.querySelector('#status-text');
    if (dot) dot.classList.add('offline');
    if (text) text.textContent = 'Assisted Mode';
  }

  private scrollToBottom(): void {
    this.messagesListEl.scrollTop = this.messagesListEl.scrollHeight;
  }
}
