import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { companies, users, projects, units } from '../../src/db/schema/index.js';

describe('Cross-Tenant Inventory Isolation', () => {
  const app = createApp();
  const companyAId = '77777777-7777-7777-7777-777777777781';
  const companyBId = '88888888-8888-8888-8888-888888888882';

  let projectAId: string;
  let unitAId: string;
  let projectBId: string;


  const adminTokenCompanyB = signAccessToken({
    sub: '00000000-0000-0000-0000-000000000082',
    companyId: companyBId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@tenant-b-inventory.com',
    name: 'Admin Tenant B',
  });

  beforeAll(async () => {
    await cleanupTestDatabase([companyAId, companyBId]);

    await testDb
      .insert(companies)
      .values([
        { id: companyAId, name: 'Tenant A Realty', slug: 'tenant-a-inventory', plan: 'growth', status: 'active' },
        { id: companyBId, name: 'Tenant B Realty', slug: 'tenant-b-inventory', plan: 'growth', status: 'active' },
      ])
      .onConflictDoNothing();

    await testDb.insert(users).values([
      {
        id: '00000000-0000-0000-0000-000000000081',
        companyId: companyAId,
        name: 'Admin Tenant A',
        email: 'admin@tenant-a-inventory.com',
        passwordHash: 'hash',
        role: 'company_admin',
        status: 'active',
      },
      {
        id: '00000000-0000-0000-0000-000000000082',
        companyId: companyBId,
        name: 'Admin Tenant B',
        email: 'admin@tenant-b-inventory.com',
        passwordHash: 'hash',
        role: 'company_admin',
        status: 'active',
      },
    ]);

    // Create Project A and Unit A for Tenant A
    const [pA] = await testDb
      .insert(projects)
      .values({
        companyId: companyAId,
        name: 'Tenant A Secret Enclave',
        builderName: 'Tenant A Developers',
        location: 'Koramangala, Bengaluru',
        status: 'under_construction',
      })
      .returning();

    projectAId = pA.id;

    const [uA] = await testDb
      .insert(units)
      .values({
        companyId: companyAId,
        projectId: projectAId,
        unitNumber: 'Secret-101',
        bhk: 3,
        carpetAreaSqft: 1600,
        price: 25000000,
        status: 'available',
      })
      .returning();

    unitAId = uA.id;

    // Create Project B for Tenant B
    const [pB] = await testDb
      .insert(projects)
      .values({
        companyId: companyBId,
        name: 'Tenant B Public Plaza',
        builderName: 'Tenant B Developers',
        location: 'HSR Layout, Bengaluru',
        status: 'ready_to_move',
      })
      .returning();

    projectBId = pB.id;
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyAId, companyBId]);
  });

  it('Tenant B cannot fetch Tenant A project by ID (returns 404)', async () => {
    const res = await request(app)
      .get(`/api/properties/projects/${projectAId}`)
      .set('Authorization', `Bearer ${adminTokenCompanyB}`);

    expect(res.status).toBe(404);
  });

  it('Tenant B cannot fetch Tenant A units (returns 404)', async () => {
    const res = await request(app)
      .get(`/api/properties/projects/${projectAId}/units`)
      .set('Authorization', `Bearer ${adminTokenCompanyB}`);

    expect(res.status).toBe(404);
  });

  it('Tenant B cannot update status of Tenant A unit (returns 404)', async () => {
    const res = await request(app)
      .patch(`/api/properties/units/${unitAId}/status`)
      .set('Authorization', `Bearer ${adminTokenCompanyB}`)
      .send({ status: 'sold' });

    expect(res.status).toBe(404);
  });

  it('Tenant B projects list only returns Tenant B projects', async () => {
    const res = await request(app)
      .get('/api/properties/projects')
      .set('Authorization', `Bearer ${adminTokenCompanyB}`);

    expect(res.status).toBe(200);
    const itemIds = res.body.data.items.map((p: { id: string }) => p.id);
    expect(itemIds).toContain(projectBId);
    expect(itemIds).not.toContain(projectAId);
  });
});
