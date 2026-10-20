import crypto from 'crypto';
import { pino } from 'pino';
import type {
  ChannelAdapter,
  NormalizedInboundEvent,
  NormalizedInboundMessage,
  NormalizedInboundStatus,
  OutboundChannelMessage,
  ChannelSendResult,
} from './channel.adapter.js';

/**
 * Graph API version for outbound sends. Configurable because Meta retires old versions
 * (the spec's v18.0 is long expired); defaults to the version `pnpm setup:keys` already uses.
 */
export function graphApiVersion(): string {
  const v = (process.env.META_GRAPH_API_VERSION || '').trim();
  return /^v\d{1,2}\.\d$/.test(v) ? v : 'v21.0';
}

export const whatsappLogger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});

export class WhatsAppChannelAdapter implements ChannelAdapter {
  readonly channelName = 'whatsapp';

  /**
   * Validates Meta Webhook handshake (GET request).
   */
  verifyWebhook(query: Record<string, unknown>, verifyToken: string): string | null {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token === verifyToken) {
      return typeof challenge === 'string' ? challenge : String(challenge ?? '');
    }
    return null;
  }

  /**
   * Validates HMAC-SHA256 signature in X-Hub-Signature-256 header (POST request).
   */
  verifySignature(rawBody: string | Buffer, signatureHeader: string, appSecret: string): boolean {
    if (!signatureHeader || !appSecret) {
      return false;
    }

    const expectedPrefix = 'sha256=';
    const signature = signatureHeader.startsWith(expectedPrefix)
      ? signatureHeader.slice(expectedPrefix.length)
      : signatureHeader;

    const hmac = crypto.createHmac('sha256', appSecret);
    hmac.update(typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf-8') : rawBody);
    const expectedSignature = hmac.digest('hex');

    try {
      const sigBuf = Buffer.from(signature, 'hex');
      const expectedBuf = Buffer.from(expectedSignature, 'hex');
      if (sigBuf.length !== expectedBuf.length) {
        return false;
      }
      return crypto.timingSafeEqual(sigBuf, expectedBuf);
    } catch {
      return false;
    }
  }

  /**
   * Normalizes Meta Webhook payload into unified InboundEvent structure.
   */
  normalize(rawPayload: unknown): NormalizedInboundEvent {
    const payload = rawPayload as {
      object?: string;
      entry?: Array<{
        id?: string;
        changes?: Array<{
          value?: {
            messaging_product?: string;
            metadata?: {
              display_phone_number?: string;
              phone_number_id?: string;
            };
            contacts?: Array<{
              profile?: { name?: string };
              wa_id?: string;
            }>;
            messages?: Array<{
              from?: string;
              id?: string;
              timestamp?: string;
              type?: string;
              text?: { body?: string };
              interactive?: {
                type?: string;
                button_reply?: { id?: string; title?: string };
                list_reply?: { id?: string; title?: string };
              };
              image?: { id?: string; mime_type?: string };
              document?: { id?: string; filename?: string };
              audio?: { id?: string };
              location?: { latitude?: number; longitude?: number; name?: string; address?: string };
            }>;
            statuses?: Array<{
              id?: string;
              status?: string;
              timestamp?: string;
              recipient_id?: string;
              errors?: Array<{ title?: string; message?: string }>;
            }>;
          };
          field?: string;
        }>;
      }>;
    };

    const firstChange = payload?.entry?.[0]?.changes?.[0]?.value;
    const phoneNumberId = firstChange?.metadata?.phone_number_id || '';
    const displayPhoneNumber = firstChange?.metadata?.display_phone_number;

    const contactsMap = new Map<string, string>();
    if (firstChange?.contacts) {
      for (const c of firstChange.contacts) {
        if (c.wa_id && c.profile?.name) {
          contactsMap.set(c.wa_id, c.profile.name);
        }
      }
    }

    const messages: NormalizedInboundMessage[] = [];
    if (firstChange?.messages) {
      for (const m of firstChange.messages) {
        if (!m.id || !m.from) continue;

        const timestampSec = m.timestamp ? Number(m.timestamp) : Math.floor(Date.now() / 1000);
        const timestamp = new Date(timestampSec * 1000);
        const fromName = contactsMap.get(m.from);

        let msgType: NormalizedInboundMessage['type'] = 'text';
        let bodyText: string | undefined = undefined;
        let buttonPayload: string | undefined = undefined;

        if (m.type === 'interactive') {
          msgType = 'interactive';
          if (m.interactive?.button_reply) {
            bodyText = m.interactive.button_reply.title;
            buttonPayload = m.interactive.button_reply.id;
          } else if (m.interactive?.list_reply) {
            bodyText = m.interactive.list_reply.title;
            buttonPayload = m.interactive.list_reply.id;
          }
        } else if (m.type === 'image') {
          msgType = 'image';
          bodyText = '[Image attached]';
        } else if (m.type === 'document') {
          msgType = 'document';
          bodyText = `[Document: ${m.document?.filename || 'File'}]`;
        } else if (m.type === 'audio') {
          msgType = 'audio';
          bodyText = '[Voice note]';
        } else if (m.type === 'location') {
          msgType = 'location';
          bodyText = `[Location: ${m.location?.name || m.location?.address || 'Pinned location'}]`;
        } else {
          msgType = 'text';
          bodyText = m.text?.body || '';
        }

        messages.push({
          id: m.id,
          fromPhone: m.from,
          fromName,
          timestamp,
          type: msgType,
          text: bodyText,
          buttonPayload,
          location:
            m.location?.latitude && m.location?.longitude
              ? {
                  latitude: m.location.latitude,
                  longitude: m.location.longitude,
                  address: m.location.address || m.location.name,
                }
              : undefined,
          rawPayload: m,
        });
      }
    }

    const statuses: NormalizedInboundStatus[] = [];
    if (firstChange?.statuses) {
      for (const s of firstChange.statuses) {
        if (!s.id || !s.status) continue;
        const tsSec = s.timestamp ? Number(s.timestamp) : Math.floor(Date.now() / 1000);
        const validStatus = ['sent', 'delivered', 'read', 'failed'].includes(s.status)
          ? (s.status as NormalizedInboundStatus['status'])
          : 'sent';

        statuses.push({
          id: s.id,
          status: validStatus,
          recipientPhone: s.recipient_id || '',
          timestamp: new Date(tsSec * 1000),
          error: s.errors?.[0]?.message || s.errors?.[0]?.title,
        });
      }
    }

    return {
      channel: this.channelName,
      phoneNumberId,
      displayPhoneNumber,
      messages,
      statuses,
    };
  }

  async receive(rawPayload: unknown): Promise<NormalizedInboundEvent> {
    return this.normalize(rawPayload);
  }

  /**
   * Dispatches outbound message via Meta Cloud API or Mock Provider fallback with exponential backoff.
   */
  async send(
    companyId: string,
    recipientPhone: string,
    message: OutboundChannelMessage,
    config?: {
      phoneNumberId?: string;
      accessToken?: string;
      templateName?: string;
    },
  ): Promise<ChannelSendResult> {
    const isLiveMeta =
      process.env.META_LIVE_DISPATCH === 'true' &&
      Boolean(config?.phoneNumberId) &&
      Boolean(config?.accessToken);

    const cleanPhone = recipientPhone.replace(/[\s\-+]/g, '');

    // Retry loop with exponential backoff
    let attempts = 0;
    const maxRetries = 3;

    while (attempts < maxRetries) {
      attempts++;
      try {
        if (!isLiveMeta) {
          // Mock Provider fallback
          const mockWamid = `wamid.HBg${Date.now()}${Math.random().toString(36).substring(2, 8)}`;
          whatsappLogger.info(
            {
              companyId,
              to: cleanPhone,
              messageType: message.type,
              textSnippet: message.text?.slice(0, 40),
              template: message.templateName,
            },
            'Dispatched message via Mock WhatsApp Provider',
          );
          return {
            success: true,
            messageId: mockWamid,
            provider: 'mock_meta',
            status: 'sent',
          };
        }

        // Real Meta Cloud API HTTP Request
        const url = `https://graph.facebook.com/${graphApiVersion()}/${config!.phoneNumberId}/messages`;
        let body: Record<string, unknown> = {
          messaging_product: 'whatsapp',
          to: cleanPhone,
        };

        if (message.type === 'template') {
          body = {
            ...body,
            type: 'template',
            template: {
              name: message.templateName || config?.templateName || 'property_inquiry_details',
              language: { code: message.templateLanguage || 'en' },
            },
          };
        } else if (message.type === 'interactive' && message.buttons?.length) {
          body = {
            ...body,
            type: 'interactive',
            interactive: {
              type: 'button',
              body: { text: message.text || 'Please select an option:' },
              action: {
                buttons: message.buttons.map(b => ({
                  type: 'reply',
                  reply: { id: b.id, title: b.title.slice(0, 20) },
                })),
              },
            },
          };
        } else {
          body = {
            ...body,
            type: 'text',
            text: { body: message.text || '' },
          };
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(url, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config!.accessToken}`,
          },
          body: JSON.stringify(body),
        });

        clearTimeout(timeout);

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Meta API error (${res.status}): ${errText}`);
        }

        const data = (await res.json()) as { messages?: Array<{ id: string }> };
        const wamid = data?.messages?.[0]?.id || `wamid.HBg${Date.now()}`;

        return {
          success: true,
          messageId: wamid,
          provider: 'meta_cloud_api',
          status: 'sent',
        };
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        whatsappLogger.warn(
          { attempt: attempts, error: errorMsg },
          'Error dispatching WhatsApp message, retrying with backoff...',
        );

        if (attempts >= maxRetries) {
          return {
            success: false,
            messageId: '',
            provider: isLiveMeta ? 'meta_cloud_api' : 'mock_meta',
            status: 'failed',
            error: errorMsg,
          };
        }

        // Exponential backoff wait (50ms, 100ms in tests/dev)
        await new Promise(r => setTimeout(r, attempts * 50));
      }
    }

    return {
      success: false,
      messageId: '',
      provider: 'unknown',
      status: 'failed',
      error: 'Max retries exhausted',
    };
  }
}

export const whatsappAdapter = new WhatsAppChannelAdapter();
