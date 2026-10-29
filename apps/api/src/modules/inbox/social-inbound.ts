import crypto from 'node:crypto';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { channelConnections, chatbots, contactIdentities, contacts, conversations, domainEvents, messages } from '../../db/schema/index.js';
import { unpackEncryptedSecret } from '../../utils/crypto-vault.js';
import { ApiError } from '../../utils/api-error.js';
import { retrievalService } from '../ai/retrieval.service.js';
import { loadConversationHistory } from '../agents/agent-chat.js';
import { dispatchReply } from './channel-dispatch.js';
import { leadsService } from '../leads/leads.service.js';

interface MessagingEvent {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: { mid?: string; text?: string; is_echo?: boolean; attachments?: Array<{ type?: string; payload?: { url?: string } }> };
}
interface SocialPayload {
  object?: string;
  entry?: Array<{ id?: string; messaging?: MessagingEvent[] }>;
}

export function verifySocialSignature(rawBody: Buffer | undefined, header: string | undefined, secret: string): boolean {
  if (!rawBody || !header?.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const got = header.slice('sha256='.length);
  return got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

/** GET hub.challenge handshake. Fails closed when no verify token is configured. */
export function verifySocialChallenge(query: Record<string, unknown>): string | null {
  const expected = process.env.META_SOCIAL_VERIFY_TOKEN;
  if (!expected) return null;
  if (query['hub.mode'] === 'subscribe' && query['hub.verify_token'] === expected) return String(query['hub.challenge'] ?? '');
  return null;
}

const channelOf = (object?: string): 'instagram' | 'messenger' | null => (object === 'instagram' ? 'instagram' : object === 'page' ? 'messenger' : null);

async function fetchMessengerName(psid: string, pageToken: string): Promise<string | null> {
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${psid}?fields=name,first_name,last_name&access_token=${pageToken}`);
    if (!res.ok) return null;
    const data = await res.json() as { name?: string; first_name?: string };
    return data.name ?? data.first_name ?? null;
  } catch { return null; }
}

async function findOrCreateContact(companyId: string, channel: string, externalId: string, label: string): Promise<{ contactId: string; isNew: boolean; displayName: string }> {
  const [existing] = await db
    .select({ contactId: contactIdentities.contactId, handle: contactIdentities.handle })
    .from(contactIdentities)
    .where(and(eq(contactIdentities.companyId, companyId), eq(contactIdentities.channel, channel), eq(contactIdentities.externalId, externalId)));
  if (existing) return { contactId: existing.contactId, isNew: false, displayName: existing.handle ?? label };

  // Try to get real name from Facebook Graph API for Messenger contacts
  let displayName = label;
  if (channel === 'messenger') {
    const pageToken = process.env.META_MESSENGER_PAGE_ACCESS_TOKEN;
    if (pageToken) {
      const fbName = await fetchMessengerName(externalId, pageToken);
      if (fbName) displayName = fbName;
    }
  }

  let isNew = true;
  const contactId = await db.transaction(async tx => {
    const [contact] = await tx
      .insert(contacts)
      .values({ companyId, firstName: displayName, phone: `${channel}:${externalId}`.slice(0, 50) })
      .onConflictDoNothing()
      .returning({ id: contacts.id });

    // If conflict (phone already exists), find the existing contact
    if (!contact) {
      isNew = false;
      const [existingContact] = await tx
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(eq(contacts.companyId, companyId), eq(contacts.phone, `${channel}:${externalId}`.slice(0, 50))));
      if (existingContact) {
        await tx.insert(contactIdentities).values({ companyId, contactId: existingContact.id, channel, externalId, handle: displayName }).onConflictDoNothing();
        return existingContact.id;
      }
    }

    await tx.insert(contactIdentities).values({ companyId, contactId: contact!.id, channel, externalId, handle: displayName }).onConflictDoNothing();
    return contact!.id;
  });
  return { contactId, isNew, displayName };
}

async function triggerSocialAiReply(params: {
  companyId: string;
  chatbotId: string;
  conversationId: string;
  channel: 'instagram' | 'messenger';
  senderId: string;
  userMessage: string;
}): Promise<void> {
  const { companyId, chatbotId, conversationId, channel, senderId: _senderId, userMessage } = params;
  const history = await loadConversationHistory(conversationId, userMessage);
  const ragResponse = await retrievalService.query(companyId, chatbotId, { query: userMessage }, {
    history,
    agentInstructions: `LEAD CAPTURE (Messenger/Instagram channel):
After answering the visitor's question, if they seem interested (asking about price, availability, floor plans, site visit, or any property details), naturally ask for their name and phone number in the SAME reply. Example: "To send you the exact brochure and have a property consultant reach out, could you share your name and phone number?"
If they provide a phone number in any message, acknowledge it warmly and say a consultant will call them shortly.`,
  });
  const reply = ragResponse.answer?.trim();
  if (!reply) return;

  await db.insert(messages).values({ companyId, conversationId, senderType: 'bot', content: reply.slice(0, 4000), metadata: { channel, aiGenerated: true } });
  await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, conversationId));

  if (process.env.META_LIVE_DISPATCH === 'true') {
    const [conv] = await db.select({ contactId: conversations.contactId }).from(conversations).where(eq(conversations.id, conversationId));
    await dispatchReply({ companyId, channel, conversationId, contactId: conv?.contactId ?? null, phone: null, email: null, text: reply, lastInboundAt: new Date() });
  }

  // If user shared a phone number, update the existing social lead with real phone
  const phoneMatch = userMessage.match(/(?:\+?91[-.\s]?)?[6-9]\d{9}/);
  if (phoneMatch) {
    const rawPhone = phoneMatch[0].replace(/[\s.-]/g, '');
    const phone = rawPhone.startsWith('+') ? rawPhone : rawPhone.startsWith('91') && rawPhone.length === 12 ? `+${rawPhone}` : `+91${rawPhone}`;
    // Get the contact's stored name from the conversation/contact
    const [conv] = await db.select({ contactId: conversations.contactId }).from(conversations).where(eq(conversations.id, conversationId));
    const contactRow = conv?.contactId ? await db.query.contacts.findFirst({ where: eq(contacts.id, conv.contactId) }) : null;
    const name = contactRow ? `${contactRow.firstName ?? ''}${contactRow.lastName ? ' ' + contactRow.lastName : ''}`.trim() || `${channel} User` : `${channel} User`;
    try {
      await leadsService.captureOrUpdateLead(companyId, {
        chatbotId,
        conversationId,
        name,
        phone,
        source: channel === 'messenger' ? 'messenger' : 'instagram',
        preserveName: true,
      });
    } catch { /* phone invalid or duplicate — ignore */ }
  }
}

/**
 * Stores inbound Instagram DMs / Messenger messages in the unified inbox.
 * The signature is checked against the connection's app secret (or META_APP_SECRET); no secret = rejected.
 */
export async function handleSocialWebhook(payload: SocialPayload, rawBody: Buffer | undefined, signature: string | undefined): Promise<{ stored: number; ignored: number }> {
  const channel = channelOf(payload.object);
  if (!channel) throw new ApiError(400, 'SOCIAL_OBJECT_UNSUPPORTED', 'Unsupported webhook object.');
  let stored = 0;
  let ignored = 0;

  for (const entry of payload.entry ?? []) {
    if (!entry.id) continue;
    const [conn] = await db
      .select()
      .from(channelConnections)
      .where(and(eq(channelConnections.channel, channel), eq(channelConnections.externalAccountId, entry.id), inArray(channelConnections.status, ['connected', 'pending'])));
    if (!conn) {
      ignored++;
      continue;
    }
    const secret = conn.secrets.appSecret ? unpackEncryptedSecret(conn.secrets.appSecret) : process.env.META_APP_SECRET;
    if (!secret || !verifySocialSignature(rawBody, signature, secret)) throw new ApiError(401, 'SOCIAL_SIGNATURE_INVALID', 'Invalid webhook signature.');

    let chatbotId = conn.chatbotId;
    if (!chatbotId) {
      const [bot] = await db.select({ id: chatbots.id }).from(chatbots).where(eq(chatbots.companyId, conn.companyId)).orderBy(asc(chatbots.createdAt)).limit(1);
      chatbotId = bot?.id ?? null;
    }
    if (!chatbotId) {
      ignored++;
      continue;
    }

    for (const ev of entry.messaging ?? []) {
      const senderId = ev.sender?.id;
      const text = ev.message?.text ?? (ev.message?.attachments?.length ? `[${ev.message.attachments[0]?.type ?? 'attachment'}] ${ev.message.attachments[0]?.payload?.url ?? ''}`.trim() : '');
      if (!senderId || !text || ev.message?.is_echo || senderId === entry.id) {
        ignored++;
        continue;
      }
      const mid = ev.message?.mid;
      if (mid) {
        const [dup] = await db.select({ id: messages.id }).from(messages).where(and(eq(messages.companyId, conn.companyId), sql`${messages.metadata}->>'mid' = ${mid}`)).limit(1);
        if (dup) {
          ignored++;
          continue;
        }
      }

      const { contactId, isNew, displayName } = await findOrCreateContact(conn.companyId, channel, senderId, `${channel === 'instagram' ? 'Instagram' : 'Messenger'} user ${senderId.slice(-4)}`);
      let [conv] = await db
        .select()
        .from(conversations)
        .where(and(eq(conversations.companyId, conn.companyId), eq(conversations.contactId, contactId), eq(conversations.channel, channel), inArray(conversations.status, ['bot', 'needs_human', 'open', 'pending'])))
        .orderBy(desc(conversations.createdAt))
        .limit(1);
      if (!conv) {
        [conv] = await db.insert(conversations).values({ companyId: conn.companyId, chatbotId, contactId, channel, status: 'bot', metadata: { connectionId: conn.id } }).returning();
      }
      await db.insert(messages).values({ companyId: conn.companyId, conversationId: conv!.id, senderType: 'visitor', senderId, content: text.slice(0, 4000), metadata: { mid, channel } });
      await db.update(conversations).set({ status: conv!.status === 'pending' ? 'bot' : conv!.status, updatedAt: new Date() }).where(eq(conversations.id, conv!.id));
      await db.insert(domainEvents).values({ companyId: conn.companyId, type: 'inbound_message', payload: { conversation_id: conv!.id, channel, contact_id: contactId } });
      stored++;

      // Auto-create lead on first message using real Facebook/Instagram name (no phone needed)
      if (isNew) {
        void leadsService.captureOrUpdateSocialLead(conn.companyId, {
          contactId,
          chatbotId: chatbotId!,
          conversationId: conv!.id,
          name: displayName,
          source: channel,
        }).catch(() => {});
      }

      // Update intent score on every message
      void leadsService.processMessageAsync({ companyId: conn.companyId, chatbotId: chatbotId!, conversationId: conv!.id, message: text, senderType: 'visitor', isReturning: !isNew }).catch(() => {});

      // Trigger AI reply asynchronously (non-blocking so webhook returns 200 fast)
      void triggerSocialAiReply({ companyId: conn.companyId, chatbotId: chatbotId!, conversationId: conv!.id, channel, senderId, userMessage: text }).catch(() => {});
    }
  }
  return { stored, ignored };
}
