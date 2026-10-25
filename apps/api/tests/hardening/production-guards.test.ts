import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import nodemailer from 'nodemailer';
import { eq } from 'drizzle-orm';
import { productionProblems, validateEnv } from '../../src/config/env.js';
import { simulationAllowed } from '../../src/utils/simulation.js';
import { whatsappAdapter } from '../../src/modules/whatsapp/whatsapp.adapter.js';
import { emailChannelAdapter } from '../../src/modules/integrations/email.adapter.js';
import { setMailTransport } from '../../src/modules/delivery/mailer.js';
import { channelsService } from '../../src/modules/inbox/channels.service.js';
import { whatsappService } from '../../src/modules/whatsapp/whatsapp.service.js';
import { ExotelTelephonyProvider } from '../../src/modules/voice/providers/exotel-telephony.provider.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { createAuthenticatedUser } from '../helpers/test-fixtures.js';
import { whatsappConfigs } from '../../src/db/schema/index.js';

const saved = { ...process.env };
const asProduction = () => {
  process.env.NODE_ENV = 'production';
  delete process.env.ALLOW_SIMULATED_PROVIDERS;
};

describe('production hardening', () => {
  let companyId = '';
  let userId = '';

  beforeAll(async () => {
    const a = await createAuthenticatedUser('company_admin');
    companyId = a.company.id;
    userId = a.user.id;
  });
  afterEach(() => {
    process.env = { ...saved };
    vi.restoreAllMocks();
    setMailTransport(null);
  });
  afterAll(async () => {
    process.env = { ...saved };
    await cleanupTestDatabase([companyId]);
  });

  describe('configuration', () => {
    const good = {
      NODE_ENV: 'production',
      API_URL: 'https://api.example.com',
      WEB_URL: 'https://app.example.com',
      DATABASE_URL: 'postgresql://u:p@db:5432/x',
      JWT_ACCESS_SECRET: 'a'.repeat(40),
      JWT_REFRESH_SECRET: 'b'.repeat(40),
      ENCRYPTION_KEY: 'c'.repeat(64),
      CORS_ORIGIN: 'https://app.example.com',
      SMTP_HOST: 'smtp.example.com',
    };

    it('accepts a sound production setup', () => {
      expect(() => validateEnv(good)).not.toThrow();
    });

    it('refuses wildcard CORS, short or equal JWT secrets and mock switches', () => {
      expect(() => validateEnv({ ...good, CORS_ORIGIN: '*' })).toThrow(/CORS_ORIGIN/);
      expect(() => validateEnv({ ...good, CORS_ORIGIN: undefined })).toThrow(/CORS_ORIGIN/);
      expect(() => validateEnv({ ...good, JWT_ACCESS_SECRET: 'short-but-16-chars' })).toThrow(/at least 32/);
      expect(() => validateEnv({ ...good, JWT_REFRESH_SECRET: good.JWT_ACCESS_SECRET })).toThrow(/must be different/);
      expect(() => validateEnv({ ...good, ALLOW_OFFLINE_MOCK: 'true' })).toThrow(/ALLOW_OFFLINE_MOCK/);
      expect(() => validateEnv({ ...good, ALLOW_UNSIGNED_WHATSAPP_WEBHOOKS: 'true' })).toThrow(/UNSIGNED/);
    });

    it('lists every problem at once', () => {
      const parsed = validateEnv({ ...good, NODE_ENV: 'test' });
      expect(productionProblems({}, { ...parsed, CORS_ORIGIN: undefined, ENCRYPTION_KEY: undefined }).length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('simulated providers', () => {
    it('are allowed in tests and refused in production unless a staging flag is set', () => {
      expect(simulationAllowed()).toBe(true);
      asProduction();
      expect(simulationAllowed()).toBe(false);
      process.env.ALLOW_SIMULATED_PROVIDERS = 'true';
      expect(simulationAllowed()).toBe(true);
    });

    it('WhatsApp does not pretend to send in production', async () => {
      asProduction();
      const r = await whatsappAdapter.send(companyId, '+919800000000', { type: 'text', text: 'Hi' });
      expect(r.success).toBe(false);
      expect(r.error).toMatch(/not connected/);
    });

    it('e-mail sends through SMTP, and fails honestly without it in production', async () => {
      asProduction();
      delete process.env.SMTP_HOST;
      expect((await emailChannelAdapter.send(companyId, 'buyer@example.com', { type: 'text', text: 'Hello' })).success).toBe(false);
      setMailTransport(nodemailer.createTransport({ jsonTransport: true }));
      const ok = await emailChannelAdapter.send(companyId, 'buyer@example.com', { type: 'text', text: 'Your visit\nSee you on Saturday' });
      expect(ok).toMatchObject({ success: true, provider: 'smtp' });
    });

    it('refuses phone calls without Exotel keys in production', async () => {
      asProduction();
      delete process.env.EXOTEL_API_KEY;
      await expect(
        new ExotelTelephonyProvider().initiateCall({ companyId, leadId: companyId, to: '+919800000000', from: '+918000000000', callbackUrl: 'https://x.example/cb' }),
      ).rejects.toMatchObject({ code: 'PROVIDER_NOT_CONFIGURED' });
    });
  });

  describe('WhatsApp templates and secrets', () => {
    const input = {
      name: 'visit_followup',
      language: 'en',
      category: 'utility' as const,
      content: { body: 'Hi {{1}}, thanks for visiting {{2}}.', buttons: [] },
      sampleValues: ['Asha', 'Lakeside'],
    };

    it('stores the access token and app secret encrypted, and still shows a mask', async () => {
      const cfg = await whatsappService.updateConfig(companyId, {
        phoneNumberId: '1234567890',
        businessAccountId: 'waba_1',
        businessPhoneNumber: '+919800000001',
        accessToken: 'EAAG-real-looking-token-0001',
        appSecret: 'app-secret-0001',
        templateName: 'property_inquiry_details',
        enableAutomation: true,
        aiAutoReplies: true,
        pauseAfterAgentReply: true,
        frustrationHandoff: true,
        autoAssignOwner: true,
        handoffKeywords: ['agent'],
        handoffMessage: 'Connecting you',
      });
      const [row] = await testDb.select().from(whatsappConfigs).where(eq(whatsappConfigs.companyId, companyId));
      expect(row!.accessToken).toMatch(/^vault:v1:/);
      expect(row!.appSecret).toMatch(/^vault:v1:/);
      expect(cfg.maskedAccessToken).toContain('0001');
      expect(cfg.businessAccountId).toBe('waba_1');
    });

    it('refuses simulated template review in production', async () => {
      const t = await channelsService.createTemplate(companyId, userId, { ...input, name: 'prod_check' });
      asProduction();
      delete process.env.META_LIVE_DISPATCH;
      await expect(channelsService.submitTemplate(companyId, t.id)).rejects.toMatchObject({ code: 'PROVIDER_NOT_CONFIGURED' });
    });

    it('sends the template to Meta when live and syncs the review result', async () => {
      process.env.META_LIVE_DISPATCH = 'true';
      const t = await channelsService.createTemplate(companyId, userId, input);
      const calls: Array<{ url: string; body?: string; auth?: string }> = [];
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
        calls.push({ url: String(url), body: init?.body as string | undefined, auth: (init?.headers as Record<string, string> | undefined)?.Authorization });
        const isSubmit = String(url).endsWith('/message_templates');
        return new Response(JSON.stringify(isSubmit ? { id: 'meta_tpl_42', status: 'PENDING' } : { status: 'APPROVED' }), { status: 200 });
      });
      const submitted = await channelsService.submitTemplate(companyId, t.id);
      expect(submitted.status).toBe('pending');
      expect(calls[0]!.url).toContain('/waba_1/message_templates');
      expect(calls[0]!.auth).toBe('Bearer EAAG-real-looking-token-0001');
      const sent = JSON.parse(calls[0]!.body!);
      expect(sent).toMatchObject({ name: 'visit_followup', category: 'UTILITY' });
      expect(sent.components.find((c: { type: string }) => c.type === 'BODY').example.body_text[0]).toEqual(['Asha', 'Lakeside']);
      const synced = await channelsService.syncTemplate(companyId, t.id);
      expect(synced.status).toBe('approved');
      expect(calls[1]!.url).toContain('/meta_tpl_42?fields=status');
    });
  });
});
