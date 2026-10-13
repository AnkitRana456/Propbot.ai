import type {
  ChannelAdapter,
  NormalizedInboundEvent,
  NormalizedInboundMessage,
  OutboundChannelMessage,
  ChannelSendResult,
} from '../whatsapp/channel.adapter.js';

export class SmsChannelAdapter implements ChannelAdapter {
  readonly channelName = 'sms';

  normalize(rawPayload: unknown): NormalizedInboundEvent {
    const payload = rawPayload as Record<string, unknown>;
    const fromPhone = String(payload.From || payload.from || payload.phone || '+919999999999');
    const text = String(payload.Body || payload.text || payload.message || '');

    const message: NormalizedInboundMessage = {
      id: `sms_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      fromPhone,
      timestamp: new Date(),
      type: 'text',
      text,
      rawPayload,
    };

    return {
      channel: 'sms',
      phoneNumberId: 'sms_gateway_01',
      displayPhoneNumber: '+918000000000',
      messages: [message],
      statuses: [],
    };
  }

  async receive(rawPayload: unknown): Promise<NormalizedInboundEvent> {
    return this.normalize(rawPayload);
  }

  async send(
    _companyId: string,
    _recipientPhone: string,
    _message: OutboundChannelMessage,
  ): Promise<ChannelSendResult> {
    return {
      success: true,
      messageId: `sms_out_${Date.now()}`,
      provider: 'exotel_mock',
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

export const smsChannelAdapter = new SmsChannelAdapter();
