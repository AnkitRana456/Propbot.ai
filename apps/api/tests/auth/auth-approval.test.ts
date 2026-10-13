import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { createApp } from '../../src/server.js';
import { cleanupTestDatabase } from '../helpers/test-db.js';
import { createAuthenticatedUser, createTestUser } from '../helpers/test-fixtures.js';

describe('User Approval Queue & Onboarding Tests (PDF Requirement)', () => {
  const app = createApp();
  const createdCompanyIds: string[] = [];

  let adminAuthHeader: string;
  let agentAuthHeader: string;
  let companyId: string;
  let pendingUserId: string;
  const pendingUserEmail = `pending_${crypto.randomBytes(4).toString('hex')}@agency.com`;
  const pendingUserPassword = 'PendingUserP@ss123!';

  beforeAll(async () => {
    // 1. Create company and company_admin
    const adminSession = await createAuthenticatedUser('company_admin');
    companyId = adminSession.company.id;
    adminAuthHeader = adminSession.authHeader;
    createdCompanyIds.push(companyId);

    // 2. Create an agent in the same company
    const agentSession = await createAuthenticatedUser('agent', { id: companyId });
    agentAuthHeader = agentSession.authHeader;

    // 3. Create a user joining the company who is pending approval
    const pendingUser = await createTestUser(companyId, {
      name: 'Priya Candidate',
      email: pendingUserEmail,
      role: 'agent',
      status: 'pending_approval',
      rawPassword: pendingUserPassword,
    });
    pendingUserId = pendingUser.id;
  });

  afterAll(async () => {
    await cleanupTestDatabase(createdCompanyIds);
  });

  it('prevents pending users from logging in until approved', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: pendingUserEmail,
      password: pendingUserPassword,
    });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_PENDING_APPROVAL');
  });

  it('allows company_admin to list pending users', async () => {
    const res = await request(app)
      .get('/api/auth/users/pending')
      .set('Authorization', adminAuthHeader);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    const found = res.body.data.find((u: { id: string }) => u.id === pendingUserId);
    expect(found).toBeDefined();
    expect(found.status).toBe('pending_approval');
  });

  it('forbids non-admin roles (agent) from accessing the pending approval queue', async () => {
    const res = await request(app)
      .get('/api/auth/users/pending')
      .set('Authorization', agentAuthHeader);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
  });

  it('allows company_admin to approve a pending user', async () => {
    const res = await request(app)
      .post(`/api/auth/users/${pendingUserId}/approve`)
      .set('Authorization', adminAuthHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(pendingUserId);
    expect(res.body.data.status).toBe('active');
  });

  it('allows the newly approved user to log in successfully', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: pendingUserEmail,
      password: pendingUserPassword,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.user.status).toBe('active');
    expect(res.body.data.tokens).toHaveProperty('accessToken');
  });

  it('allows company_admin to reject/disable an account', async () => {
    const res = await request(app)
      .post(`/api/auth/users/${pendingUserId}/reject`)
      .set('Authorization', adminAuthHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('disabled');

    // Login must now be rejected with ACCOUNT_DISABLED
    const loginRes = await request(app).post('/api/auth/login').send({
      email: pendingUserEmail,
      password: pendingUserPassword,
    });

    expect(loginRes.status).toBe(403);
    expect(loginRes.body.error.code).toBe('ACCOUNT_DISABLED');
  });
});
