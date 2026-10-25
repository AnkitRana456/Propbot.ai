import type {
  ChannelAdapter,
  NormalizedInboundEvent,
  NormalizedInboundMessage,
  OutboundChannelMessage,
  ChannelSendResult,
} from '../whatsapp/channel.adapter.js';
import { escapeHtml, isSmtpConfigured, sendMail } from '../delivery/mailer.js';
import { simulationAllowed } from '../../utils/simulation.js';

export class EmailChannelAdapter implements ChannelAdapter {
  readonly channelName = 'email';

  normalize(rawPayload: unknown): NormalizedInboundEvent {
    const payload = rawPayload as Record<string, unknown>;
    const fromEmail = String(payload.from || payload.from_email || 'inbound@example.com');
    const senderName = String(payload.from_name || fromEmail.split('@')[0] || 'Email Lead');
    const subject = String(payload.subject || 'Property Inquiry');
    const body = String(payload.body || payload.text || payload.content || '');

    const message: NormalizedInboundMessage = {
      id: `email_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      fromPhone: fromEmail,
      fromName: senderName,
      timestamp: new Date(),
      type: 'text',
      text: `${subject}: ${body}`.trim(),
      rawPayload,
    };

    return {
      channel: 'email',
      phoneNumberId: 'email_inbound_gateway',
      displayPhoneNumber: 'sales@propbot.io',
      messages: [message],
      statuses: [],
    };
  }

  async receive(rawPayload: unknown): Promise<NormalizedInboundEvent> {
    return this.normalize(rawPayload);
  }

  /** Sends through SMTP. Without SMTP settings only development and tests simulate a delivery. */
  async send(_companyId: string, recipientAddress: string, message: OutboundChannelMessage): Promise<ChannelSendResult> {
    const text = message.text ?? '';
    if (!isSmtpConfigured()) {
      if (!simulationAllowed()) {
        return { success: false, messageId: '', provider: 'smtp', status: 'failed', error: 'E-mail is not set up on this server (SMTP_HOST).' };
      }
      return { success: true, messageId: `email_sim_${Date.now()}`, provider: 'smtp_simulated', status: 'sent' };
    }
    try {
      const [firstLine, ...rest] = text.split('\n');
      const subject = rest.length && firstLine && firstLine.length <= 120 ? firstLine : 'A message from your property advisor';
      const r = await sendMail({ to: [recipientAddress], subject, text, html: `<div style="font-family:sans-serif;white-space:pre-wrap">${escapeHtml(text)}</div>` });
      return r.sent ? { success: true, messageId: r.messageId, provider: 'smtp', status: 'sent' } : { success: false, messageId: '', provider: 'smtp', status: 'failed', error: r.reason };
    } catch (err) {
      return { success: false, messageId: '', provider: 'smtp', status: 'failed', error: err instanceof Error ? err.message : 'SMTP error' };
    }
  }

  verifyWebhook(_query: Record<string, unknown>, _verifyToken: string): string | null {
    return 'ok';
  }

  verifySignature(_rawBody: string | Buffer, _signature: string, _appSecret: string): boolean {
    return true;
  }
}

export const emailChannelAdapter = new EmailChannelAdapter();
