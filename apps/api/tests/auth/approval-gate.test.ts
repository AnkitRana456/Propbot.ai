import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { createApp } from '../../src/server.js';
import { cleanupTestDatabase } from '../helpers/test-db.js';
import { createAuthenticatedUser } from '../helpers/test-fixtures.js';
import { PENDING_APPROVAL_MESSAGE } from '../../src/modules/auth/auth.service.js';

describe('Phase 3: approval gate, role escalation, auth rate limit', () => {
  const app = createApp();
  const companyIds: string[] = [];

  afterAll(async () => {
    delete process.env.SIGNUP_AUTO_APPROVE;
    await cleanupTestDatabase(companyIds);
  });

  it('locks new registrations until approved, and rejects login with the spec message', async () => {
    process.env.SIGNUP_AUTO_APPROVE = 'false';
    const rand = crypto.randomBytes(4).toString('hex');
    const body = {
      companyName: `Gate Test ${rand}`,
      companySlug: `gate-test-${rand}`,
      adminName: 'Gate Admin',
      adminEmail: `gate_${rand}@example.com`,
      password: 'StrongAdminP@ss123!',
    };

    const reg = await request(app).post('/api/auth/register').send(body);
    expect(reg.status).toBe(201);
    companyIds.push(reg.body.data.company.id);
    expect(reg.body.data.user.status).toBe('pending_approval');
    expect(reg.body.data.tokens).toBeNull();
    expect(reg.body.data.pendingApproval).toBe(true);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: body.adminEmail, password: body.password });
    expect(login.status).toBe(403);
    expect(login.body.error.message).toBe(PENDING_APPROVAL_MESSAGE);

    // Wrong password must not reveal that the account exists but is pending
    const wrong = await request(app)
      .post('/api/auth/login')
      .send({ email: body.adminEmail, password: 'definitely-wrong-1!' });
    expect(wrong.status).toBe(401);
  });

  it('does not let a company admin grant or touch the ps-owner role', async () => {
    const admin = await createAuthenticatedUser('company_admin');
    companyIds.push(admin.company.id);
    const peer = await createAuthenticatedUser('agent', { id: admin.company.id } as never);

    const res = await request(app)
      .put(`/api/users/${peer.user.id}`)
      .set('Authorization', admin.authHeader)
      .send({ role: 'ps-owner' });
    expect(res.status).toBe(403);

    const invite = await request(app)
      .post('/api/users/invite')
      .set('Authorization', admin.authHeader)
      .send({ email: `x_${crypto.randomBytes(3).toString('hex')}@example.com`, role: 'ps-owner' });
    expect(invite.status).toBe(403);
  });

  it('rate-limits login to 5 attempts per window with HTTP 429', async () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      const limited = createApp();
      let last = 0;
      for (let i = 0; i < 6; i++) {
        const r = await request(limited)
          .post('/api/auth/login')
          .set('X-Forwarded-For', `10.9.${i}.1`) // must NOT bypass the limiter
          .send({ email: 'nobody@example.com', password: 'wrong-password-1!' });
        last = r.status;
        if (i < 5) expect(r.status).not.toBe(429);
      }
      expect(last).toBe(429);
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });
});
