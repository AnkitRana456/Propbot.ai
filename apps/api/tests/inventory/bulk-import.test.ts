import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { companies, users, projects, units } from '../../src/db/schema/index.js';
import { eq } from 'drizzle-orm';

describe('Inventory Bulk CSV Import Endpoints', () => {
  const app = createApp();
  const companyId = '77777777-7777-7777-7777-777777777772';
  let projectId: string;

  const adminToken = signAccessToken({
    sub: '00000000-0000-0000-0000-000000000072',
    companyId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@bulk-import.com',
    name: 'Bulk Admin',
  });

  beforeAll(async () => {
    await testDb
      .insert(companies)
      .values({
        id: companyId,
        name: 'Bulk Import Realty',
        slug: 'bulk-import-realty',
        plan: 'growth',
        status: 'active',
      })
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values({
        id: '00000000-0000-0000-0000-000000000072',
        companyId,
        name: 'Bulk Admin',
        email: 'admin@bulk-import.com',
        passwordHash: 'hash',
        role: 'company_admin',
        status: 'active',
      })
      .onConflictDoNothing();

    const [proj] = await testDb
      .insert(projects)
      .values({
        companyId,
        name: 'Brigade Cornerstone Utopia',
        builderName: 'Brigade Group',
        location: 'Varthur, East Bengaluru',
        status: 'under_construction',
      })
      .returning();

    projectId = proj.id;
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  it('POST /api/properties/projects/:id/units/import imports 50+ units with Indian currency notation', async () => {
    // Generate CSV content with 52 units, mixing Indian currency notation: 1.25 Cr, 85 Lakhs, ₹1,50,00,000, 9500000
    const rows = ['tower,floor,unitNumber,bhk,carpetAreaSqft,superAreaSqft,price,status,facing,furnishing'];

    for (let i = 1; i <= 52; i++) {
      const tower = i % 2 === 0 ? 'Tower A' : 'Tower B';
      const floor = Math.floor(i / 4) + 1;
      const unitNum = `U-${100 + i}`;
      const bhk = (i % 3) + 1; // 1, 2, or 3
      const carpet = 600 + bhk * 300;
      const superArea = carpet * 1.35;

      let priceStr = '9500000';
      if (i % 4 === 0) priceStr = '1.75 Cr';
      else if (i % 4 === 1) priceStr = '85 Lakhs';
      else if (i % 4 === 2) priceStr = '₹1,50,00,000';

      rows.push(`${tower},${floor},${unitNum},${bhk},${carpet},${superArea},"${priceStr}",available,East,Semi-Furnished`);
    }

    // Add 1 invalid row to verify validation reporting
    rows.push('Tower C,1,INVALID-1,0,0,0,invalid_price,available,West,None');

    const csvContent = rows.join('\n');

    const res = await request(app)
      .post(`/api/properties/projects/${projectId}/units/import`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        csvContent,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalRows).toBe(53);
    expect(res.body.data.importedCount).toBe(52);
    expect(res.body.data.failedCount).toBe(1);
    expect(res.body.data.errors).toHaveLength(1);
    expect(res.body.data.errors[0].unitNumber).toBe('INVALID-1');

    // Verify units exist in database
    const dbUnits = await testDb.select().from(units).where(eq(units.projectId, projectId));
    expect(dbUnits.length).toBe(52);

    // Verify project units count computed via API
    const projectRes = await request(app)
      .get(`/api/properties/projects/${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(projectRes.status).toBe(200);
    expect(projectRes.body.data.totalUnitsCount).toBe(52);
    expect(projectRes.body.data.availableUnitsCount).toBe(52);
  });
});
