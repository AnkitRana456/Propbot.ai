import { sanitizeHtml } from './sanitizer.js';

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
  private isOpen = false;
  private isAiOffline = false;

  private containerEl!: HTMLElement;
  private launcherBtn!: HTMLButtonElement;
  private chatBoxEl!: HTMLElement;
  private messagesListEl!: HTMLElement;
  private inputEl!: HTMLInputElement;
  private sendBtn!: HTMLButtonElement;
  private leadModalEl!: HTMLElement;

  constructor(shadow: ShadowRoot, config: WidgetUiConfig) {
    this.shadow = shadow;
    this.config = config;
    this.render();
  }

  private getStyles(): string {
    const isDark = this.config.themeMode !== 'light';
    const bgApp = isDark ? '#141414' : '#ffffff';
    const bgCard = isDark ? '#1c1c1c' : '#f9fafb';
    const textMain = isDark ? '#f3f4f6' : '#111827';
    const textMuted = isDark ? '#9ca3af' : '#6b7280';
    const borderCol = isDark ? '#262626' : '#e5e7eb';
    const primary = this.config.primaryColor || '#3b82f6';

    return `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }
      .propbot-root {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 2147483647;
      }
      .propbot-launcher {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: ${primary};
        color: white;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 14px rgba(0,0,0,0.25);
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s;
      }
      .propbot-launcher:hover {
        transform: scale(1.05);
      }
      .propbot-launcher svg {
        width: 28px;
        height: 28px;
        fill: currentColor;
      }
      .propbot-chatbox {
        position: fixed;
        bottom: 96px;
        right: 24px;
        width: 380px;
        height: 600px;
        max-width: calc(100vw - 32px);
        max-height: calc(100vh - 120px);
        background: ${bgApp};
        border: 1px solid ${borderCol};
        border-radius: 16px;
        display: none;
        flex-direction: column;
        overflow: hidden;
        box-shadow: 0 12px 32px rgba(0,0,0,0.3);
      }
      .propbot-chatbox.open {
        display: flex;
      }
      .propbot-header {
        padding: 16px;
        background: ${bgCard};
        border-bottom: 1px solid ${borderCol};
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .propbot-header-info {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .propbot-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: ${primary};
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 15px;
      }
      .propbot-title {
        font-size: 15px;
        font-weight: 600;
        color: ${textMain};
      }
      .propbot-status {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: ${textMuted};
      }
      .propbot-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #10b981;
      }
      .propbot-dot.offline {
        background: #f59e0b;
      }
      .propbot-close-btn {
        background: none;
        border: none;
        color: ${textMuted};
        cursor: pointer;
        padding: 4px;
        font-size: 20px;
        line-height: 1;
      }
      .propbot-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .propbot-msg {
        max-width: 82%;
        padding: 10px 14px;
        border-radius: 12px;
        font-size: 14px;
        line-height: 1.45;
        word-break: break-word;
      }
      .propbot-msg.visitor {
        align-self: flex-end;
        background: ${primary};
        color: white;
        border-bottom-right-radius: 4px;
      }
      .propbot-msg.bot {
        align-self: flex-start;
        background: ${bgCard};
        color: ${textMain};
        border: 1px solid ${borderCol};
        border-bottom-left-radius: 4px;
      }
      .propbot-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 8px;
      }
      .propbot-pill {
        background: ${bgCard};
        border: 1px solid ${borderCol};
        color: ${primary};
        border-radius: 20px;
        padding: 6px 12px;
        font-size: 12px;
        cursor: pointer;
        text-align: left;
        transition: background-color 0.15s;
      }
      .propbot-pill:hover {
        border-color: ${primary};
      }
      .propbot-footer {
        padding: 12px 16px;
        background: ${bgCard};
        border-top: 1px solid ${borderCol};
        display: flex;
        gap: 8px;
      }
      .propbot-input {
        flex: 1;
        background: ${bgApp};
        border: 1px solid ${borderCol};
        border-radius: 8px;
        padding: 10px 12px;
        color: ${textMain};
        font-size: 14px;
        outline: none;
      }
      .propbot-input:focus {
        border-color: ${primary};
      }
      .propbot-send-btn {
        background: ${primary};
        color: white;
        border: none;
        border-radius: 8px;
        padding: 0 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .propbot-lead-banner {
        background: ${isDark ? '#262626' : '#eff6ff'};
        border: 1px solid ${isDark ? '#3b82f6' : '#93c5fd'};
        border-radius: 12px;
        padding: 12px;
        margin-top: 8px;
      }
      .propbot-lead-banner h4 {
        font-size: 13px;
        font-weight: 600;
        color: ${textMain};
        margin-bottom: 6px;
      }
      .propbot-lead-form input {
        width: 100%;
        margin-bottom: 8px;
        padding: 8px 10px;
        font-size: 13px;
        border-radius: 6px;
        border: 1px solid ${borderCol};
        background: ${bgApp};
        color: ${textMain};
      }
      .propbot-lead-form button {
        width: 100%;
        padding: 8px;
        background: ${primary};
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
      }
    `;
  }

  private render(): void {
    const styleEl = document.createElement('style');
    styleEl.textContent = this.getStyles();
    this.shadow.appendChild(styleEl);

    this.containerEl = document.createElement('div');
    this.containerEl.className = 'propbot-root';

    // Launcher button
    this.launcherBtn = document.createElement('button');
    this.launcherBtn.className = 'propbot-launcher';
    this.launcherBtn.setAttribute('aria-label', 'Open property chat assistant');
    this.launcherBtn.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
      </svg>
    `;
    this.launcherBtn.onclick = () => this.toggle();

    // Chatbox
    this.chatBoxEl = document.createElement('div');
    this.chatBoxEl.className = 'propbot-chatbox';

    // Header
    const initial = (this.config.botName || 'P')[0]?.toUpperCase();
    this.chatBoxEl.innerHTML = `
      <div class="propbot-header">
        <div class="propbot-header-info">
          <div class="propbot-avatar">${initial}</div>
          <div>
            <div class="propbot-title">${this.config.botName}</div>
            <div class="propbot-status"><span class="propbot-dot" id="status-dot"></span> <span id="status-text">Online</span></div>
          </div>
        </div>
        <button class="propbot-close-btn" aria-label="Close chat">&times;</button>
      </div>
      <div class="propbot-messages" id="propbot-msgs"></div>
      <div class="propbot-footer">
        <input class="propbot-input" placeholder="Ask about 2BHK/3BHK, pricing, site visits..." />
        <button class="propbot-send-btn" aria-label="Send">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    `;

    this.containerEl.appendChild(this.chatBoxEl);
    this.containerEl.appendChild(this.launcherBtn);
    this.shadow.appendChild(this.containerEl);

    // Bind event handlers
    const closeBtn = this.chatBoxEl.querySelector('.propbot-close-btn') as HTMLButtonElement;
    closeBtn.onclick = () => this.close();

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
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to initialize session: HTTP ${res.status}`);
      }

      const data = await res.json();
      this.sessionToken = data.data.sessionToken;
      this.conversationId = data.data.conversationId;

      // Render greeting
      this.addBotMessage(this.config.greetingMessage);

      // Render quick pills
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
    }
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
    this.messagesListEl.appendChild(msg);
    this.scrollToBottom();
    return msg;
  }

  private renderLeadCaptureForm(): void {
    const banner = document.createElement('div');
    banner.className = 'propbot-lead-banner';
    banner.innerHTML = `
      <h4>Request Verified Pricing & Floor Plans</h4>
      <div class="propbot-lead-form">
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
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';

      try {
        await fetch(`${this.config.apiUrl}/public/lead`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.sessionToken}`,
          },
          body: JSON.stringify({
            conversationId: this.conversationId,
            fullName: nameInput.value.trim(),
            phone: phoneInput.value.trim(),
          }),
        });
        banner.innerHTML = `<h4>Thank you! Our property advisor will call you shortly.</h4>`;
      } catch {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Retry Submission';
      }
    };

    this.messagesListEl.appendChild(banner);
    this.scrollToBottom();
  }

  private async handleSend(): Promise<void> {
    const text = this.inputEl.value.trim();
    if (!text) return;

    this.inputEl.value = '';
    this.addVisitorMessage(text);

    if (!this.sessionToken) {
      await this.initSession();
    }

    const botMsgEl = this.addBotMessage('...');

    try {
      const res = await fetch(`${this.config.apiUrl}/public/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.sessionToken}`,
        },
        body: JSON.stringify({
          conversationId: this.conversationId,
          message: text,
          stream: true,
        }),
      });

      if (!res.ok) {
        throw new Error(`Message failed with status ${res.status}`);
      }

      if (res.headers.get('content-type')?.includes('text/event-stream')) {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        botMsgEl.textContent = '';

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.chunk) {
                    fullText += data.chunk;
                    botMsgEl.textContent = fullText;
                    this.scrollToBottom();
                  }
                  if (data.done) {
                    if (data.aiOffline) {
                      this.renderLeadCaptureForm();
                    }
                  }
                } catch {
                  // Ignore JSON parse errors on partial stream chunks
                }
              }
            }
          }
        }
      } else {
        const data = await res.json();
        botMsgEl.textContent = data.data.reply;
        if (data.data.aiOffline) {
          this.renderLeadCaptureForm();
        }
      }
    } catch {
      botMsgEl.textContent =
        'Sorry, I could not connect right now. Please share your phone number and our team will get back to you.';
      this.renderLeadCaptureForm();
    }
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      this.messagesListEl.scrollTop = this.messagesListEl.scrollHeight;
    }, 50);
  }
}
