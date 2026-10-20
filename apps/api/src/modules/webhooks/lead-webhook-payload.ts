import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { chatbots, contacts, leads } from '../../db/schema/index.js';

/**
 * Flat, Zapier/CRM-friendly payload for the `lead_captured` trigger (spec section 5).
 * Nested lead + UTM data is lifted to root-level PascalCase keys.
 *
 * UTM mapping: source -> UTMSource, medium -> UTMMedium, campaign -> UTMCampaign,
 * sub_source -> UTMSubSource *and* SharedURL, agencypartner -> UTMAgencyPartner.
 * UTMTerm / UTMContent are added for the two remaining standard UTM keys.
 * Missing values are empty strings so downstream field mappers never see undefined/null.
 */
export interface FlatLeadWebhookPayload {
  LeadId: string;
  Name: string;
  FirstName: string;
  LastName: string;
  Phone: string;
  Email: string;
  PhoneVerified: boolean;
  ChatbotId: string;
  ChatbotName: string;
  Source: string;
  VisitCount: number;
  CapturedAt: string;
  LastSeenAt: string;
  PageUrl: string;
  UTMSource: string;
  UTMMedium: string;
  UTMCampaign: string;
  UTMTerm: string;
  UTMContent: string;
  UTMSubSource: string;
  SharedURL: string;
  UTMAgencyPartner: string;
}

export function flattenLeadPayload(input: {
  lead: {
    id: string;
    chatbotId: string | null;
    source: string;
    phoneVerified: boolean;
    visitCount: number;
    createdAt: Date;
    lastSeenAt: Date;
    pageUrl: string | null;
    utmParams: unknown;
  };
  contact: { firstName: string; lastName: string | null; phone: string; email: string | null };
  chatbotName?: string | null;
}): FlatLeadWebhookPayload {
  const utm = (input.lead.utmParams ?? {}) as Record<string, unknown>;
  const pick = (key: string) => (typeof utm[key] === 'string' ? (utm[key] as string) : '');
  const firstName = input.contact.firstName ?? '';
  const lastName = input.contact.lastName ?? '';

  return {
    LeadId: input.lead.id,
    Name: `${firstName} ${lastName}`.trim(),
    FirstName: firstName,
    LastName: lastName,
    Phone: input.contact.phone,
    Email: input.contact.email ?? '',
    PhoneVerified: input.lead.phoneVerified,
    ChatbotId: input.lead.chatbotId ?? '',
    ChatbotName: input.chatbotName ?? '',
    Source: input.lead.source,
    VisitCount: input.lead.visitCount,
    CapturedAt: input.lead.createdAt.toISOString(),
    LastSeenAt: input.lead.lastSeenAt.toISOString(),
    PageUrl: input.lead.pageUrl ?? '',
    UTMSource: pick('utm_source'),
    UTMMedium: pick('utm_medium'),
    UTMCampaign: pick('utm_campaign'),
    UTMTerm: pick('utm_term'),
    UTMContent: pick('utm_content'),
    UTMSubSource: pick('utm_sub_source'),
    SharedURL: pick('utm_sub_source'),
    UTMAgencyPartner: pick('utm_agencypartner'),
  };
}

/** Loads the lead from Postgres and returns its flattened webhook payload (null if it no longer exists). */
export async function buildLeadCapturedPayload(leadId: string): Promise<FlatLeadWebhookPayload | null> {
  const [row] = await db
    .select({
      lead: leads,
      contact: contacts,
      chatbotName: chatbots.name,
    })
    .from(leads)
    .innerJoin(contacts, eq(contacts.id, leads.contactId))
    .leftJoin(chatbots, eq(chatbots.id, leads.chatbotId))
    .where(eq(leads.id, leadId));

  if (!row) return null;
  return flattenLeadPayload({ lead: row.lead, contact: row.contact, chatbotName: row.chatbotName });
}
