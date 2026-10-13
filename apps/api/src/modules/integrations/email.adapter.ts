import type {
  ChannelAdapter,
  NormalizedInboundEvent,
  NormalizedInboundMessage,
  OutboundChannelMessage,
  ChannelSendResult,
} from '../whatsapp/channel.adapter.js';

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

  async send(
    _companyId: string,
    _recipientAddress: string,
    _message: OutboundChannelMessage,
  ): Promise<ChannelSendResult> {
    return {
      success: true,
      messageId: `email_out_${Date.now()}`,
      provider: 'smtp_mock',
      status: 'sent',
    };
  }

  verifyWebhook(_query: Record<string, unknown>, _verifyToken: string): string | null {
    return 'ok';
  }

  verifySignature(_rawBody: string | Buffer, _signature: string, _appSecret: string): boolean {
    return true;
  }
}

export const emailChannelAdapter = new EmailChannelAdapter();
