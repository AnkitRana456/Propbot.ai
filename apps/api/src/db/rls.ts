import { sql } from 'drizzle-orm';
import { db, type Database } from './index.js';

/**
 * Executes a callback within a database transaction scoped to a specific company_id.
 * Enforces PostgreSQL Row-Level Security via `SET LOCAL app.company_id`.
 *
 * @param companyId The UUID of the company to scope queries to.
 * @param callback The transactional work to perform.
 */
export async function withTenantContext<T>(
  companyId: string,
  callback: (tx: Parameters<Parameters<Database['transaction']>[0]>[0]) => Promise<T>,
): Promise<T> {
  return await db.transaction(async tx => {
    // Set company_id for the duration of this transaction
    await tx.execute(sql`SELECT set_config('app.company_id', ${companyId}, true)`);
    return await callback(tx);
  });
}
