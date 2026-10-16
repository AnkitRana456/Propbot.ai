import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { createTestCompany } from '../helpers/test-fixtures.js';
import { domainEvents } from '../../src/db/schema/index.js';

describe('domain_events Outbox Table RLS Tests (PDF Requirement)', () => {
  const createdCompanyIds: string[] = [];
  let companyAId: string;
  let companyBId: string;
  let eventAId: string;
  let eventBId: string;

  beforeAll(async () => {
    const compA = await createTestCompany({
      name: `Outbox Tenant A ${crypto.randomBytes(3).toString('hex')}`,
    });
    const compB = await createTestCompany({
      name: `Outbox Tenant B ${crypto.randomBytes(3).toString('hex')}`,
    });

    companyAId = compA.id;
    companyBId = compB.id;
    createdCompanyIds.push(companyAId, companyBId);

    // Insert event for Company A
    const [evA] = await testDb
      .insert(domainEvents)
      .values({
        companyId: companyAId,
        type: 'lead.created',
        payload: { leadId: 'lead-001', intentScore: 90 },
      })
      .returning();
    eventAId = evA!.id;

    // Insert event for Company B
    const [evB] = await testDb
      .insert(domainEvents)
      .values({
        companyId: companyBId,
        type: 'appointment.booked',
        payload: { appointmentId: 'apt-999', slot: '2026-10-10' },
      })
      .returning();
    eventBId = evB!.id;
  });

  afterAll(async () => {
    await cleanupTestDatabase(createdCompanyIds);
  });

  it('restricts raw query on domain_events to only the current tenant', async () => {
    await testDb.transaction(async tx => {
      await tx.execute(sql`SET LOCAL ROLE propbot`);
      await tx.execute(sql`SELECT set_config('app.company_id', ${companyAId}, true)`);

      // Raw query without WHERE company_id = ...
      const results = (await tx.execute(
        sql`SELECT id, company_id, type, payload FROM domain_events`,
      )) as Array<{
        id: string;
        company_id: string;
        type: string;
      }>;

      expect(results.length).toBe(1);
      expect(results[0]?.id).toBe(eventAId);
      expect(results[0]?.company_id).toBe(companyAId);
    });
  });

  it('prevents Company A from modifying or deleting Company B domain events', async () => {
    await testDb.transaction(async tx => {
      await tx.execute(sql`SET LOCAL ROLE propbot`);
      await tx.execute(sql`SELECT set_config('app.company_id', ${companyAId}, true)`);

      // Attempt update targeting Company B's event ID
      const updateRes = (await tx.execute(
        sql`UPDATE domain_events SET processed_at = NOW() WHERE id = ${eventBId} RETURNING id`,
      )) as Array<{ id: string }>;

      // 0 rows updated because RLS hides the row completely
      expect(updateRes.length).toBe(0);

      // Attempt delete targeting Company B's event ID
      const deleteRes = (await tx.execute(
        sql`DELETE FROM domain_events WHERE id = ${eventBId} RETURNING id`,
      )) as Array<{ id: string }>;

      expect(deleteRes.length).toBe(0);
    });

    // Verify in Company B's context that the event was not altered
    await testDb.transaction(async tx => {
      await tx.execute(sql`SET LOCAL ROLE propbot`);
      await tx.execute(sql`SELECT set_config('app.company_id', ${companyBId}, true)`);
      const bEvents = (await tx.execute(
        sql`SELECT id, processed_at FROM domain_events WHERE id = ${eventBId}`,
      )) as Array<{ id: string; processed_at: string | null }>;

      expect(bEvents.length).toBe(1);
      expect(bEvents[0]?.processed_at).toBeNull();
    });
  });
});
