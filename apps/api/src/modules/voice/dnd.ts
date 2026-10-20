import { and, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { dndNumbers } from '../../db/schema/index.js';
import { normalizePhoneNumber } from '@propbot/shared';

export const normalizeDndPhone = (phone: string): string => normalizePhoneNumber(phone);

/** True when the number is on the company's do-not-disturb list. Always checked before an automated call. */
export async function isDnd(companyId: string, phone: string): Promise<boolean> {
  const [row] = await db
    .select({ id: dndNumbers.id })
    .from(dndNumbers)
    .where(and(eq(dndNumbers.companyId, companyId), eq(dndNumbers.phone, normalizeDndPhone(phone))))
    .limit(1);
  return Boolean(row);
}

export async function addDnd(companyId: string, phone: string, reason = 'requested'): Promise<void> {
  await db
    .insert(dndNumbers)
    .values({ companyId, phone: normalizeDndPhone(phone), reason })
    .onConflictDoNothing();
}
