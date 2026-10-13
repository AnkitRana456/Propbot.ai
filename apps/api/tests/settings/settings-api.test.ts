import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { companies, users } from '../../src/db/schema/index.js';

describe('Agency & Company Settings API', () => {
  const app = createApp();
  const companyId = '99999999-9999-9999-9999-999999999935';
  const adminId = '00000000-0000-0000-0000-000000000351';

  const adminToken = signAccessToken({
    sub: adminId,
    companyId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@settingstest.com',
    name: 'Settings Admin',
  });

  beforeAll(async () => {
    await cleanupTestDatabase([companyId]);

    await testDb
      .insert(companies)
      .values({
        id: companyId,
        name: 'Settings Realty Ltd',
        slug: 'settings-realty',
        plan: 'enterprise',
        status: 'active',
      })
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values({
        id: adminId,
        companyId,
        name: 'Admin',
        email: 'admin@settingstest.com',
        role: 'company_admin',
        status: 'active',
        passwordHash: 'dummy',
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  it('GET /api/settings returns company, operations, AI controls, and security bundle', async () => {
    const res = await request(app)
      .get('/api/settings')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.company.name).toBe('Settings Realty Ltd');
    expect(res.body.data.operations.pipelineStages).toBeDefined();
    expect(res.body.data.aiControls.killSwitch).toBe(false);
  });

  it('PUT /api/settings/profile updates company name and branding', async () => {
    const res = await request(app)
      .put('/api/settings/profile')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Settings Realty International',
        branding: {
          logoUrl: 'https://example.com/logo.png',
          primaryColor: '#1d4ed8',
          secondaryColor: '#4338ca',
          whiteLabel: true,
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Settings Realty International');
    expect(res.body.data.branding.whiteLabel).toBe(true);
  });

  it('PUT /api/settings/operations updates pipeline stages and SLA', async () => {
    const res = await request(app)
      .put('/api/settings/operations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        pipelineStages: ['New', 'Contacted', 'Site Visit', 'Booked'],
        tags: ['Investor', 'HNI'],
        notifications: {
          hotLeadSlaMinutes: 10,
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.settings.pipelineStages).toEqual([
      'New',
      'Contacted',
      'Site Visit',
      'Booked',
    ]);
  });

  it('PUT /api/settings/ai-controls toggles kill switch and updates action cap', async () => {
    const res = await request(app)
      .put('/api/settings/ai-controls')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        killSwitch: true,
        allowedTiers: ['T0', 'T1'],
        dailyActionCap: 250,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.killSwitch).toBe(true);
    expect(res.body.data.dailyActionCap).toBe(250);
  });

  let createdApiKeyId = '';

  it('API Keys Lifecycle: creates, verifies prefix, lists, and revokes key', async () => {
    const createRes = await request(app)
      .post('/api/settings/api-keys')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Zapier Integration Key',
        permissions: ['read', 'write'],
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    expect(createRes.body.data.apiKey).toContain('pb_live_');
    createdApiKeyId = createRes.body.data.id;

    const listRes = await request(app)
      .get('/api/settings/api-keys')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some((k: { id: string }) => k.id === createdApiKeyId)).toBe(true);

    const revokeRes = await request(app)
      .delete(`/api/settings/api-keys/${createdApiKeyId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.message).toContain('revoked');
  });

  it('2FA Setup & Verification: initiates setup and activates TOTP', async () => {
    const setupRes = await request(app)
      .post('/api/settings/security/2fa/setup')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(setupRes.status).toBe(200);
    expect(setupRes.body.data.secret).toBeDefined();
    expect(setupRes.body.data.otpauthUrl).toContain('otpauth://totp/');

    const verifyRes = await request(app)
      .post('/api/settings/security/2fa/verify')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ token: '123456' }); // Dev/test universal token

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);
    expect(verifyRes.body.message).toContain('enabled');

    const disableRes = await request(app)
      .post('/api/settings/security/2fa/disable')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(disableRes.status).toBe(200);
    expect(disableRes.body.message).toContain('disabled');
  });

  it('GET /api/settings/data/export downloads full JSON data export bundle', async () => {
    const res = await request(app)
      .get('/api/settings/data/export')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.header['content-type']).toContain('application/json');
    expect(res.body.metadata.companyId).toBe(companyId);
    expect(res.body.company).toBeDefined();
    expect(res.body.users).toBeDefined();
  });
});
