import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import {
  companies,
  users,
  contacts,
  leads,
  appointments,
} from '../../src/db/schema/index.js';

describe('Cross-Tenant Appointments Isolation & RLS', () => {
  const app = createApp();
  const companyAId = '88888888-8888-8888-8888-88888888888A';
  const companyBId = '88888888-8888-8888-8888-88888888888B';

  const userAId = '00000000-0000-0000-0000-00000000008A';
  const userBId = '00000000-0000-0000-0000-00000000008B';

  let tenantAAppointmentId: string;

  const tokenTenantA = signAccessToken({
    sub: userAId,
    companyId: companyAId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@tenant-a.com',
    name: 'Admin A',
  });

  const tokenTenantB = signAccessToken({
    sub: userBId,
    companyId: companyBId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@tenant-b.com',
    name: 'Admin B',
  });

  beforeAll(async () => {
    await cleanupTestDatabase([companyAId, companyBId]);
    // Create Tenant A
    await testDb
      .insert(companies)
      .values({
        id: companyAId,
        name: 'Company A Realty',
        slug: 'comp-a-realty-p8',
        plan: 'growth',
        status: 'active',
      })
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values({
        id: userAId,
        companyId: companyAId,
        name: 'Admin A',
        email: 'admin@tenant-a.com',
        passwordHash: 'hash',
        role: 'company_admin',
        status: 'active',
      })
      .onConflictDoNothing();

    // Create Tenant B
    await testDb
      .insert(companies)
      .values({
        id: companyBId,
        name: 'Company B Realty',
        slug: 'comp-b-realty-p8',
        plan: 'growth',
        status: 'active',
      })
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values({
        id: userBId,
        companyId: companyBId,
        name: 'Admin B',
        email: 'admin@tenant-b.com',
        passwordHash: 'hash',
        role: 'company_admin',
        status: 'active',
      })
      .onConflictDoNothing();

    // Insert lead and appointment belonging strictly to Tenant A
    const [contactA] = await testDb
      .insert(contacts)
      .values({
        companyId: companyAId,
        firstName: 'Tenant A',
        lastName: 'Buyer',
        phone: '+91999990007A',
      })
      .returning();

    const [leadA] = await testDb
      .insert(leads)
      .values({
        companyId: companyAId,
        contactId: contactA.id,
        status: 'lead_captured',
        priority: 'high',
        intentScore: 40,
        intentLabel: 'warm',
        scoreExplanation: ['Tenant A lead'],
        buyerDna: { budget: '1 Cr', bhk: '2 BHK' },
      })
      .returning();

    const in3Days = new Date(Date.now() + 3 * 24 * 3600 * 1000);
    const [apptA] = await testDb
      .insert(appointments)
      .values({
        companyId: companyAId,
        leadId: leadA.id,
        scheduledAt: in3Days,
        status: 'scheduled',
        appointmentType: 'site_visit',
      })
      .returning();

    tenantAAppointmentId = apptA.id;
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyAId, companyBId]);
  });

  it('Tenant A can view its own appointment', async () => {
    const res = await request(app)
      .get(`/api/appointments/${tenantAAppointmentId}`)
      .set('Authorization', `Bearer ${tokenTenantA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(tenantAAppointmentId);
  });

  it('Tenant B CANNOT access Tenant A appointment (returns 404 Not Found)', async () => {
    const res = await request(app)
      .get(`/api/appointments/${tenantAAppointmentId}`)
      .set('Authorization', `Bearer ${tokenTenantB}`);

    expect(res.status).toBe(404);
  });

  it('Tenant B CANNOT update or reschedule Tenant A appointment (returns 404 Not Found)', async () => {
    const res = await request(app)
      .patch(`/api/appointments/${tenantAAppointmentId}/status`)
      .set('Authorization', `Bearer ${tokenTenantB}`)
      .send({ status: 'cancelled' });

    expect(res.status).toBe(404);
  });
});
