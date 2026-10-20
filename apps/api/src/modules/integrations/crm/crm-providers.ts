import crypto from 'crypto';
import type { FlatLeadWebhookPayload } from '../../webhooks/lead-webhook-payload.js';
import { SsrfGuard } from '../../webhooks/ssrf-guard.js';

/**
 * Real CRM connectors (spec section 5): HubSpot, Salesforce, Mailchimp.
 * Each returns an explicit result instead of throwing, so the delivery queue can decide between
 * "retry", "permanent failure" and "not configured / skipped".
 */
export type CrmResult =
  | { ok: true; externalId?: string; message?: string }
  | { ok: false; skipped: true; reason: string } // not configured / not applicable: never retried
  | { ok: false; skipped?: false; retryable: boolean; error: string };

export type FetchLike = typeof fetch;
let fetchImpl: FetchLike = (...args) => fetch(...args);
/** Test seam. */
export function setCrmFetch(f: FetchLike | null): void {
  fetchImpl = f ?? ((...args) => fetch(...args));
}

const TIMEOUT_MS = 15_000;

function str(config: Record<string, unknown>, key: string): string {
  const v = config[key];
  return typeof v === 'string' ? v.trim() : '';
}

function httpFailure(provider: string, status: number, body: string): CrmResult {
  // 408 / 429 / 5xx are transient; other 4xx (bad token, invalid payload) will not fix themselves.
  const retryable = status === 408 || status === 429 || status >= 500;
  return { ok: false, retryable, error: `${provider} HTTP ${status}: ${body.slice(0, 300)}` };
}

async function call(url: string, init: RequestInit): Promise<{ res: Response; text: string } | { error: string }> {
  try {
    const res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    return { res, text: await res.text().catch(() => '') };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'network error' };
  }
}

function netFailure(provider: string, error: string): CrmResult {
  return { ok: false, retryable: true, error: `${provider} request failed: ${error}` };
}

export interface CrmProvider {
  name: 'hubspot' | 'salesforce' | 'mailchimp';
  syncLead(lead: FlatLeadWebhookPayload, config: Record<string, unknown>): Promise<CrmResult>;
  /** Credential check that creates nothing. */
  testConnection(config: Record<string, unknown>): Promise<{ success: boolean; message: string }>;
}

// ---------------------------------------------------------------- HubSpot
export const hubspotProvider: CrmProvider = {
  name: 'hubspot',

  async syncLead(lead, config) {
    const token = str(config, 'accessToken');
    if (!token) return { ok: false, skipped: true, reason: 'HubSpot is not configured (accessToken missing).' };

    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const properties: Record<string, string> = {
      firstname: lead.FirstName,
      lastname: lead.LastName,
      phone: lead.Phone,
      lifecyclestage: 'lead',
    };
    if (lead.Email) properties.email = lead.Email;
    // Optional: map UTMs onto the HubSpot custom properties the account has created
    const utmMap = (config.utmPropertyMap ?? {}) as Record<string, unknown>;
    for (const [key, prop] of Object.entries(utmMap)) {
      const value = (lead as unknown as Record<string, unknown>)[key];
      if (typeof prop === 'string' && /^[a-z0-9_]+$/.test(prop) && typeof value === 'string' && value) {
        properties[prop] = value;
      }
    }

    const base = 'https://api.hubapi.com/crm/v3/objects/contacts';

    if (lead.Email) {
      const r = await call(`${base}/batch/upsert`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ inputs: [{ idProperty: 'email', id: lead.Email, properties }] }),
      });
      if ('error' in r) return netFailure('HubSpot', r.error);
      if (!r.res.ok) return httpFailure('HubSpot', r.res.status, r.text);
      const id = (JSON.parse(r.text || '{}') as { results?: Array<{ id?: string }> }).results?.[0]?.id;
      return { ok: true, externalId: id };
    }

    // No e-mail: find by phone first so a returning visitor updates the same contact
    const search = await call(`${base}/search`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: 'phone', operator: 'EQ', value: lead.Phone }] }],
        limit: 1,
      }),
    });
    if ('error' in search) return netFailure('HubSpot', search.error);
    if (!search.res.ok) return httpFailure('HubSpot', search.res.status, search.text);
    const existing = (JSON.parse(search.text || '{}') as { results?: Array<{ id: string }> }).results?.[0]?.id;

    const write = await call(existing ? `${base}/${existing}` : base, {
      method: existing ? 'PATCH' : 'POST',
      headers,
      body: JSON.stringify({ properties }),
    });
    if ('error' in write) return netFailure('HubSpot', write.error);
    if (!write.res.ok) return httpFailure('HubSpot', write.res.status, write.text);
    const id = (JSON.parse(write.text || '{}') as { id?: string }).id ?? existing;
    return { ok: true, externalId: id };
  },

  async testConnection(config) {
    const token = str(config, 'accessToken');
    if (!token) return { success: false, message: 'HubSpot is not configured (accessToken missing).' };
    const r = await call('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if ('error' in r) return { success: false, message: r.error };
    return r.res.ok
      ? { success: true, message: 'HubSpot credentials are valid.' }
      : { success: false, message: `HubSpot rejected the token (HTTP ${r.res.status}).` };
  },
};

// ---------------------------------------------------------------- Salesforce
const SALESFORCE_HOST_SUFFIXES = ['.salesforce.com', '.force.com', '.salesforce-setup.com'];
const SALESFORCE_API_VERSION = 'v59.0';

/** The instance URL is tenant-supplied, so it must be https and a genuine Salesforce host (SSRF guard). */
export function resolveSalesforceBase(instanceUrl: string): string | null {
  try {
    const u = new URL(instanceUrl);
    if (u.protocol !== 'https:') return null;
    if (!SALESFORCE_HOST_SUFFIXES.some(s => u.hostname.endsWith(s))) return null;
    SsrfGuard.assertSafeUrl(u.toString(), false);
    return u.origin;
  } catch {
    return null;
  }
}

export const salesforceProvider: CrmProvider = {
  name: 'salesforce',

  async syncLead(lead, config) {
    const token = str(config, 'accessToken');
    const instance = str(config, 'instanceUrl');
    if (!token || !instance) {
      return { ok: false, skipped: true, reason: 'Salesforce is not configured (instanceUrl / accessToken missing).' };
    }
    const base = resolveSalesforceBase(instance);
    if (!base) return { ok: false, retryable: false, error: 'Salesforce instanceUrl must be an https *.salesforce.com / *.force.com URL.' };

    const description = [
      `PropBot lead ${lead.LeadId}`,
      lead.PageUrl && `Page: ${lead.PageUrl}`,
      lead.UTMSource && `UTM source: ${lead.UTMSource}`,
      lead.UTMMedium && `UTM medium: ${lead.UTMMedium}`,
      lead.UTMCampaign && `UTM campaign: ${lead.UTMCampaign}`,
      lead.UTMSubSource && `UTM sub source: ${lead.UTMSubSource}`,
      lead.UTMAgencyPartner && `Agency partner: ${lead.UTMAgencyPartner}`,
    ]
      .filter(Boolean)
      .join('\n');

    const r = await call(`${base}/services/data/${SALESFORCE_API_VERSION}/sobjects/Lead`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        FirstName: lead.FirstName || undefined,
        LastName: lead.LastName || lead.FirstName || 'Unknown', // LastName is mandatory in Salesforce
        Company: str(config, 'defaultCompany') || '[Not Provided]', // Company is mandatory too
        Phone: lead.Phone,
        Email: lead.Email || undefined,
        LeadSource: str(config, 'leadSource') || 'PropBot',
        Description: description,
      }),
    });
    if ('error' in r) return netFailure('Salesforce', r.error);
    if (r.res.status === 401) {
      return { ok: false, retryable: false, error: 'Salesforce access token expired or invalid (HTTP 401). Reconnect the integration.' };
    }
    if (!r.res.ok) return httpFailure('Salesforce', r.res.status, r.text);
    return { ok: true, externalId: (JSON.parse(r.text || '{}') as { id?: string }).id };
  },

  async testConnection(config) {
    const token = str(config, 'accessToken');
    const instance = str(config, 'instanceUrl');
    if (!token || !instance) return { success: false, message: 'Salesforce is not configured (instanceUrl / accessToken missing).' };
    const base = resolveSalesforceBase(instance);
    if (!base) return { success: false, message: 'instanceUrl must be an https *.salesforce.com / *.force.com URL.' };
    const r = await call(`${base}/services/data/${SALESFORCE_API_VERSION}/limits`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if ('error' in r) return { success: false, message: r.error };
    return r.res.ok
      ? { success: true, message: 'Salesforce credentials are valid.' }
      : { success: false, message: `Salesforce rejected the token (HTTP ${r.res.status}).` };
  },
};

// ---------------------------------------------------------------- Mailchimp
function mailchimpBase(apiKey: string): string | null {
  const dc = apiKey.split('-')[1];
  return dc && /^[a-z]{2,3}\d{1,2}$/.test(dc) ? `https://${dc}.api.mailchimp.com/3.0` : null;
}

export const mailchimpProvider: CrmProvider = {
  name: 'mailchimp',

  async syncLead(lead, config) {
    const apiKey = str(config, 'apiKey');
    const listId = str(config, 'listId');
    if (!apiKey || !listId) {
      return { ok: false, skipped: true, reason: 'Mailchimp is not configured (apiKey / listId missing).' };
    }
    const base = mailchimpBase(apiKey);
    if (!base) return { ok: false, retryable: false, error: 'Mailchimp apiKey is malformed (expected <key>-<dc>).' };
    if (!lead.Email) return { ok: false, skipped: true, reason: 'Mailchimp requires an e-mail address; this lead has none.' };

    const hash = crypto.createHash('md5').update(lead.Email.toLowerCase()).digest('hex');
    const status = str(config, 'status') === 'subscribed' ? 'subscribed' : 'pending'; // pending = double opt-in
    const r = await call(`${base}/lists/${encodeURIComponent(listId)}/members/${hash}`, {
      method: 'PUT',
      headers: {
        Authorization: `Basic ${Buffer.from(`propbot:${apiKey}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email_address: lead.Email,
        status_if_new: status,
        merge_fields: { FNAME: lead.FirstName, LNAME: lead.LastName, PHONE: lead.Phone },
      }),
    });
    if ('error' in r) return netFailure('Mailchimp', r.error);
    if (!r.res.ok) return httpFailure('Mailchimp', r.res.status, r.text);
    return { ok: true, externalId: (JSON.parse(r.text || '{}') as { id?: string }).id ?? hash };
  },

  async testConnection(config) {
    const apiKey = str(config, 'apiKey');
    if (!apiKey) return { success: false, message: 'Mailchimp is not configured (apiKey missing).' };
    const base = mailchimpBase(apiKey);
    if (!base) return { success: false, message: 'Mailchimp apiKey is malformed (expected <key>-<dc>).' };
    const r = await call(`${base}/ping`, {
      headers: { Authorization: `Basic ${Buffer.from(`propbot:${apiKey}`).toString('base64')}` },
    });
    if ('error' in r) return { success: false, message: r.error };
    return r.res.ok
      ? { success: true, message: 'Mailchimp credentials are valid.' }
      : { success: false, message: `Mailchimp rejected the key (HTTP ${r.res.status}).` };
  },
};

export const CRM_PROVIDERS: Record<string, CrmProvider> = {
  hubspot: hubspotProvider,
  salesforce: salesforceProvider,
  mailchimp: mailchimpProvider,
};
