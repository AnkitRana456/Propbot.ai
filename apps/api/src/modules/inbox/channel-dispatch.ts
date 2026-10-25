import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { channelConnections, contactIdentities, messageTemplates, whatsappConfigs } from '../../db/schema/index.js';
import { whatsappAdapter } from '../whatsapp/whatsapp.adapter.js';
import { emailChannelAdapter } from '../integrations/email.adapter.js';
import { openSecret, unpackEncryptedSecret } from '../../utils/crypto-vault.js';
import { ApiError, badRequest } from '../../utils/api-error.js';
import { requireSimulation } from '../../utils/simulation.js';

export interface DispatchInput {
  companyId: string;
  channel: string;
  conversationId: string;
  contactId: string | null;
  phone: string | null;
  email: string | null;
  text: string;
  templateName?: string;
  templateLanguage?: string;
  mediaUrl?: string;
  /** Visitor's last inbound time, for the WhatsApp 24-hour window. */
  lastInboundAt: Date | null;
}

export interface DispatchResult {
  provider: string;
  providerMessageId: string | null;
  status: 'sent' | 'queued' | 'stored';
  templateName?: string;
}

export const WHATSAPP_WINDOW_MS = 24 * 60 * 60 * 1000;

export function whatsappWindowExpired(lastInboundAt: Date | null, now = Date.now()): boolean {
  return !lastInboundAt || now - lastInboundAt.getTime() > WHATSAPP_WINDOW_MS;
}

/** Sends through the Graph API when live dispatch is on, otherwise records a mock delivery (dev / tests). */
async function sendSocial(channel: 'instagram' | 'messenger', companyId: string, recipientId: string, text: string): Promise<DispatchResult> {
  const [conn] = await db
    .select()
    .from(channelConnections)
    .where(and(eq(channelConnections.companyId, companyId), eq(channelConnections.channel, channel), eq(channelConnections.status, 'connected')))
    .limit(1);
  if (!conn) throw badRequest('CHANNEL_NOT_CONNECTED', `Connect ${channel} under Channels before replying there.`);

  if (process.env.META_LIVE_DISPATCH !== 'true') {
    requireSimulation(`Sending on ${channel}`, 'Set META_LIVE_DISPATCH=true once the Meta app is approved.');
    return { provider: `mock_${channel}`, providerMessageId: `mock_${channel}_${Date.now()}`, status: 'sent' };
  }
  const packed = conn.secrets.accessToken;
  if (!packed) throw badRequest('CHANNEL_NO_TOKEN', `The ${channel} connection has no access token.`);
  const token = unpackEncryptedSecret(packed);
  const res = await fetch('https://graph.facebook.com/v19.0/me/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text }, messaging_type: 'RESPONSE' }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new ApiError(502, 'CHANNEL_SEND_FAILED', `${channel} rejected the message (HTTP ${res.status}).`);
  const body = (await res.json().catch(() => ({}))) as { message_id?: string };
  return { provider: channel, providerMessageId: body.message_id ?? null, status: 'sent' };
}

/** Delivers an agent reply on the conversation's own channel. Throws ApiError when it cannot be delivered. */
export async function dispatchReply(i: DispatchInput): Promise<DispatchResult> {
  switch (i.channel) {
    case 'whatsapp': {
      if (!i.phone) throw badRequest('NO_RECIPIENT', 'This contact has no phone number.');
      const templateName = i.templateName;
      if (whatsappWindowExpired(i.lastInboundAt) && !templateName) {
        throw badRequest('WINDOW_EXPIRED', 'The 24-hour WhatsApp window has closed. Send an approved template message instead.');
      }
      if (templateName) {
        const [tpl] = await db
          .select({ status: messageTemplates.status })
          .from(messageTemplates)
          .where(and(eq(messageTemplates.companyId, i.companyId), eq(messageTemplates.channel, 'whatsapp'), eq(messageTemplates.name, templateName), isNull(messageTemplates.deletedAt)))
          .limit(1);
        if (!tpl) throw badRequest('TEMPLATE_UNKNOWN', `Template "${templateName}" does not exist.`);
        if (tpl.status !== 'approved') throw badRequest('TEMPLATE_NOT_APPROVED', `Template "${templateName}" is ${tpl.status}, not approved.`);
      }
      const cfg = await db.query.whatsappConfigs.findFirst({ where: eq(whatsappConfigs.companyId, i.companyId) });
      const r = await whatsappAdapter.send(
        i.companyId,
        i.phone,
        i.mediaUrl
          ? { type: 'media', mediaUrl: i.mediaUrl, mediaType: 'image', text: i.text }
          : templateName
            ? { type: 'template', text: i.text, templateName, templateLanguage: i.templateLanguage }
            : { type: 'text', text: i.text },
        cfg ? { phoneNumberId: cfg.phoneNumberId || undefined, accessToken: openSecret(cfg.accessToken), templateName: cfg.templateName || undefined } : undefined,
      );
      if (!r.success) throw new ApiError(502, 'CHANNEL_SEND_FAILED', r.error ?? 'WhatsApp rejected the message.');
      return { provider: r.provider, providerMessageId: r.messageId, status: r.status === 'failed' ? 'queued' : r.status, templateName };
    }
    case 'email': {
      if (!i.email) throw badRequest('NO_RECIPIENT', 'This contact has no e-mail address.');
      const r = await emailChannelAdapter.send(i.companyId, i.email, { type: 'text', text: i.text });
      if (!r.success) throw new ApiError(502, 'CHANNEL_SEND_FAILED', r.error ?? 'E-mail could not be sent.');
      return { provider: 'email', providerMessageId: r.messageId, status: r.status === 'failed' ? 'queued' : r.status };
    }
    case 'instagram':
    case 'messenger': {
      if (!i.contactId) throw badRequest('NO_RECIPIENT', 'This conversation has no contact.');
      const [identity] = await db
        .select({ externalId: contactIdentities.externalId })
        .from(contactIdentities)
        .where(and(eq(contactIdentities.companyId, i.companyId), eq(contactIdentities.contactId, i.contactId), eq(contactIdentities.channel, i.channel)))
        .limit(1);
      if (!identity) throw badRequest('NO_RECIPIENT', `No ${i.channel} identity is linked to this contact.`);
      return sendSocial(i.channel, i.companyId, identity.externalId, i.text);
    }
    default:
      // web widget / API / voice: the message is stored and picked up by the widget or API consumer
      return { provider: i.channel, providerMessageId: null, status: 'stored' };
  }
}
