import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { companies, users } from '../../src/db/schema/index.js';

describe('User Invitations & Tokenized Acceptance Lifecycle', () => {
  const app = createApp();
  const companyId = '99999999-9999-9999-9999-999999999931';
  const adminId = '00000000-0000-0000-0000-000000000311';

  const adminToken = signAccessToken({
    sub: adminId,
    companyId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@invitest.com',
    name: 'Invite Admin',
  });

  beforeAll(async () => {
    await cleanupTestDatabase([companyId]);

    await testDb
      .insert(companies)
      .values({
        id: companyId,
        name: 'Invitations Realty',
        slug: 'invitations-realty',
        plan: 'starter',
        status: 'active',
      })
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values({
        id: adminId,
        companyId,
        name: 'Admin',
        email: 'admin@invitest.com',
        role: 'company_admin',
        status: 'active',
        passwordHash: 'dummy',
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  let rawInviteToken = '';

  it('POST /api/users/invite creates secure invitation and returns inviteUrl', async () => {
    const res = await request(app)
      .post('/api/users/invite')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'newagent@invitest.com',
        role: 'agent',
        team: 'Residential Sales',
        leadCapacity: 35,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('newagent@invitest.com');
    expect(res.body.data.inviteUrl).toBeDefined();

    // Extract raw token from inviteUrl
    const url = new URL(res.body.data.inviteUrl);
    rawInviteToken = url.searchParams.get('token')!;
    expect(rawInviteToken).toBeTruthy();
  });

  it('rejects duplicate invitation if user already exists in company', async () => {
    const res = await request(app)
      .post('/api/users/invite')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'admin@invitest.com', // Already registered
        role: 'agent',
      });

    expect(res.status).toBe(500);
    expect(res.body.error.message).toContain('already exists');
  });

  it('GET /api/users/invitations lists pending invitations', async () => {
    const res = await request(app)
      .get('/api/users/invitations')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].email).toBe('newagent@invitest.com');
  });

  it('POST /api/users/accept-invite creates active user and returns token pair', async () => {
    const res = await request(app)
      .post('/api/users/accept-invite')
      .send({
        token: rawInviteToken,
        name: 'Karan Mehra',
        password: 'Password123!',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.name).toBe('Karan Mehra');
    expect(res.body.data.user.email).toBe('newagent@invitest.com');
    expect(res.body.data.user.status).toBe('active');
    expect(res.body.data.tokens.accessToken).toBeDefined();
    expect(res.body.data.tokens.refreshToken).toBeDefined();
  });

  it('rejects reuse of already accepted invitation token', async () => {
    const res = await request(app)
      .post('/api/users/accept-invite')
      .send({
        token: rawInviteToken,
        name: 'Imposter User',
        password: 'Password123!',
      });

    expect(res.status).toBe(500);
    expect(res.body.error.message).toContain('Invalid or expired invitation token');
  });
});
