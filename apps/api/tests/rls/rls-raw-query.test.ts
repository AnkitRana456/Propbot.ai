import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { createTestCompany } from '../helpers/test-fixtures.js';
import { contacts, leads } from '../../src/db/schema/index.js';

describe('PostgreSQL Row-Level Security (RLS) Raw Query Tests (PDF Page 7 & 8)', () => {
  const createdCompanyIds: string[] = [];
  let companyAId: string;
  let companyBId: string;
  let contactAId: string;

  beforeAll(async () => {
    // 1. Create two distinct companies (uses superuser)
    const randA = crypto.randomBytes(4).toString('hex');
    const randB = crypto.randomBytes(4).toString('hex');

    const compA = await createTestCompany({ name: `Prestige Group ${randA}` });
    const compB = await createTestCompany({ name: `Sobha Realty ${randB}` });

    companyAId = compA.id;
    companyBId = compB.id;
    createdCompanyIds.push(companyAId, companyBId);

    // 2. Create contacts for both companies
    const [contactA] = await testDb
      .insert(contacts)
      .values({
        companyId: companyAId,
        firstName: 'Ananya',
        lastName: 'Rao',
        email: `ananya_${randA}@example.com`,
        phone: '+91 98450 11111',
      })
      .returning();
    contactAId = contactA!.id;

    const [contactB] = await testDb
      .insert(contacts)
      .values({
        companyId: companyBId,
        firstName: 'Karan',
        lastName: 'Verma',
        email: `karan_${randB}@example.com`,
        phone: '+91 98450 22222',
      })
      .returning();

    // 3. Create leads for Company A
    await testDb.insert(leads).values([
      {
        companyId: companyAId,
        contactId: contactA!.id,
        status: 'qualified',
        intentScore: 85,
        intentLabel: 'hot',
        source: 'Web Chatbot',
      },
      {
        companyId: companyAId,
        contactId: contactA!.id,
        status: 'new',
        intentScore: 50,
        intentLabel: 'warm',
        source: 'Landing Page',
      },
    ]);

    // 4. Create leads for Company B
    await testDb.insert(leads).values([
      {
        companyId: companyBId,
        contactId: contactB!.id,
        status: 'site_visit_scheduled',
        intentScore: 92,
        intentLabel: 'hot',
        source: 'WhatsApp Bot',
      },
      {
        companyId: companyBId,
        contactId: contactB!.id,
        status: 'booked',
        intentScore: 98,
        intentLabel: 'hot',
        source: 'Direct Walk-in',
      },
      {
        companyId: companyBId,
        contactId: contactB!.id,
        status: 'new',
        intentScore: 40,
        intentLabel: 'cold',
        source: 'Web Chatbot',
      },
    ]);
  });

  afterAll(async () => {
    await cleanupTestDatabase(createdCompanyIds);
  });

  it('proves that a raw query WITHOUT app filter blocks Company B data when scoped to Company A', async () => {
    // Use superuser connection but SET LOCAL ROLE to non-superuser for RLS enforcement
    await testDb.transaction(async tx => {
      await tx.execute(sql`SET LOCAL ROLE propbot`);
      await tx.execute(sql`SELECT set_config('app.company_id', ${companyAId}, true)`);

      const rows = (await tx.execute(
        sql`SELECT id, company_id, status, intent_score FROM leads`,
      )) as Array<{
        id: string;
        company_id: string;
        status: string;
        intent_score: number;
      }>;

      expect(rows.length).toBe(2);
      for (const row of rows) {
        expect(row.company_id).toBe(companyAId);
        expect(row.company_id).not.toBe(companyBId);
      }
    });
  });

  it('proves that a raw query WITHOUT app filter blocks Company A data when scoped to Company B', async () => {
    await testDb.transaction(async tx => {
      await tx.execute(sql`SET LOCAL ROLE propbot`);
      await tx.execute(sql`SELECT set_config('app.company_id', ${companyBId}, true)`);

      const rows = (await tx.execute(
        sql`SELECT id, company_id, status, intent_score FROM leads`,
      )) as Array<{
        id: string;
        company_id: string;
        status: string;
        intent_score: number;
      }>;

      expect(rows.length).toBe(3);
      for (const row of rows) {
        expect(row.company_id).toBe(companyBId);
        expect(row.company_id).not.toBe(companyAId);
      }
    });
  });

  it('proves that without an app.company_id context, RLS blocks all tenant records', async () => {
    await testDb.transaction(async tx => {
      await tx.execute(sql`SET LOCAL ROLE propbot`);
      await tx.execute(sql`SELECT set_config('app.company_id', '', true)`);

      const rows = (await tx.execute(sql`SELECT id, company_id FROM leads`)) as Array<{
        id: string;
        company_id: string;
      }>;

      // When unauthenticated / un-scoped, 0 records must be returned
      expect(rows.length).toBe(0);
    });
  });

  it('prevents cross-tenant data insertion via RLS WITH CHECK policy', async () => {
    let errorCaught: unknown = null;
    try {
      await testDb.transaction(async tx => {
        await tx.execute(sql`SET LOCAL ROLE propbot`);
        await tx.execute(sql`SELECT set_config('app.company_id', ${companyAId}, true)`);

        // Attempting to insert a row with Company B's company_id while scoped to Company A
        await tx.execute(
          sql`INSERT INTO leads (company_id, contact_id, status, intent_score, source) VALUES (${companyBId}, ${contactAId}, 'new', 50, 'Malicious Injection')`,
        );
      });
    } catch (err: unknown) {
      errorCaught = err;
    }

    expect(errorCaught).not.toBeNull();
    const typedError = errorCaught as {
      message?: string;
      cause?: { message?: string; code?: string };
    };
    const causeMsg = typedError?.cause?.message || typedError?.message || '';
    const causeCode = typedError?.cause?.code || '';
    expect(causeMsg.toLowerCase()).toContain('row-level security');
    expect(causeCode).toBe('42501');
  });
});
