import '../../src/config/env.js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import * as schema from '../../src/db/schema/index.js';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://propbot:propbot_password@localhost:5432/propbot_pro?sslmode=disable';

export const testQueryClient = postgres(TEST_DATABASE_URL, {
  max: 5,
  idle_timeout: 10,
  connect_timeout: 5,
});

export const testDb = drizzle(testQueryClient, { schema });

export const RLS_DATABASE_URL =
  process.env.TEST_RLS_DATABASE_URL ||
  process.env.RLS_DATABASE_URL ||
  'postgresql://propbot:propbot_password@localhost:5432/propbot_pro?sslmode=disable';

export const rlsQueryClient = postgres(RLS_DATABASE_URL, {
  max: 5,
  idle_timeout: 10,
  connect_timeout: 5,
});

export const rlsTestDb = drizzle(rlsQueryClient, { schema });

export async function withRlsRole(tx: { execute: (query: unknown) => Promise<unknown> }): Promise<void> {
  await tx.execute(sql`SET LOCAL ROLE propbot`);
}

/**
 * Clean up test database data created during tests
 */
export async function cleanupTestDatabase(companyIds: string[] = []): Promise<void> {
  if (companyIds.length === 0) return;

  try {
    for (const companyId of companyIds) {
      await testDb.execute(sql`DELETE FROM voice_calls WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM company_sso_configs WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM workflow_run_steps WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM workflow_runs WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM workflows WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM campaign_recipients WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM campaigns WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM segments WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM booking_transactions WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM agent_actions WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM domain_events WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM objection_playbooks WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM re_engagement_logs WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM notifications WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM audit_logs WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM webhook_logs WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM webhook_endpoints WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM shortlist_items WHERE shortlist_id IN (SELECT id FROM shortlist_rooms WHERE company_id = ${companyId})`);
      await testDb.execute(sql`DELETE FROM shortlist_rooms WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM brochures WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM units WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM appointments WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM projects WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM notes WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM tasks WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM lead_activities WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM leads WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM messages WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM conversations WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM knowledge_chunks WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM knowledge_sources WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM chatbots WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM contacts WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM organizations WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM refresh_tokens WHERE company_id = ${companyId}`);
      await testDb.execute(
        sql`DELETE FROM password_reset_tokens WHERE user_id IN (SELECT id FROM users WHERE company_id = ${companyId})`,
      );
      await testDb.execute(sql`DELETE FROM api_keys WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM user_invitations WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM lead_credit_transactions WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM subscription_invoices WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM subscriptions WHERE company_id = ${companyId}`);
      await testDb.execute(sql`UPDATE companies SET parent_company_id = NULL WHERE parent_company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM company_ai_settings WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM users WHERE company_id = ${companyId}`);
      await testDb.execute(sql`DELETE FROM companies WHERE id = ${companyId}`);
    }
  } catch (err) {
    console.warn('Cleanup warning:', (err as Error).message);
  }
}
