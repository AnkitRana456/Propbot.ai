import { queryAvailableUnits } from './actions.js';

const lakh = 100_000;
const crore = 10_000_000;

/** Parses "under 1.5 Cr", "below 80 lakh", "budget 2cr" into rupees. */
export function parseBudget(message: string): number | undefined {
  const m = /(?:under|below|within|upto|up to|max(?:imum)?|budget(?: of)?|less than)\s*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)\s*(cr|crore|crores|l|lac|lakh|lakhs)\b/i.exec(message);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Math.round(n * (/^c/i.test(m[2]!) ? crore : lakh));
}

export function parseUnitQuery(message: string): { bhk?: number; maxPrice?: number; tower?: string } | null {
  const bhk = /\b(\d)\s*-?\s*bhk\b/i.exec(message);
  const tower = /\b(?:tower|wing)\s+([a-z0-9]{1,4})\b/i.exec(message);
  const maxPrice = parseBudget(message);
  if (!bhk && !tower && maxPrice === undefined) return null;
  if (!/(availab|inventory|in stock|have|price|cost|how much|show|looking|want|need|under|below|budget)/i.test(message)) return null;
  return { bhk: bhk ? Number(bhk[1]) : undefined, maxPrice, tower: tower?.[1] };
}

const inr = (n: number) => (n >= crore ? `₹${(n / crore).toFixed(2)} Cr` : `₹${(n / lakh).toFixed(1)} L`);

/**
 * Live facts for availability questions, injected into the agent prompt so the answer comes from real inventory
 * instead of the (possibly stale) knowledge base. Returns null when the message is not an inventory question.
 */
export async function liveInventoryFacts(companyId: string, message: string): Promise<string | null> {
  const q = parseUnitQuery(message);
  if (!q) return null;
  try {
    const found = await queryAvailableUnits(companyId, q, 6);
    const asked = [q.bhk ? `${q.bhk} BHK` : null, q.tower ? `Tower ${q.tower}` : null, q.maxPrice ? `under ${inr(q.maxPrice)}` : null].filter(Boolean).join(', ');
    if (found.length === 0) return `Live inventory check (${asked}): NO matching units are available right now. Say so honestly and offer the closest alternative or a callback.`;
    const lines = found.map(u => `- ${u.project}${u.tower ? `, Tower ${u.tower}` : ''}, unit ${u.unitNumber}, ${u.bhk} BHK, ${u.carpetAreaSqft} sqft carpet, ${inr(u.price)}`);
    return `Live inventory check (${asked}): ${found.length} matching unit(s) available right now:\n${lines.join('\n')}\nQuote only these prices and units; do not invent others.`;
  } catch {
    return null;
  }
}
