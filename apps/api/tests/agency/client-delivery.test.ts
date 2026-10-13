import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import {
  companies,
  users,
  chatbots,
  contacts,
  leads,
} from '../../src/db/schema/index.js';
import { agencyService } from '../../src/modules/agency/agency.service.js';

describe('Agency Reseller Mode & Client Lead Delivery', () => {
  const app = createApp();
  const agencyCompanyId = '99999999-9999-9999-9999-999999999934';
  const agencyAdminId = '00000000-0000-0000-0000-000000000341';
  const chatbotId = '88888888-8888-8888-8888-888888888834';

  let clientCompanyId = '';

  const agencyAdminToken = signAccessToken({
    sub: agencyAdminId,
    companyId: agencyCompanyId,
    role: 'company_admin',
    status: 'active',
    email: 'agency@reseller.com',
    name: 'Agency Admin',
  });

  beforeAll(async () => {
    await cleanupTestDatabase([agencyCompanyId]);

    await testDb
      .insert(companies)
      .values({
        id: agencyCompanyId,
        name: 'Prime Agency Reseller Ltd',
        slug: 'prime-agency-reseller',
        plan: 'enterprise',
        status: 'active',
        isAgency: true,
      })
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values({
        id: agencyAdminId,
        companyId: agencyCompanyId,
        name: 'Agency Admin',
        email: 'agency@reseller.com',
        role: 'company_admin',
        status: 'active',
        passwordHash: 'dummy',
      })
      .onConflictDoNothing();

    await testDb
      .insert(chatbots)
      .values({
        id: chatbotId,
        companyId: agencyCompanyId,
        name: 'Prestige Sanctuary Bot',
        publicKey: 'pub_test_agency_bot_01',
        status: 'published',
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    if (clientCompanyId) {
      await cleanupTestDatabase([agencyCompanyId, clientCompanyId]);
    } else {
      await cleanupTestDatabase([agencyCompanyId]);
    }
  });

  it('POST /api/agency/clients creates client company under agency', async () => {
    const res = await request(app)
      .post('/api/agency/clients')
      .set('Authorization', `Bearer ${agencyAdminToken}`)
      .send({
        name: 'Prestige Group Client A',
        slug: 'prestige-group-client-a',
        contactEmail: 'clienta@prestige.com',
        deliveryRules: {
          emailDelivery: true,
          whatsappDelivery: true,
          duplicateWindowHours: 48,
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Prestige Group Client A');
    expect(res.body.data.parentCompanyId).toBe(agencyCompanyId);

    clientCompanyId = res.body.data.id;
  });

  it('GET /api/agency/clients lists managed client companies', async () => {
    const res = await request(app)
      .get('/api/agency/clients')
      .set('Authorization', `Bearer ${agencyAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.some((c: { id: string }) => c.id === clientCompanyId)).toBe(true);
  });

  it('POST /api/agency/chatbots/:id/assign assigns chatbot to client company with delivery rules', async () => {
    const res = await request(app)
      .post(`/api/agency/chatbots/${chatbotId}/assign`)
      .set('Authorization', `Bearer ${agencyAdminToken}`)
      .send({
        clientId: clientCompanyId,
        deliveryRules: {
          emailDelivery: true,
          whatsappDelivery: true,
          duplicateWindowHours: 48,
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.clientId).toBe(clientCompanyId);
  });

  it('deliverLeadToClient deducts lead credit and logs transaction', async () => {
    // Insert contact and lead under client company
    const contactId = '11111111-1111-1111-1111-111111111134';
    const leadId = '22222222-2222-2222-2222-222222222234';

    await testDb
      .insert(contacts)
      .values({
        id: contactId,
        companyId: clientCompanyId,
        firstName: 'Rahul',
        lastName: 'Sharma',
        phone: '+919876543210',
      })
      .onConflictDoNothing();

    await testDb
      .insert(leads)
      .values({
        id: leadId,
        companyId: clientCompanyId,
        contactId,
        chatbotId,
        status: 'qualified',
      })
      .onConflictDoNothing();

    const deliveryResult = await agencyService.deliverLeadToClient(leadId, chatbotId);

    expect(deliveryResult.delivered).toBe(true);
    expect(deliveryResult.clientId).toBe(clientCompanyId);
    expect(deliveryResult.creditResult.success).toBe(true);
  });

  it('client portal user only sees Client A data and is isolated from agency/other clients', async () => {
    const clientUserToken = signAccessToken({
      sub: '00000000-0000-0000-0000-000000000349',
      companyId: clientCompanyId,
      role: 'viewer',
      status: 'active',
      email: 'viewer@clienta.com',
      name: 'Client Viewer',
    });

    const res = await request(app)
      .get('/api/agency/portal')
      .set('Authorization', `Bearer ${clientUserToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.leads).toBeDefined();
    expect(res.body.data.leads.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.leads[0].companyId).toBe(clientCompanyId);
  });
});
