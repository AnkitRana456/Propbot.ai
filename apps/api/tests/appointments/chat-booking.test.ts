import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import {
  companies,
  chatbots,
  leads,
  contacts,
  domainEvents,
  projects,
} from '../../src/db/schema/index.js';
import { eq } from 'drizzle-orm';

describe('Public Chatbot Widget Booking Endpoints', () => {
  const app = createApp();
  const companyId = '88888888-8888-8888-8888-888888888884';
  const chatbotId = '88888888-8888-8888-8888-888888880084';
  let projectId: string;

  beforeAll(async () => {
    await cleanupTestDatabase([companyId]);
    await testDb
      .insert(companies)
      .values({
        id: companyId,
        name: 'Chat Booking Realty',
        slug: 'chat-booking-realty-p8',
        plan: 'growth',
        status: 'active',
      })
      .onConflictDoNothing();

    await testDb
      .insert(chatbots)
      .values({
        id: chatbotId,
        companyId,
        name: 'Website Sales Assistant',
        publicKey: 'pk_live_chat_booking_widget_12345',
        status: 'published',
      })
      .onConflictDoNothing();

    const [proj] = await testDb
      .insert(projects)
      .values({
        companyId,
        name: 'Grand Horizon',
        builderName: 'Horizon Group',
        location: 'Indiranagar, Bengaluru',
        status: 'ready_to_move',
      })
      .returning();
    projectId = proj.id;
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  it('queries open slots via public widget endpoint without auth header', async () => {
    const res = await request(app)
      .get(`/api/chatbots/${chatbotId}/available-slots?date=2026-11-20`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.slots).toBeInstanceOf(Array);
    expect(res.body.data.slots.length).toBeGreaterThan(0);
  });

  it('books visit directly from chat widget, captures lead, updates stage, logs visit_booked event, and boosts score', async () => {
    const res = await request(app)
      .post(`/api/chatbots/${chatbotId}/book-visit`)
      .send({
        visitorName: 'Sneha Patel',
        visitorPhone: '+919876500123',
        visitorEmail: 'sneha.patel@example.com',
        projectId,
        scheduledAt: '2026-11-20T11:00:00.000Z',
        notes: 'Requested sample flat 3BHK walkthrough',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.appointmentId).toBeDefined();
    expect(res.body.data.confirmationMessage).toContain('scheduled');

    // Verify contact and lead created in database
    const [contact] = await testDb
      .select()
      .from(contacts)
      .where(eq(contacts.phone, '+919876500123'));
    expect(contact).toBeDefined();
    expect(contact.firstName).toContain('Sneha');

    const [lead] = await testDb
      .select()
      .from(leads)
      .where(eq(leads.contactId, contact.id));
    expect(lead).toBeDefined();
    expect(lead.status).toBe('site_visit_scheduled');
    expect(lead.intentScore).toBeGreaterThanOrEqual(25);

    // Verify domain event emitted
    const [evt] = await testDb
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.type, 'visit_booked'));
    expect(evt).toBeDefined();
  });
});
