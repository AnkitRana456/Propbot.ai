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
  tasks,
} from '../../src/db/schema/index.js';
import { appointmentReminderService } from '../../src/modules/appointments/appointment-reminder.service.js';
import { eq } from 'drizzle-orm';

describe('Reminders Sweep, No-Show Recovery & Feedback Survey', () => {
  const app = createApp();
  const companyId = '88888888-8888-8888-8888-888888888885';
  const userId = '00000000-0000-0000-0000-000000000085';
  let leadId: string;
  let surveyToken: string;
  let appointmentId: string;

  const adminToken = signAccessToken({
    sub: userId,
    companyId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@reminders-survey.com',
    name: 'Admin Reminders',
  });

  beforeAll(async () => {
    await cleanupTestDatabase([companyId]);
    await testDb
      .insert(companies)
      .values({
        id: companyId,
        name: 'Reminders Survey Realty',
        slug: 'reminders-survey-realty-p8',
        plan: 'growth',
        status: 'active',
      })
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values({
        id: userId,
        companyId,
        name: 'Admin Reminders',
        email: 'admin@reminders-survey.com',
        passwordHash: 'hash',
        role: 'company_admin',
        status: 'active',
      })
      .onConflictDoNothing();

    const [contact] = await testDb
      .insert(contacts)
      .values({
        companyId,
        firstName: 'Rohan',
        lastName: 'Verma',
        phone: '+919876543299',
        email: 'rohan.verma@example.com',
      })
      .returning();

    const [lead] = await testDb
      .insert(leads)
      .values({
        companyId,
        contactId: contact.id,
        status: 'site_visit_scheduled',
        priority: 'high',
        intentScore: 60,
        intentLabel: 'warm',
        scoreExplanation: ['Initial visit scheduled'],
      })
      .returning();
    leadId = lead.id;

    // Create appointment 24 hours from now to test reminder sweep
    const in24h = new Date(Date.now() + 24 * 3600 * 1000);
    const [appt] = await testDb
      .insert(appointments)
      .values({
        companyId,
        leadId,
        scheduledAt: in24h,
        durationMinutes: 45,
        status: 'scheduled',
        appointmentType: 'site_visit',
        surveyToken: 'survey-token-test-12345',
      })
      .returning();

    appointmentId = appt.id;
    surveyToken = appt.surveyToken!;
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  it('runs reminder sweep and flags reminderSent24h', async () => {
    const sweepResult = await appointmentReminderService.sweepAndSendReminders();
    expect(sweepResult.sent24hCount).toBeGreaterThanOrEqual(1);

    const [updatedAppt] = await testDb
      .select()
      .from(appointments)
      .where(eq(appointments.id, appointmentId));
    expect(updatedAppt.reminderSent24h).toBe(true);
  });

  it('handles no-show status update by marking appointment no_show and creating follow-up task', async () => {
    const res = await request(app)
      .patch(`/api/appointments/${appointmentId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'no_show' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('no_show');

    // Verify task generated
    const [task] = await testDb
      .select()
      .from(tasks)
      .where(eq(tasks.leadId, leadId));
    expect(task).toBeDefined();
    expect(task.title).toContain('Missed Site Visit');
  });

  it('submits post-visit buyer feedback survey and awards +15 intent score points', async () => {
    const res = await request(app)
      .post(`/api/appointments/survey/${surveyToken}`)
      .send({
        rating: 5,
        feedback: 'Excellent site tour, loved the amenities and layout.',
        interestedInBooking: 'yes',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify appointment record updated
    const [appt] = await testDb
      .select()
      .from(appointments)
      .where(eq(appointments.id, appointmentId));
    expect(appt.surveyRating).toBe(5);
    expect(appt.surveyFeedback).toContain('Excellent site tour');
    expect(appt.surveyInterestedInBooking).toBe('yes');
    expect(appt.surveyCompletedAt).toBeDefined();

    // Verify lead received +15 points and moved to negotiation stage
    const [updatedLead] = await testDb
      .select()
      .from(leads)
      .where(eq(leads.id, leadId));
    expect(updatedLead.intentScore).toBe(75);
    expect(updatedLead.intentLabel).toBe('hot');
    expect(updatedLead.status).toBe('negotiation');
  });
});
