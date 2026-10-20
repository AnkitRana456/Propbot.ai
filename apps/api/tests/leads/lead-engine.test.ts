import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { createApp } from '../../src/server.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { createTestCompany } from '../helpers/test-fixtures.js';
import { chatbots, contacts, leads, leadOtps, projects, brochures } from '../../src/db/schema/index.js';
import { leadsService } from '../../src/modules/leads/leads.service.js';
import { otpService, resolveOtpSettings } from '../../src/modules/leads/otp.service.js';

describe('Phase 4: lead engine (Postgres)', () => {
  const app = createApp();
  let companyId: string;
  const sent: { to: string; body: string }[] = [];

  const lastCode = () => /(\d{6})/.exec(sent[sent.length - 1]?.body ?? '')?.[1] ?? '';

  beforeAll(async () => {
    const company = await createTestCompany();
    companyId = company.id;
    otpService.setSender(async (to, body) => {
      sent.push({ to, body });
      return { channel: 'console' };
    });
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  async function makeBot(leadCapture: Record<string, unknown> = {}) {
    const publicKey = `pb_test_${crypto.randomBytes(12).toString('hex')}`;
    const [bot] = await testDb
      .insert(chatbots)
      .values({ companyId, name: 'Engine Bot', type: 'web', status: 'active', publicKey, config: { leadCapture } })
      .returning();
    const session = await request(app)
      .post('/public/session')
      .send({
        publicKey,
        visitorId: `v_${crypto.randomBytes(4).toString('hex')}`,
        utmParams: { utm_source: 'google', utm_agencypartner: 'acme' },
      });
    expect(session.status).toBe(200);
    return {
      botId: bot!.id,
      token: session.body.data.sessionToken as string,
      conversationId: session.body.data.conversationId as string,
    };
  }

  describe('lead capture, validation and de-duplication', () => {
    it('rejects invalid phones with 400 INVALID_PHONE (service and HTTP)', async () => {
      await expect(
        leadsService.captureOrUpdateLead(companyId, { name: 'Bad', phone: '12345' }),
      ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_PHONE' });

      const s = await makeBot();
      const res = await request(app)
        .post('/public/lead')
        .set('Authorization', `Bearer ${s.token}`)
        .send({ fullName: 'Bad Phone', phone: '5876543210', conversationId: s.conversationId });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PHONE');
    });

    it('is race-safe: 6 parallel submits create exactly one contact + lead and count every visit', async () => {
      const s = await makeBot();
      const phone = '9810000001';
      const results = await Promise.all(
        Array.from({ length: 6 }, () =>
          leadsService.captureOrUpdateLead(companyId, { chatbotId: s.botId, name: 'Race Runner', phone }),
        ),
      );
      expect(new Set(results.map(r => r.lead.id)).size).toBe(1);
      expect(results.filter(r => !r.isDuplicate)).toHaveLength(1);

      const contactRows = await testDb
        .select()
        .from(contacts)
        .where(and(eq(contacts.companyId, companyId), eq(contacts.phone, '+919810000001')));
      expect(contactRows).toHaveLength(1);
      const leadRows = await testDb
        .select()
        .from(leads)
        .where(and(eq(leads.chatbotId, s.botId), eq(leads.contactId, contactRows[0]!.id)));
      expect(leadRows).toHaveLength(1);
      expect(leadRows[0]!.visitCount).toBe(6);
    });

    it('matches on email, refreshes name/phone, and stores UTM + IP + user agent', async () => {
      const s = await makeBot();
      const first = await leadsService.captureOrUpdateLead(companyId, {
        chatbotId: s.botId,
        name: 'Anita Rao',
        phone: '9820000002',
        email: 'Anita@Example.com',
        utmParams: { utm_source: 'fb' },
        ipAddress: '203.0.113.9',
        userAgent: 'UnitTest/1.0',
      });
      const again = await leadsService.captureOrUpdateLead(companyId, {
        chatbotId: s.botId,
        name: 'Anita R. Rao',
        phone: '9820000003',
        email: 'anita@example.com',
        utmParams: { utm_medium: 'cpc' },
      });
      expect(again.isDuplicate).toBe(true);
      expect(again.lead.id).toBe(first.lead.id);
      expect(again.lead.phone).toBe('+919820000003');
      expect(again.lead.name).toBe('Anita R. Rao');

      const [row] = await testDb.select().from(leads).where(eq(leads.id, first.lead.id));
      expect(row!.visitCount).toBe(2);
      expect(row!.utmParams).toMatchObject({ utm_source: 'fb', utm_medium: 'cpc' });
      expect(row!.ipAddress).toBe('203.0.113.9');
      expect(row!.userAgent).toBe('UnitTest/1.0');
    });

    it('saves session UTMs (incl. sub_source / agencypartner) on the lead captured over HTTP', async () => {
      const s = await makeBot();
      const res = await request(app)
        .post('/public/lead')
        .set('Authorization', `Bearer ${s.token}`)
        .set('User-Agent', 'WidgetTest/2.0')
        .send({
          fullName: 'Utm Person',
          phone: '9830000004',
          conversationId: s.conversationId,
          utmParams: { utm_sub_source: 'newsletter', utm_bogus: 'dropped' },
        });
      expect(res.status).toBe(200);
      const [row] = await testDb.select().from(leads).where(eq(leads.chatbotId, s.botId));
      expect(row!.utmParams).toEqual({
        utm_source: 'google',
        utm_agencypartner: 'acme',
        utm_sub_source: 'newsletter',
      });
      expect(row!.userAgent).toBe('WidgetTest/2.0');
    });

    it('requires email only when requireEmail is true', async () => {
      const strict = await makeBot({ requireEmail: true });
      const no = await request(app)
        .post('/public/lead')
        .set('Authorization', `Bearer ${strict.token}`)
        .send({ fullName: 'No Email', phone: '9840000005', conversationId: strict.conversationId });
      expect(no.status).toBe(400);
      expect(no.body.error.code).toBe('EMAIL_REQUIRED');

      const relaxed = await makeBot({});
      const ok = await request(app)
        .post('/public/lead')
        .set('Authorization', `Bearer ${relaxed.token}`)
        .send({ fullName: 'No Email', phone: '9840000006', conversationId: relaxed.conversationId });
      expect(ok.status).toBe(200);
    });
  });

  describe('SMS OTP', () => {
    beforeEach(() => {
      sent.length = 0;
    });

    const otpCfg = { otpSettings: { enabled: true, expiryMinutes: 5, maxAttempts: 3, resendCooldownSeconds: 30 } };
    const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

    it('blocks lead submission until the OTP is verified, then marks the lead verified', async () => {
      const s = await makeBot(otpCfg);
      const phone = '9850000007';
      const body = { fullName: 'Otp User', phone, conversationId: s.conversationId };

      const blocked = await request(app).post('/public/lead').set(auth(s.token)).send(body);
      expect(blocked.status).toBe(403);
      expect(blocked.body.error.code).toBe('OTP_REQUIRED');

      const send = await request(app).post('/public/otp/send').set(auth(s.token)).send({ phone });
      expect(send.status).toBe(200);
      expect(send.body.data.expiresInSeconds).toBe(300);
      expect(JSON.stringify(send.body)).not.toMatch(/\d{6}/);
      expect(sent[0]!.to).toBe('+919850000007');

      const real = lastCode();
      const wrong = await request(app)
        .post('/public/otp/verify')
        .set(auth(s.token))
        .send({ phone, code: real === '000000' ? '111111' : '000000' });
      expect(wrong.status).toBe(400);
      expect(wrong.body.error.code).toBe('OTP_INVALID');

      const ok = await request(app).post('/public/otp/verify').set(auth(s.token)).send({ phone, code: real });
      expect(ok.status).toBe(200);

      const lead = await request(app).post('/public/lead').set(auth(s.token)).send(body);
      expect(lead.status).toBe(200);
      const [row] = await testDb.select().from(leads).where(eq(leads.chatbotId, s.botId));
      expect(row!.phoneVerified).toBe(true);
    });

    it('enforces the resend cooldown', async () => {
      const s = await makeBot(otpCfg);
      const phone = '9850000008';
      const a = await request(app).post('/public/otp/send').set(auth(s.token)).send({ phone });
      expect(a.status).toBe(200);
      const b = await request(app).post('/public/otp/send').set(auth(s.token)).send({ phone });
      expect(b.status).toBe(429);
      expect(b.body.error.code).toBe('OTP_COOLDOWN');
    });

    it('purges the record after maxAttempts wrong guesses, even for the right code afterwards', async () => {
      const s = await makeBot(otpCfg);
      const phone = '9850000009';
      await request(app).post('/public/otp/send').set(auth(s.token)).send({ phone });
      const real = lastCode();
      const bad = real === '123456' ? '654321' : '123456';
      const codes: string[] = [];
      for (let i = 0; i < 3; i++) {
        const r = await request(app).post('/public/otp/verify').set(auth(s.token)).send({ phone, code: bad });
        codes.push(r.body.error.code);
      }
      expect(codes).toEqual(['OTP_INVALID', 'OTP_INVALID', 'OTP_LOCKED']);
      const rows = await testDb
        .select()
        .from(leadOtps)
        .where(and(eq(leadOtps.chatbotId, s.botId), eq(leadOtps.phone, '+919850000009')));
      expect(rows).toHaveLength(0);
      const late = await request(app).post('/public/otp/verify').set(auth(s.token)).send({ phone, code: real });
      expect(late.status).toBe(400);
      expect(late.body.error.code).toBe('OTP_NOT_FOUND');
    });

    it('rejects expired codes and the purge job removes them', async () => {
      const s = await makeBot(otpCfg);
      const phone = '9850000010';
      await request(app).post('/public/otp/send').set(auth(s.token)).send({ phone });
      const code = lastCode();
      await testDb
        .update(leadOtps)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(leadOtps.chatbotId, s.botId));
      const res = await request(app).post('/public/otp/verify').set(auth(s.token)).send({ phone, code });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('OTP_EXPIRED');

      await request(app).post('/public/otp/send').set(auth(s.token)).send({ phone: '9850000011' });
      await testDb
        .update(leadOtps)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(leadOtps.chatbotId, s.botId));
      expect(await otpService.purgeExpired()).toBeGreaterThanOrEqual(1);
    });

    it('resolveOtpSettings clamps values', () => {
      expect(resolveOtpSettings({ enabled: true, expiryMinutes: 999, maxAttempts: 0 })).toMatchObject({
        enabled: true,
        expiryMinutes: 30,
        maxAttempts: 1,
      });
    });
  });

  describe('brochure gating', () => {
    it('withholds the link without lead capture, then releases it and updates counters', async () => {
      const s = await makeBot({ requireLeadCapture: true });
      const [project] = await testDb
        .insert(projects)
        .values({ companyId, name: 'Tower A', builderName: 'ACME', location: 'Pune' })
        .returning();
      const [brochure] = await testDb
        .insert(brochures)
        .values({
          companyId,
          projectId: project!.id,
          title: 'Tower A Brochure',
          fileUrl: 'https://cdn.example.com/a.pdf',
          isGated: false,
        })
        .returning();
      const auth = { Authorization: `Bearer ${s.token}` };

      const denied = await request(app)
        .post('/public/brochure')
        .set(auth)
        .send({ brochureId: brochure!.id, fullName: 'Only Name' });
      expect(denied.status).toBe(403);
      expect(denied.body.error.code).toBe('LEAD_CAPTURE_REQUIRED');
      expect(JSON.stringify(denied.body)).not.toContain('cdn.example.com');

      const buyer = { brochureId: brochure!.id, fullName: 'Brochure Buyer', phone: '9860000012', email: 'b@example.com' };
      const ok = await request(app).post('/public/brochure').set(auth).set('User-Agent', 'BrochureTest/1.0').send(buyer);
      expect(ok.status).toBe(200);
      expect(ok.body.data.downloadUrl).toBe('https://cdn.example.com/a.pdf');

      const [row] = await testDb.select().from(leads).where(eq(leads.chatbotId, s.botId));
      expect(row!.source).toBe('brochure_download');
      expect(row!.userAgent).toBe('BrochureTest/1.0');
      expect(row!.ipAddress).toBeTruthy();
      const [bot] = await testDb.select().from(chatbots).where(eq(chatbots.id, s.botId));
      expect(bot!.totalLeads).toBe(1);
      expect(bot!.brochureDownloads).toBe(1);

      const again = await request(app).post('/public/brochure').set(auth).send(buyer);
      expect(again.status).toBe(200);
      const [bot2] = await testDb.select().from(chatbots).where(eq(chatbots.id, s.botId));
      expect(bot2!.totalLeads).toBe(1);
      expect(bot2!.brochureDownloads).toBe(2);
    });
  });

  describe('invalid-lead cleanup route', () => {
    it('401s without CRON_SECRET or admin, and cleans with the secret', async () => {
      process.env.CRON_SECRET = 'test-cron-secret-value';
      try {
        const none = await request(app).post('/api/leads/cleanup-invalid');
        expect(none.status).toBe(401);
        const wrong = await request(app).post('/api/leads/cleanup-invalid').set('Authorization', 'Bearer nope');
        expect(wrong.status).toBe(401);
        const ok = await request(app)
          .post('/api/leads/cleanup-invalid')
          .set('Authorization', 'Bearer test-cron-secret-value');
        expect(ok.status).toBe(200);
        expect(ok.body.data).toHaveProperty('cleaned');
      } finally {
        delete process.env.CRON_SECRET;
      }
    });
  });
});
