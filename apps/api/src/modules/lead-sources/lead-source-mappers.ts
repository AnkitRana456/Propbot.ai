import type { CaptureLeadInput, LeadSourceType } from '@propbot/shared';

export interface MappedLead {
  name: string;
  phone: string;
  email?: string;
  budget?: string;
  bhk?: string;
  location?: string;
  purpose?: string;
  timeline?: string;
  /** Values for the source's form (`attribute:<key>` targets). */
  attributes: Record<string, unknown>;
  utm: Record<string, string>;
}

const ALIASES: Record<'name' | 'phone' | 'email' | 'budget' | 'bhk' | 'location' | 'purpose' | 'timeline', string[]> = {
  name: ['name', 'full_name', 'fullname', 'customer_name', 'buyer_name', 'contact_name', 'sender_name', 'lead_name', 'first_name'],
  phone: ['phone', 'phone_number', 'mobile', 'mobile_no', 'mobile_number', 'contact_number', 'buyer_mobile', 'customer_mobile', 'sender_mobile', 'whatsapp'],
  email: ['email', 'email_id', 'email_address', 'buyer_email', 'customer_email', 'sender_email'],
  budget: ['budget', 'price', 'price_range', 'budget_range'],
  bhk: ['bhk', 'bedrooms', 'configuration', 'property_type'],
  location: ['location', 'locality', 'city', 'preferred_location', 'project_location'],
  purpose: ['purpose', 'buying_purpose'],
  timeline: ['timeline', 'possession', 'when_to_buy'],
};

const norm = (k: string) => k.toLowerCase().replace(/[\s-]+/g, '_');

/** Flattens the vendor payload into a plain key -> string map. */
export function flatten(type: LeadSourceType, payload: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  const put = (k: string, v: unknown) => {
    if (v === undefined || v === null || typeof v === 'object') return;
    const s = String(v).trim();
    if (s) out[norm(k)] = s;
  };
  const p = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;

  if (type === 'meta_lead_ads' && Array.isArray(p.field_data)) {
    for (const f of p.field_data as Array<{ name?: string; values?: unknown[] }>) if (f.name) put(f.name, f.values?.[0]);
  }
  if (type === 'google_ads' && Array.isArray(p.user_column_data)) {
    const map: Record<string, string> = { FULL_NAME: 'name', EMAIL: 'email', PHONE_NUMBER: 'phone', CITY: 'location' };
    for (const c of p.user_column_data as Array<{ column_id?: string; string_value?: unknown }>) {
      if (c.column_id) put(map[c.column_id] ?? c.column_id, c.string_value);
    }
  }
  // Everything else (and any extra top-level scalar) is read as-is; one level of nesting is flattened.
  for (const [k, v] of Object.entries(p)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) put(k2, v2);
    else put(k, v);
  }
  return out;
}

/** Applies the source mapping, then well-known aliases. Returns null when no name/phone can be found. */
export function mapLead(type: LeadSourceType, fieldMapping: Record<string, string>, payload: unknown): MappedLead | null {
  const flat = flatten(type, payload);
  const mapped: Record<string, string> = {};
  const attributes: Record<string, unknown> = {};
  const utm: Record<string, string> = {};

  for (const [incoming, target] of Object.entries(fieldMapping)) {
    const value = flat[norm(incoming)];
    if (value === undefined) continue;
    if (target.startsWith('attribute:')) attributes[target.slice('attribute:'.length)] = value;
    else if (target.startsWith('utm_')) utm[target] = value;
    else mapped[target] = value;
  }
  for (const [k, v] of Object.entries(flat)) if (k.startsWith('utm_') && !utm[k]) utm[k] = v.slice(0, 200);
  if (type === 'meta_lead_ads' && typeof (payload as Record<string, unknown>)?.campaign_name === 'string') utm.utm_campaign ??= String((payload as Record<string, unknown>).campaign_name).slice(0, 200);
  if (type === 'google_ads' && flat.campaign_id) utm.utm_campaign ??= flat.campaign_id;

  const pick = (key: keyof typeof ALIASES) => mapped[key] ?? ALIASES[key].map(a => flat[a]).find(Boolean);
  const first = pick('name');
  const phone = pick('phone');
  if (!phone) return null;
  const last = flat.last_name;
  const name = first ? (last && !first.includes(last) && (flat.first_name === first || !flat.name) ? `${first} ${last}` : first) : undefined;

  return {
    name: name ?? 'Prospective Buyer',
    phone,
    email: pick('email'),
    budget: pick('budget'),
    bhk: pick('bhk'),
    location: pick('location') ?? flat.project ?? flat.project_name,
    purpose: pick('purpose'),
    timeline: pick('timeline'),
    attributes,
    utm,
  };
}

export const toCaptureInput = (m: MappedLead, extra: Pick<CaptureLeadInput, 'chatbotId' | 'source' | 'utmParams'>): CaptureLeadInput => ({
  name: m.name.slice(0, 100),
  phone: m.phone,
  email: m.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m.email) ? m.email : undefined,
  budget: m.budget,
  bhk: m.bhk,
  location: m.location,
  purpose: m.purpose,
  timeline: m.timeline,
  ...extra,
});

/** Minimal RFC-4180 parser: quoted fields, escaped quotes, CRLF. Returns rows of header-keyed objects. */
export function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.some(c => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(c => c.trim())) rows.push(row);
  const [header, ...body] = rows;
  if (!header) return [];
  const keys = header.map(h => norm(h.trim()));
  return body.map(r => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}
