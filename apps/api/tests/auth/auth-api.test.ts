import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { emailStub } from '../../src/modules/auth/email-stub.js';

describe('Auth API Routes', () => {
  const app = createApp();

  describe('Validation & Public Endpoints', () => {
    it('rejects registration with missing or invalid fields', async () => {
      const res = await request(app).post('/api/auth/register').send({
        companyName: '',
        adminEmail: 'not-an-email',
      });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects login with missing password', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'admin@example.com',
        password: '',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 501 Not Implemented for unconfigured Google OAuth', async () => {
      const res = await request(app).get('/api/auth/google');
      expect(res.status).toBe(501);
      expect(res.body.error.code).toBe('OAUTH_NOT_CONFIGURED');
    });

    it('blocks access to /api/auth/me without bearer token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('handles forgot-password and triggers email stub', async () => {
      const testEmail = 'lead-broker@example.com';
      await emailStub.sendPasswordResetEmail(testEmail, 'test-reset-token-12345');

      const dispatched = emailStub.getLastDispatchedToken?.(testEmail);
      expect(dispatched).toBe('test-reset-token-12345');
    });
  });
});
