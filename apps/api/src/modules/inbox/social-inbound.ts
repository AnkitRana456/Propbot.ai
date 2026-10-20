import crypto from 'node:crypto';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { channelConnections, chatbots, contactIdentities, contacts, conversations, domainEvents, messages } from '../../db/schema/index.js';
import { unpackEncryptedSecret } from '../../utils/crypto-vault.js';
import { ApiError } from '../../utils/api-error.js';

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

async function findOrCreateContact(companyId: string, channel: string, externalId: string, label: string): Promise<string> {
  const [existing] = await db
    .select({ contactId: contactIdentities.contactId })
    .from(contactIdentities)
    .where(and(eq(contactIdentities.companyId, companyId), eq(contactIdentities.channel, channel), eq(contactIdentities.externalId, externalId)));
  if (existing) return existing.contactId;
  return db.transaction(async tx => {
    const [contact] = await tx
      .insert(contacts)
      .values({ companyId, firstName: label, phone: `${channel}:${externalId}`.slice(0, 50) })
      .returning({ id: contacts.id });
    await tx.insert(contactIdentities).values({ companyId, contactId: contact!.id, channel, externalId, handle: label });
    return contact!.id;
  });
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

      const contactId = await findOrCreateContact(conn.companyId, channel, senderId, `${channel === 'instagram' ? 'Instagram' : 'Messenger'} user ${senderId.slice(-4)}`);
      let [conv] = await db
        .select()
        .from(conversations)
        .where(and(eq(conversations.companyId, conn.companyId), eq(conversations.contactId, contactId), eq(conversations.channel, channel), inArray(conversations.status, ['bot', 'needs_human', 'open', 'pending'])))
        .orderBy(desc(conversations.createdAt))
        .limit(1);
      if (!conv) {
        [conv] = await db.insert(conversations).values({ companyId: conn.companyId, chatbotId, contactId, channel, status: 'needs_human', metadata: { connectionId: conn.id } }).returning();
      }
      await db.insert(messages).values({ companyId: conn.companyId, conversationId: conv!.id, senderType: 'visitor', senderId, content: text.slice(0, 4000), metadata: { mid, channel } });
      await db.update(conversations).set({ status: conv!.status === 'pending' ? 'open' : conv!.status, updatedAt: new Date() }).where(eq(conversations.id, conv!.id));
      await db.insert(domainEvents).values({ companyId: conn.companyId, type: 'inbound_message', payload: { conversation_id: conv!.id, channel, contact_id: contactId } });
      stored++;
    }
  }
  return { stored, ignored };
}
