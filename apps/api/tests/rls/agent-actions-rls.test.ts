import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { createTestCompany } from '../helpers/test-fixtures.js';
import { agentActions } from '../../src/db/schema/index.js';

describe('agent_actions Guarded Actions RLS Tests (PDF Requirement)', () => {
  const createdCompanyIds: string[] = [];
  let companyAId: string;
  let companyBId: string;
  let actionAId: string;
  let actionBId: string;

  beforeAll(async () => {
    const compA = await createTestCompany({
      name: `AI Tenant A ${crypto.randomBytes(3).toString('hex')}`,
    });
    const compB = await createTestCompany({
      name: `AI Tenant B ${crypto.randomBytes(3).toString('hex')}`,
    });

    companyAId = compA.id;
    companyBId = compB.id;
    createdCompanyIds.push(companyAId, companyBId);

    // Insert T1 action for Company A
    const [actA] = await testDb
      .insert(agentActions)
      .values({
        companyId: companyAId,
        agentName: 'Concierge AI',
        actionType: 'send_brochure',
        tier: 'T1',
        status: 'executed',
        args: { project: 'Prestige White Meadows' },
      })
      .returning();
    actionAId = actA!.id;

    // Insert T2 guarded action for Company B (requires human approval)
    const [actB] = await testDb
      .insert(agentActions)
      .values({
        companyId: companyBId,
        agentName: 'Sales Bot',
        actionType: 'schedule_visit',
        tier: 'T2',
        status: 'proposed',
        args: { date: '2026-10-15', buyer: 'Rohan Mehra' },
      })
      .returning();
    actionBId = actB!.id;
  });

  afterAll(async () => {
    await cleanupTestDatabase(createdCompanyIds);
  });

  it('restricts raw query on agent_actions to only the current tenant', async () => {
    await testDb.transaction(async tx => {
      await tx.execute(sql`SELECT set_config('app.company_id', ${companyAId}, true)`);

      // Raw query without WHERE company_id = ...
      const actions = (await tx.execute(
        sql`SELECT id, company_id, agent_name, tier, status FROM agent_actions`,
      )) as Array<{
        id: string;
        company_id: string;
        agent_name: string;
        tier: string;
        status: string;
      }>;

      expect(actions.length).toBe(1);
      expect(actions[0]?.id).toBe(actionAId);
      expect(actions[0]?.company_id).toBe(companyAId);
      expect(actions[0]?.tier).toBe('T1');
    });
  });

  it('prohibits Company A from approving or modifying Company B guarded actions', async () => {
    await testDb.transaction(async tx => {
      await tx.execute(sql`SELECT set_config('app.company_id', ${companyAId}, true)`);

      // Company A attempts to maliciously approve Company B's action
      const approveRes = (await tx.execute(
        sql`UPDATE agent_actions SET status = 'approved' WHERE id = ${actionBId} RETURNING id`,
      )) as Array<{ id: string }>;

      // Zero rows affected because RLS completely hides the row from Company A's transaction
      expect(approveRes.length).toBe(0);
    });

    // Verify in Company B's context that the action is still 'proposed'
    await testDb.transaction(async tx => {
      await tx.execute(sql`SELECT set_config('app.company_id', ${companyBId}, true)`);
      const bActions = (await tx.execute(
        sql`SELECT id, status FROM agent_actions WHERE id = ${actionBId}`,
      )) as Array<{ id: string; status: string }>;

      expect(bActions.length).toBe(1);
      expect(bActions[0]?.status).toBe('proposed');
    });
  });
});
