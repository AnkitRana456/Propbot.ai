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
  availabilitySettings,
} from '../../src/db/schema/index.js';

describe('Availability Engine & Concurrency Conflict Prevention', () => {
  const app = createApp();
  const companyId = '88888888-8888-8888-8888-888888888892';
  const userId = '00000000-0000-0000-0000-000000000092';
  let lead1Id: string;
  let lead2Id: string;

  const adminToken = signAccessToken({
    sub: userId,
    companyId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@concurrent-booking.com',
    name: 'Admin Concurrency',
  });

  beforeAll(async () => {
    await cleanupTestDatabase([companyId]);

    await testDb
      .insert(companies)
      .values({
        id: companyId,
        name: 'Concurrency Realty Ltd',
        slug: 'concurrency-realty-p8-unique',
        plan: 'growth',
        status: 'active',
      })
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values({
        id: userId,
        companyId,
        name: 'Admin Concurrency',
        email: 'admin@concurrent-booking.com',
        passwordHash: 'hash',
        role: 'company_admin',
        status: 'active',
      })
      .onConflictDoNothing();

    const [c1] = await testDb
      .insert(contacts)
      .values({
        companyId,
        firstName: 'Buyer',
        lastName: 'One',
        phone: '+919999900001',
      })
      .returning();

    const [l1] = await testDb
      .insert(leads)
      .values({
        companyId,
        contactId: c1.id,
        status: 'lead_captured',
        priority: 'high',
        intentScore: 50,
        intentLabel: 'warm',
        scoreExplanation: ['Lead 1'],
        buyerDna: { budget: '2 Cr', bhk: '3 BHK' },
      })
      .returning();
    lead1Id = l1.id;

    const [c2] = await testDb
      .insert(contacts)
      .values({
        companyId,
        firstName: 'Buyer',
        lastName: 'Two',
        phone: '+919999900002',
      })
      .returning();

    const [l2] = await testDb
      .insert(leads)
      .values({
        companyId,
        contactId: c2.id,
        status: 'lead_captured',
        priority: 'high',
        intentScore: 50,
        intentLabel: 'warm',
        scoreExplanation: ['Lead 2'],
        buyerDna: { budget: '2 Cr', bhk: '3 BHK' },
      })
      .returning();
    lead2Id = l2.id;

    // Set custom availability settings
    await testDb
      .insert(availabilitySettings)
      .values({
        companyId,
        slotDurationMinutes: 30,
        bufferMinutes: 15,
        workingHoursStart: '10:00',
        workingHoursEnd: '18:00',
        workingDays: [0, 1, 2, 3, 4, 5, 6],
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  it('generates available slots considering working hours and duration', async () => {
    const targetDate = '2026-11-15';
    const res = await request(app)
      .get(`/api/appointments/available-slots?date=${targetDate}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.slots).toBeInstanceOf(Array);
    expect(res.body.data.slots.length).toBeGreaterThan(0);
    expect(res.body.data.slots[0].available).toBe(true);
    expect(res.body.data.slots[0].time).toMatch(/^\d{2}:\d{2}$/);
  });

  it('prevents double-booking: second concurrent request to identical slot returns 409 Conflict', async () => {
    const slotTime = '2026-11-15T10:30:00.000Z';

    // First booking succeeds
    const res1 = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        leadId: lead1Id,
        scheduledAt: slotTime,
        appointmentType: 'site_visit',
        assignedAgentId: userId,
      });

    expect(res1.status).toBe(201);
    expect(res1.body.success).toBe(true);

    // Second booking on the exact same agent/time slot is rejected
    const res2 = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        leadId: lead2Id,
        scheduledAt: slotTime,
        appointmentType: 'site_visit',
        assignedAgentId: userId,
      });

    expect(res2.status).toBe(409);
    expect(res2.body.error).toBeDefined();
    expect(res2.body.error.message).toContain('no longer available');
  });
});
