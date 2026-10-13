import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { companies, users, objectionPlaybooks } from '../../src/db/schema/index.js';

describe('Cross-Tenant AI Objection Playbooks & Copilot Isolation', () => {
  const app = createApp();
  const companyAId = '77777777-7777-7777-7777-777777777798';
  const companyBId = '88888888-8888-8888-8888-888888888898';

  let playbookAId: string;

  const adminTokenA = signAccessToken({
    sub: '00000000-0000-0000-0000-000000000088',
    companyId: companyAId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@tenant-a-ai.com',
    name: 'Admin A AI',
  });

  const adminTokenB = signAccessToken({
    sub: '00000000-0000-0000-0000-000000000089',
    companyId: companyBId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@tenant-b-ai.com',
    name: 'Admin B AI',
  });

  beforeAll(async () => {
    await cleanupTestDatabase([companyAId, companyBId]);

    await testDb.insert(companies).values([
      { id: companyAId, name: 'Tenant A AI', slug: 'tenant-a-ai', plan: 'growth', status: 'active' },
      { id: companyBId, name: 'Tenant B AI', slug: 'tenant-b-ai', plan: 'growth', status: 'active' },
    ]);

    await testDb.insert(users).values([
      {
        id: '00000000-0000-0000-0000-000000000088',
        companyId: companyAId,
        name: 'Admin A AI',
        email: 'admin@tenant-a-ai.com',
        passwordHash: 'hash',
        role: 'company_admin',
        status: 'active',
      },
      {
        id: '00000000-0000-0000-0000-000000000089',
        companyId: companyBId,
        name: 'Admin B AI',
        email: 'admin@tenant-b-ai.com',
        passwordHash: 'hash',
        role: 'company_admin',
        status: 'active',
      },
    ]);

    // Create a playbook under Tenant A directly
    const [pbA] = await testDb
      .insert(objectionPlaybooks)
      .values({
        companyId: companyAId,
        category: 'price_too_high',
        title: 'Tenant A Secret Rebuttal',
        triggerKeywords: ['expensive', 'discount'],
        rebuttalText: 'Tenant A confidential pricing strategy and cost breakdown.',
        isActive: true,
      })
      .returning();

    playbookAId = pbA!.id;
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyAId, companyBId]);
  });

  it('GET /api/chatbots/playbooks does NOT return Tenant A playbooks to Tenant B', async () => {
    const res = await request(app)
      .get('/api/chatbots/playbooks')
      .set('Authorization', `Bearer ${adminTokenB}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    const playbooks = res.body.data.playbooks || [];
    const found = playbooks.some((p: { id: string }) => p.id === playbookAId);
    expect(found).toBe(false);
  });

  it('PUT /api/chatbots/playbooks/:id prevents Tenant B from updating Tenant A playbook', async () => {
    const res = await request(app)
      .put(`/api/chatbots/playbooks/${playbookAId}`)
      .set('Authorization', `Bearer ${adminTokenB}`)
      .send({
        title: 'Hacked by Tenant B',
      });

    expect(res.status).toBe(404);
  });

  it('DELETE /api/chatbots/playbooks/:id prevents Tenant B from deleting Tenant A playbook', async () => {
    const res = await request(app)
      .delete(`/api/chatbots/playbooks/${playbookAId}`)
      .set('Authorization', `Bearer ${adminTokenB}`);

    expect(res.status).toBe(404);
  });

  it('Tenant A can successfully view and manage their own playbook', async () => {
    const res = await request(app)
      .get('/api/chatbots/playbooks')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    const playbooks = res.body.data.playbooks || [];
    const found = playbooks.some((p: { id: string }) => p.id === playbookAId);
    expect(found).toBe(true);
  });
});
