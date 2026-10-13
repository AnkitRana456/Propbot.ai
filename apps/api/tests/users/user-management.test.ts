import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { companies, users } from '../../src/db/schema/index.js';

describe('User Management API & Team Routing', () => {
  const app = createApp();
  const companyId = '99999999-9999-9999-9999-999999999930';
  const adminId = '00000000-0000-0000-0000-000000000301';
  const agentId = '00000000-0000-0000-0000-000000000302';

  const adminToken = signAccessToken({
    sub: adminId,
    companyId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@usermgmt.com',
    name: 'Admin User',
  });

  const agentToken = signAccessToken({
    sub: agentId,
    companyId,
    role: 'agent',
    status: 'active',
    email: 'agent@usermgmt.com',
    name: 'Agent User',
  });

  beforeAll(async () => {
    await cleanupTestDatabase([companyId]);

    await testDb
      .insert(companies)
      .values({
        id: companyId,
        name: 'User Mgmt Realty Ltd',
        slug: 'user-mgmt-realty',
        plan: 'growth',
        status: 'active',
      })
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values([
        {
          id: adminId,
          companyId,
          name: 'Primary Admin',
          email: 'admin@usermgmt.com',
          role: 'company_admin',
          status: 'active',
          passwordHash: 'dummy',
        },
        {
          id: agentId,
          companyId,
          name: 'Sales Agent A',
          email: 'agent@usermgmt.com',
          role: 'agent',
          status: 'active',
          team: 'East Coast',
          leadCapacity: 40,
          passwordHash: 'dummy',
        },
      ])
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  it('GET /api/users/kpis returns accurate user counts', async () => {
    const res = await request(app)
      .get('/api/users/kpis')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalUsers).toBe(2);
    expect(res.body.data.activeUsers).toBe(2);
    expect(res.body.data.pendingApproval).toBe(0);
  });

  it('GET /api/users lists team members with search and role filter', async () => {
    const res = await request(app)
      .get('/api/users?role=agent')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].email).toBe('agent@usermgmt.com');
  });

  it('PUT /api/users/:id updates role, working hours, and capacity', async () => {
    const res = await request(app)
      .put(`/api/users/${agentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        role: 'sales_manager',
        team: 'Luxury Highrise',
        leadCapacity: 80,
        workingHours: {
          start: '08:30',
          end: '17:30',
          timezone: 'Asia/Kolkata',
          days: [1, 2, 3, 4, 5],
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role).toBe('sales_manager');
    expect(res.body.data.team).toBe('Luxury Highrise');
    expect(res.body.data.leadCapacity).toBe(80);
    expect(res.body.data.workingHours.start).toBe('08:30');
  });

  it('prevents demoting or deleting the last active company administrator', async () => {
    // Attempt to demote the only company_admin
    const demoteRes = await request(app)
      .put(`/api/users/${adminId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'agent' });

    expect(demoteRes.status).toBe(500);
    expect(demoteRes.body.error.message).toContain('last active company administrator');

    // Attempt to delete the only company_admin
    const deleteRes = await request(app)
      .delete(`/api/users/${adminId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deleteRes.status).toBe(500);
    expect(deleteRes.body.error.message).toContain('last remaining company administrator');
  });

  it('POST /api/users/:id/reset-2fa resets user two-factor state', async () => {
    const res = await request(app)
      .post(`/api/users/${agentId}/reset-2fa`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('Two-factor authentication has been reset');
  });

  it('blocks regular agents from accessing user management routes with 403', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${agentToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_PERMISSION');
  });
});
