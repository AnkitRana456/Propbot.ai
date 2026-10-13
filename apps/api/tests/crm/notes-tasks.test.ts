import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { companies, contacts, leads, users } from '../../src/db/schema/index.js';
import { eq } from 'drizzle-orm';

describe('CRM Notes & Tasks Endpoints', () => {
  const app = createApp();
  const companyId = '44444444-4444-4444-4444-444444444444';
  let leadId: string;
  let taskId: string;
  let noteId: string;

  const adminToken = signAccessToken({
    sub: '00000000-0000-0000-0000-000000000041',
    companyId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@notestasks.com',
    name: 'Admin Notes Tasks',
  });

  beforeAll(async () => {
    await testDb
      .insert(companies)
      .values({
        id: companyId,
        name: 'Tasks Test Realty',
        slug: 'tasks-test-realty',
        plan: 'growth',
        status: 'active',
      })
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values({
        id: '00000000-0000-0000-0000-000000000041',
        companyId,
        name: 'Admin Notes Tasks',
        email: 'admin@notestasks.com',
        passwordHash: 'hash',
        role: 'company_admin',
        status: 'active',
      })
      .onConflictDoNothing();

    const [contact] = await testDb
      .insert(contacts)
      .values({
        companyId,
        firstName: 'Sameer',
        lastName: 'Joshi',
        phone: '+919777788888',
      })
      .returning();

    const [lead] = await testDb
      .insert(leads)
      .values({
        companyId,
        contactId: contact.id,
        status: 'new',
        priority: 'medium',
        intentScore: 60,
        source: 'chat',
      })
      .returning();
    leadId = lead.id;
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  // --- Notes Tests ---
  it('POST /api/crm/leads/:leadId/notes creates an internal collaboration note', async () => {
    const res = await request(app)
      .post(`/api/crm/leads/${leadId}/notes`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: 'Spoke with client on phone. Prefers corner 3BHK on 8th floor or above.' });

    expect(res.status).toBe(201);
    expect(res.body.data.content).toContain('corner 3BHK');
    expect(res.body.data.userName).toBe('Admin Notes Tasks');
    noteId = res.body.data.id;
  });

  it('GET /api/crm/leads/:leadId/notes lists all notes for lead', async () => {
    const res = await request(app)
      .get(`/api/crm/leads/${leadId}/notes`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].id).toBe(noteId);
  });

  it('DELETE /api/crm/notes/:noteId soft deletes the note', async () => {
    const res = await request(app)
      .delete(`/api/crm/notes/${noteId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.success).toBe(true);

    const listRes = await request(app)
      .get(`/api/crm/leads/${leadId}/notes`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.body.data.some((n: { id: string }) => n.id === noteId)).toBe(false);
  });

  // --- Tasks Tests ---
  it('POST /api/crm/tasks schedules follow-up task and updates leads.nextFollowUpAt', async () => {
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
    const res = await request(app)
      .post('/api/crm/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        leadId,
        title: 'Follow-up on bank loan approval',
        type: 'follow_up',
        dueDate: tomorrow.toISOString(),
        priority: 'high',
        description: 'Check if HDFC Pre-approval letter is received',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Follow-up on bank loan approval');
    expect(res.body.data.status).toBe('pending');
    taskId = res.body.data.id;

    // Verify lead nextFollowUpAt was updated
    const leadRow = await testDb.query.leads.findFirst({
      where: eq(leads.id, leadId),
    });
    expect(leadRow?.nextFollowUpAt).not.toBeNull();
  });

  it('GET /api/crm/tasks retrieves tasks with pending and overdue counts', async () => {
    const res = await request(app)
      .get(`/api/crm/tasks?leadId=${leadId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.pendingCount).toBeGreaterThanOrEqual(1);
  });

  it('PATCH /api/crm/tasks/:taskId marks task as completed', async () => {
    const res = await request(app)
      .patch(`/api/crm/tasks/${taskId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'completed' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.completedAt).not.toBeNull();

    // Verify lead nextFollowUpAt cleared
    const leadRow = await testDb.query.leads.findFirst({
      where: eq(leads.id, leadId),
    });
    expect(leadRow?.nextFollowUpAt).toBeNull();
  });
});
