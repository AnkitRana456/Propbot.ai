import { and, eq, gt } from 'drizzle-orm';
import type { CreateDemoRequestInput } from '@propbot/shared';
import { db } from '../../db/index.js';
import { demoRequests } from '../../db/schema/index.js';

const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

export const demoRequestsService = {
  /** Stores the request. A repeat from the same e-mail within a day is accepted but not stored twice. */
  async create(input: CreateDemoRequestInput): Promise<{ id: string | null }> {
    if (input.website) return { id: null }; // honeypot: pretend success so bots learn nothing

    const [existing] = await db
      .select({ id: demoRequests.id })
      .from(demoRequests)
      .where(and(eq(demoRequests.email, input.email), gt(demoRequests.createdAt, new Date(Date.now() - DUPLICATE_WINDOW_MS))))
      .limit(1);
    if (existing) return { id: existing.id };

    const [row] = await db
      .insert(demoRequests)
      .values({ name: input.name, email: input.email, mobile: input.mobile, agency: input.agency, listings: input.listings })
      .returning({ id: demoRequests.id });
    return { id: row!.id };
  },
};
