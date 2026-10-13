import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { createApp } from '../../src/server.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import {
  companies,
  users,
  apiKeys,
  companySsoConfigs,
  auditLogs,
} from '../../src/db/schema/index.js';
import { signAccessToken, hashPassword } from '../../src/modules/auth/auth.utils.js';
import { eq } from 'drizzle-orm';

describe('Phase 15C: Enterprise Security, SSO & Compliance', () => {
  const app = createApp();

  const companyAId = 'ea000000-0000-0000-0000-000000000001';
  const companyBId = 'ea000000-0000-0000-0000-000000000002';
  const userAId = 'ea000000-0000-0000-0000-000000000011';

  const tokenA = signAccessToken({
    sub: userAId,
    companyId: companyAId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@enterpriserealty.com',
    name: 'Enterprise Admin',
  });

  let oldApiKeyId: string;
  let rawOldApiKey: string;

  beforeAll(async () => {
    await cleanupTestDatabase([companyAId, companyBId]);

    // Create enterprise company A
    await testDb.insert(companies).values([
      {
        id: companyAId,
        name: 'Enterprise Realty Corp',
        slug: 'enterprise-realty',
        plan: 'enterprise',
        status: 'active',
        settings: { enforce2FA: false },
      },
      {
        id: companyBId,
        name: 'Standard Realty',
        slug: 'standard-realty',
        plan: 'growth',
        status: 'active',
      },
    ]);

    // Create user A
    const passwordHash = await hashPassword('SecurePass123!');
    await testDb.insert(users).values({
      id: userAId,
      companyId: companyAId,
      email: 'admin@enterpriserealty.com',
      passwordHash,
      role: 'company_admin',
      name: 'Enterprise Admin',
      status: 'active',
      twoFactorEnabled: false,
    });

    // Create initial API key for rotation test
    const rawSecret = 'rotatetestsecret12345678901234567890';
    const keyPrefix = 'pb_live_rot01';
    rawOldApiKey = `${keyPrefix}_${rawSecret}`;
    const keyHash = crypto.createHash('sha256').update(rawOldApiKey).digest('hex');

    const [key] = await testDb
      .insert(apiKeys)
      .values({
        companyId: companyAId,
        name: 'Key To Rotate',
        keyPrefix,
        keyHash,
        permissions: ['mcp:read'],
      })
      .returning();
    oldApiKeyId = key!.id;

    // Seed an audit log entry
    await testDb.insert(auditLogs).values({
      companyId: companyAId,
      userId: userAId,
      action: 'company_created',
      resourceType: 'company',
      resourceId: companyAId,
      details: { name: 'Enterprise Realty Corp' },
    });
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyAId, companyBId]);
  });

  describe('15.14 Enterprise SSO (SAML 2.0 / OIDC)', () => {
    it('configures enterprise SSO settings and domain mapping', async () => {
      const res = await request(app)
        .post('/api/enterprise/sso')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          ssoProvider: 'okta',
          domain: 'enterpriserealty.com',
          issuer: 'https://enterpriserealty.okta.com',
          ssoUrl: 'https://enterpriserealty.okta.com/app/sso/saml',
          certificate: '-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIJAL0...\n-----END CERTIFICATE-----',
          isEnforced: true,
          isActive: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.ssoProvider).toBe('okta');
      expect(res.body.data.domain).toBe('enterpriserealty.com');
      expect(res.body.data.isEnforced).toBe(true);

      // Verify DB persistence
      const [config] = await testDb
        .select()
        .from(companySsoConfigs)
        .where(eq(companySsoConfigs.companyId, companyAId));

      expect(config).toBeDefined();
      expect(config!.domain).toBe('enterpriserealty.com');
    });

    it('returns SSO login URL for configured enterprise domain', async () => {
      const res = await request(app)
        .get('/api/enterprise/sso/login?domain=enterpriserealty.com');

      expect(res.status).toBe(200);
      expect(res.body.data.redirectUrl).toContain('https://enterpriserealty.okta.com');
      expect(res.body.data.provider).toBe('okta');
    });

    it('blocks password login when SSO is enforced for the organization', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@enterpriserealty.com',
          password: 'SecurePass123!',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('SSO_ENFORCED');
    });

    it('processes SSO callback, auto-provisions user, and issues authenticated token', async () => {
      const res = await request(app)
        .post('/api/enterprise/sso/callback')
        .send({
          domain: 'enterpriserealty.com',
          email: 'agent.sso@enterpriserealty.com',
          name: 'Sarah Connor',
          assertion: 'mock_saml_assertion_payload_base64',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe('agent.sso@enterpriserealty.com');
      expect(res.body.data.companyId).toBe(companyAId);

      // Verify user was provisioned in database
      const [newUser] = await testDb
        .select()
        .from(users)
        .where(eq(users.email, 'agent.sso@enterpriserealty.com'));

      expect(newUser).toBeDefined();
      expect(newUser!.companyId).toBe(companyAId);
    });
  });

  describe('2FA Enforcement Policy', () => {
    it('requires 2FA setup when enterprise company enforces 2FA policy', async () => {
      // Disable SSO enforcement so password check runs, enable 2FA policy
      await testDb
        .update(companySsoConfigs)
        .set({ enforceForDomain: false })
        .where(eq(companySsoConfigs.companyId, companyAId));

      await testDb
        .update(companies)
        .set({ settings: { enforce2FA: true } })
        .where(eq(companies.id, companyAId));

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@enterpriserealty.com',
          password: 'SecurePass123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.requires2faSetup).toBe(true);
      expect(res.body.message).toContain('enforces Two-Factor Authentication');
    });
  });

  describe('Secrets & API Key Rotation', () => {
    it('rotates API key with zero-downtime and 24-hour grace window', async () => {
      const res = await request(app)
        .post(`/api/enterprise/api-keys/${oldApiKeyId}/rotate`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.newKeyId).toBeDefined();
      expect(res.body.data.newApiKey).toBeDefined();
      expect(res.body.data.gracePeriodEndsAt).toBeDefined();

      // Verify that old key still authenticates during the 24-hour grace window
      const mcpRes = await request(app)
        .get('/api/mcp/tools')
        .set('Authorization', `Bearer ${rawOldApiKey}`);

      expect(mcpRes.status).toBe(200);
      expect(mcpRes.headers['x-api-key-deprecated']).toBe('true');
    });
  });

  describe('Audit Log Export', () => {
    it('exports audit logs as JSON stream', async () => {
      const res = await request(app)
        .get('/api/enterprise/audit-logs/export?format=json')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('exports audit logs as CSV format', async () => {
      const res = await request(app)
        .get('/api/enterprise/audit-logs/export?format=csv')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('id,action,resourceType');
    });
  });

  describe('IP Allowlist Guard', () => {
    it('blocks request when client IP is not in configured allowlist', async () => {
      // Set IP allowlist to restricted IP
      await testDb
        .update(companies)
        .set({ settings: { ipAllowlist: ['198.51.100.10'] } })
        .where(eq(companies.id, companyAId));

      const res = await request(app)
        .get('/api/enterprise/sso')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('X-Forwarded-For', '203.0.113.195');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('IP_RESTRICTED');

      // Request from allowed IP succeeds
      const resAllowed = await request(app)
        .get('/api/enterprise/sso')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('X-Forwarded-For', '198.51.100.10');

      expect(resAllowed.status).toBe(200);

      // Clean up allowlist
      await testDb
        .update(companies)
        .set({ settings: { ipAllowlist: [] } })
        .where(eq(companies.id, companyAId));
    });
  });

  describe('Public SLA / Status Page & Security Questionnaire Pack', () => {
    it('returns real-time system status and 99.9% uptime SLA report', async () => {
      const res = await request(app).get('/api/status/uptime');

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('all_systems_operational');
      expect(res.body.data.sla.target).toBe('99.90%');
      expect(res.body.data.components.length).toBeGreaterThanOrEqual(4);
    });

    it('returns structured SOC 2 / ISO 27001 security questionnaire pack', async () => {
      const res = await request(app).get('/api/enterprise/security-pack');

      expect(res.status).toBe(200);
      expect(res.body.data.certifications).toContain('SOC 2 Type II Compliant');
      expect(res.body.data.qaList.length).toBeGreaterThanOrEqual(5);

      const rlsAnswer = res.body.data.qaList.find((q: any) =>
        q.question.includes('tenant data'),
      );
      expect(rlsAnswer).toBeDefined();
      expect(rlsAnswer!.answer).toContain('Row-Level Security');
    });
  });
});
