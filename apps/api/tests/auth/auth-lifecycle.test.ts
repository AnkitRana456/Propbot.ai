import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { createApp } from '../../src/server.js';
import { cleanupTestDatabase } from '../helpers/test-db.js';
import { createTestCompany, createTestUser } from '../helpers/test-fixtures.js';
import { emailStub } from '../../src/modules/auth/email-stub.js';

describe('Auth Lifecycle End-to-End Tests', () => {
  const app = createApp();
  const createdCompanyIds: string[] = [];

  afterAll(async () => {
    await cleanupTestDatabase(createdCompanyIds);
  });

  describe('Registration Flow', () => {
    const rand = crypto.randomBytes(4).toString('hex');
    const validRegistration = {
      companyName: `Lodha Estates ${rand}`,
      companySlug: `lodha-estates-${rand}`,
      adminName: 'Abhishek Lodha',
      adminEmail: `abhishek_${rand}@lodhagroup.com`,
      password: 'StrongAdminP@ss123!',
    };

    it('successfully registers a new company and first administrator', async () => {
      const res = await request(app).post('/api/auth/register').send(validRegistration);

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data).toHaveProperty('company');
      expect(res.body.data).toHaveProperty('tokens');
      expect(res.body.data.user.role).toBe('company_admin');
      expect(res.body.data.user.status).toBe('active');
      expect(res.body.data.company.slug).toBe(validRegistration.companySlug);
      expect(res.body.data.tokens).toHaveProperty('accessToken');
      expect(res.body.data.tokens).toHaveProperty('refreshToken');

      createdCompanyIds.push(res.body.data.company.id);
    });

    it('rejects registration with duplicate company slug', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          ...validRegistration,
          adminEmail: `different_${rand}@lodhagroup.com`,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SLUG_TAKEN');
    });

    it('rejects registration with duplicate admin email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          ...validRegistration,
          companySlug: `different-slug-${rand}`,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_TAKEN');
    });
  });

  describe('Login & Status Verification', () => {
    let companyId: string;
    const testPassword = 'Password123!Secure';
    const rand = crypto.randomBytes(4).toString('hex');

    beforeAll(async () => {
      const company = await createTestCompany({ name: `Login Test ${rand}` });
      companyId = company.id;
      createdCompanyIds.push(companyId);

      // Active user
      await createTestUser(companyId, {
        email: `active_${rand}@test.com`,
        rawPassword: testPassword,
        status: 'active',
      });

      // Pending user
      await createTestUser(companyId, {
        email: `pending_${rand}@test.com`,
        rawPassword: testPassword,
        status: 'pending_approval',
      });

      // Disabled user
      await createTestUser(companyId, {
        email: `disabled_${rand}@test.com`,
        rawPassword: testPassword,
        status: 'disabled',
      });
    });

    it('logs in active user with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: `active_${rand}@test.com`,
          password: testPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.user.status).toBe('active');
      expect(res.body.data.tokens).toHaveProperty('accessToken');
    });

    it('rejects login with incorrect password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: `active_${rand}@test.com`,
          password: 'WrongPassword999!',
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('blocks login for pending_approval accounts (PDF Requirement)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: `pending_${rand}@test.com`,
          password: testPassword,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCOUNT_PENDING_APPROVAL');
    });

    it('blocks login for disabled accounts', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: `disabled_${rand}@test.com`,
          password: testPassword,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
    });
  });

  describe('Refresh Token Rotation & Family Reuse Detection', () => {
    let initialRefreshToken: string;
    let rotatedRefreshToken: string;

    beforeAll(async () => {
      const rand = crypto.randomBytes(4).toString('hex');
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          companyName: `Rotation Test ${rand}`,
          companySlug: `rotation-${rand}`,
          adminName: 'Rohan Developer',
          adminEmail: `rohan_${rand}@example.com`,
          password: 'Password123!Secure',
        });

      initialRefreshToken = res.body.data.tokens.refreshToken;
      createdCompanyIds.push(res.body.data.company.id);
    });

    it('rotates refresh token and issues a new access token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: initialRefreshToken });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
      expect(res.body.data.refreshToken).not.toBe(initialRefreshToken);

      rotatedRefreshToken = res.body.data.refreshToken;
    });

    it('detects token reuse and invalidates the entire token family', async () => {
      // Attempting to reuse the already-consumed initialRefreshToken!
      const reuseRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: initialRefreshToken });

      expect(reuseRes.status).toBe(401);
      expect(reuseRes.body.error.code).toBe('TOKEN_REUSE_DETECTED');

      // The rotated token from the same family must also now be revoked!
      const subsequentRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: rotatedRefreshToken });

      expect(subsequentRes.status).toBe(401);
      expect(subsequentRes.body.error.code).toBe('TOKEN_REUSE_DETECTED');
    });
  });

  describe('Logout & Session Revocation', () => {
    it('revokes refresh token upon logout', async () => {
      const rand = crypto.randomBytes(4).toString('hex');
      const reg = await request(app)
        .post('/api/auth/register')
        .send({
          companyName: `Logout Test ${rand}`,
          companySlug: `logout-${rand}`,
          adminName: 'Logout Admin',
          adminEmail: `logout_${rand}@example.com`,
          password: 'Password123!Secure',
        });

      const { accessToken, refreshToken } = reg.body.data.tokens;
      createdCompanyIds.push(reg.body.data.company.id);

      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken });

      expect(logoutRes.status).toBe(200);

      // Attempting to refresh with the revoked token must fail
      const refreshRes = await request(app).post('/api/auth/refresh').send({ refreshToken });

      expect(refreshRes.status).toBe(401);
    });
  });

  describe('Password Reset Lifecycle', () => {
    it('handles forgot-password, resets password, and revokes previous sessions', async () => {
      const rand = crypto.randomBytes(4).toString('hex');
      const email = `reset_${rand}@example.com`;
      const initialPassword = 'InitialP@ss123!';
      const newPassword = 'NewSecretP@ss456!';

      const reg = await request(app)
        .post('/api/auth/register')
        .send({
          companyName: `Reset Test ${rand}`,
          companySlug: `reset-${rand}`,
          adminName: 'Reset User',
          adminEmail: email,
          password: initialPassword,
        });

      createdCompanyIds.push(reg.body.data.company.id);

      // Spy on email stub to catch token
      let capturedToken = '';
      emailStub.sendPasswordResetEmail = async (_to, token) => {
        capturedToken = token;
      };

      // Request reset
      const forgotRes = await request(app).post('/api/auth/forgot-password').send({ email });

      expect(forgotRes.status).toBe(200);
      expect(capturedToken).toBeTruthy();

      // Reset password with token
      const resetRes = await request(app).post('/api/auth/reset-password').send({
        token: capturedToken,
        newPassword,
      });

      expect(resetRes.status).toBe(200);

      // Old password must fail
      const oldLogin = await request(app)
        .post('/api/auth/login')
        .send({ email, password: initialPassword });
      expect(oldLogin.status).toBe(401);

      // New password must succeed
      const newLogin = await request(app)
        .post('/api/auth/login')
        .send({ email, password: newPassword });
      expect(newLogin.status).toBe(200);
      expect(newLogin.body.data.user.email).toBe(email);
    }, 15000);
  });
});
