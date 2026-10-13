export interface NormalizedInboundMessage {
  id: string; // wamid or provider message id
  fromPhone: string;
  fromName?: string;
  timestamp: Date;
  type: 'text' | 'interactive' | 'image' | 'document' | 'audio' | 'location';
  text?: string;
  buttonPayload?: string;
  mediaUrl?: string;
  location?: { latitude: number; longitude: number; address?: string };
  rawPayload: unknown;
}

export interface NormalizedInboundStatus {
  id: string; // provider message id
  status: 'sent' | 'delivered' | 'read' | 'failed';
  recipientPhone: string;
  timestamp: Date;
  error?: string;
}

export interface NormalizedInboundEvent {
  channel: string;
  phoneNumberId: string;
  displayPhoneNumber?: string;
  messages: NormalizedInboundMessage[];
  statuses: NormalizedInboundStatus[];
}

export interface OutboundChannelMessage {
  type: 'text' | 'template' | 'interactive' | 'media';
  text?: string;
  templateName?: string;
  templateLanguage?: string;
  templateParameters?: Record<string, string>;
  mediaUrl?: string;
  mediaType?: 'image' | 'document';
  buttons?: Array<{ id: string; title: string }>;
}

export interface ChannelSendResult {
  success: boolean;
  messageId: string;
  provider: string;
  status: 'sent' | 'queued' | 'failed';
  error?: string;
}

export interface ChannelAdapter {
  readonly channelName: string;
  receive(rawPayload: unknown, signature?: string): Promise<NormalizedInboundEvent>;
  send(
    companyId: string,
    recipientPhone: string,
    message: OutboundChannelMessage,
    config?: {
      phoneNumberId?: string;
      accessToken?: string;
      templateName?: string;
    },
  ): Promise<ChannelSendResult>;
  normalize(rawPayload: unknown): NormalizedInboundEvent;
  verifyWebhook(query: Record<string, unknown>, verifyToken: string): string | null;
  verifySignature(rawBody: string | Buffer, signature: string, appSecret: string): boolean;
}
