import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import {
  companies,
  users,
  chatbots,
  whatsappConfigs,
  conversations,
  contacts,
} from '../../src/db/schema/index.js';

describe('WhatsApp Multi-Tenant Isolation & RLS Security', () => {
  const app = createApp();
  const companyA = '99999999-9999-9999-9999-999999999905';
  const companyB = '99999999-9999-9999-9999-999999999906';
  const userA = '00000000-0000-0000-0000-000000000096';
  const userB = '00000000-0000-0000-0000-000000000097';

  let convAId: string;

  const _tokenA = signAccessToken({
    sub: userA,
    companyId: companyA,
    role: 'company_admin',
    status: 'active',
    email: 'admin@company-a.com',
    name: 'Admin A',
  });

  const tokenB = signAccessToken({
    sub: userB,
    companyId: companyB,
    role: 'company_admin',
    status: 'active',
    email: 'admin@company-b.com',
    name: 'Admin B',
  });

  beforeAll(async () => {
    await cleanupTestDatabase([companyA, companyB]);

    // Seed Company A
    await testDb
      .insert(companies)
      .values({
        id: companyA,
        name: 'Company A Realty',
        slug: 'whatsapp-tenant-a-p9',
        plan: 'growth',
        status: 'active',
      })
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values({
        id: userA,
        companyId: companyA,
        name: 'Admin A',
        email: 'admin@company-a.com',
        role: 'company_admin',
        status: 'active',
        passwordHash: 'dummy',
      })
      .onConflictDoNothing();

    await testDb
      .insert(whatsappConfigs)
      .values({
        companyId: companyA,
        phoneNumberId: '104928172635405',
        businessPhoneNumber: '+919876543205',
        accessToken: 'EAAG_company_a_secret_token',
        verifyToken: 'token_a',
        status: 'connected',
      })
      .onConflictDoNothing();

    const [contactA] = await testDb
      .insert(contacts)
      .values({
        companyId: companyA,
        firstName: 'Lead',
        lastName: 'A',
        phone: '+919999000001',
      })
      .returning();

    const [botA] = await testDb
      .insert(chatbots)
      .values({
        companyId: companyA,
        name: 'Bot A',
        type: 'whatsapp',
        status: 'active',
        publicKey: 'pub_key_a',
      })
      .returning();

    const [convA] = await testDb
      .insert(conversations)
      .values({
        companyId: companyA,
        chatbotId: botA!.id,
        contactId: contactA!.id,
        channel: 'whatsapp',
        status: 'bot',
        metadata: { visitorNote: 'Private data of Company A' },
      })
      .returning();

    convAId = convA!.id;

    // Seed Company B
    await testDb
      .insert(companies)
      .values({
        id: companyB,
        name: 'Company B Realty',
        slug: 'whatsapp-tenant-b-p9',
        plan: 'growth',
        status: 'active',
      })
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values({
        id: userB,
        companyId: companyB,
        name: 'Admin B',
        email: 'admin@company-b.com',
        role: 'company_admin',
        status: 'active',
        passwordHash: 'dummy',
      })
      .onConflictDoNothing();

    await testDb
      .insert(whatsappConfigs)
      .values({
        companyId: companyB,
        phoneNumberId: '104928172635406',
        businessPhoneNumber: '+919876543206',
        accessToken: 'EAAG_company_b_secret_token',
        verifyToken: 'token_b',
        status: 'connected',
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyA, companyB]);
  });

  it("Company B cannot access Company A's WhatsApp configuration", async () => {
    const resB = await request(app)
      .get('/api/whatsapp/config')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(resB.status).toBe(200);
    // Company B sees their own phone number ID, never Company A's
    expect(resB.body.data.phoneNumberId).toBe('104928172635406');
    expect(resB.body.data.phoneNumberId).not.toBe('104928172635405');
  });

  it("Company B cannot view Company A's WhatsApp conversation", async () => {
    const resB = await request(app)
      .get(`/api/whatsapp/conversations/${convAId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(resB.status).toBe(404);
  });

  it("Company B cannot send message on Company A's conversation", async () => {
    const resB = await request(app)
      .post(`/api/whatsapp/conversations/${convAId}/messages`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ content: 'Malicious cross-tenant injection' });

    expect(resB.status).toBe(404);
  });
});
