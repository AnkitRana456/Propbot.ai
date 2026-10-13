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
  projects,
  appointments,
  tasks,
} from '../../src/db/schema/index.js';
import { eq } from 'drizzle-orm';

describe('Appointments CRUD & Pipeline Actions', () => {
  const app = createApp();
  const companyId = '88888888-8888-8888-8888-888888888881';
  const userId = '00000000-0000-0000-0000-000000000081';
  let leadId: string;
  let projectId: string;
  let appointmentId: string;

  const adminToken = signAccessToken({
    sub: userId,
    companyId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@appointments-crud.com',
    name: 'Admin Appointments',
  });

  beforeAll(async () => {
    await cleanupTestDatabase([companyId]);

    await testDb
      .insert(companies)
      .values({
        id: companyId,
        name: 'Appointments Realty Ltd',
        slug: 'appointments-realty-p8',
        plan: 'growth',
        status: 'active',
      })
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values({
        id: userId,
        companyId,
        name: 'Admin Appointments',
        email: 'admin@appointments-crud.com',
        passwordHash: 'hash',
        role: 'company_admin',
        status: 'active',
      })
      .onConflictDoNothing();

    const [contact] = await testDb
      .insert(contacts)
      .values({
        companyId,
        firstName: 'Aarav',
        lastName: 'Sharma',
        phone: '+919988776655',
        email: 'aarav.sharma@example.com',
      })
      .returning();

    const [lead] = await testDb
      .insert(leads)
      .values({
        companyId,
        contactId: contact.id,
        status: 'lead_captured',
        priority: 'high',
        intentScore: 45,
        intentLabel: 'warm',
        scoreExplanation: ['Initial contact captured'],
        buyerDna: {
          budget: '1.5 Cr',
          bhk: '3 BHK',
          locations: ['Whitefield'],
          intent: 'warm',
        },
      })
      .returning();
    leadId = lead.id;

    const [proj] = await testDb
      .insert(projects)
      .values({
        companyId,
        name: 'Silver Oak Residences',
        builderName: 'Silverline Developers',
        location: 'Sarjapur Road, Bengaluru',
        status: 'under_construction',
      })
      .returning();
    projectId = proj.id;
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  it('creates a site visit appointment and updates lead status to site_visit_scheduled', async () => {
    const scheduledAt = new Date();
    scheduledAt.setDate(scheduledAt.getDate() + 2);
    scheduledAt.setHours(11, 0, 0, 0);

    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        leadId,
        projectId,
        appointmentType: 'site_visit',
        scheduledAt: scheduledAt.toISOString(),
        location: 'Silver Oak Experience Gallery',
        notes: 'Client interested in tower B high rise units',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.leadId).toBe(leadId);
    expect(res.body.data.status).toBe('scheduled');
    expect(res.body.data.surveyToken).toBeDefined();

    appointmentId = res.body.data.id;

    // Verify lead status updated to site_visit_scheduled
    const [updatedLead] = await testDb.select().from(leads).where(eq(leads.id, leadId));
    expect(updatedLead.status).toBe('site_visit_scheduled');
    // Verify +25 intent score applied
    expect(updatedLead.intentScore).toBe(70);
    expect(updatedLead.intentLabel).toBe('hot');
  });

  it('fetches appointments KPI summary with upcoming and total counts', async () => {
    const res = await request(app)
      .get('/api/appointments/kpis')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.all).toBeGreaterThanOrEqual(1);
    expect(res.body.data.upcoming).toBeGreaterThanOrEqual(1);
  });

  it('lists appointments with search and status filtering', async () => {
    const res = await request(app)
      .get('/api/appointments?status=scheduled')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toBeInstanceOf(Array);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.items[0].leadName).toContain('Aarav');
  });

  it('reschedules appointment to another open time slot', async () => {
    const newScheduledAt = new Date();
    newScheduledAt.setDate(newScheduledAt.getDate() + 3);
    newScheduledAt.setHours(15, 0, 0, 0);

    const res = await request(app)
      .post(`/api/appointments/${appointmentId}/reschedule`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        scheduledAt: newScheduledAt.toISOString(),
        reason: 'Client requested evening timing',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.rescheduledFromId).toBeDefined();

    // Verify original appointment marked rescheduled
    const [oldAppt] = await testDb
      .select()
      .from(appointments)
      .where(eq(appointments.id, appointmentId));
    expect(oldAppt.status).toBe('rescheduled');

    // Point appointmentId to newly active appointment
    appointmentId = res.body.data.id;
  });

  it('confirms appointment status', async () => {
    const res = await request(app)
      .patch(`/api/appointments/${appointmentId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'confirmed' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('confirmed');
  });

  it('completes appointment, transitioning lead to site_visit_done and generating follow-up task', async () => {
    const res = await request(app)
      .patch(`/api/appointments/${appointmentId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'completed' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('completed');

    // Verify lead status moved to site_visit_done
    const [updatedLead] = await testDb.select().from(leads).where(eq(leads.id, leadId));
    expect(updatedLead.status).toBe('site_visit_done');

    // Verify automated CRM follow-up task was generated
    const [task] = await testDb.select().from(tasks).where(eq(tasks.leadId, leadId));
    expect(task).toBeDefined();
    expect(task.title).toContain('Post-Visit Feedback');
  });
});
