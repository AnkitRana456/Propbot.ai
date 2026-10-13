import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { companies, users, projects, contacts, leads, leadActivities } from '../../src/db/schema/index.js';
import { eq } from 'drizzle-orm';

describe('Brochure Delivery & Tracking Endpoints', () => {
  const app = createApp();
  const companyId = '77777777-7777-7777-7777-777777777774';
  let projectId: string;
  let brochureId: string;
  let leadId: string;

  const adminToken = signAccessToken({
    sub: '00000000-0000-0000-0000-000000000074',
    companyId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@brochure-tracking.com',
    name: 'Brochure Admin',
  });

  beforeAll(async () => {
    await testDb
      .insert(companies)
      .values({
        id: companyId,
        name: 'Brochure Tracking Realty',
        slug: 'brochure-tracking-realty',
        plan: 'growth',
        status: 'active',
      })
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values({
        id: '00000000-0000-0000-0000-000000000074',
        companyId,
        name: 'Brochure Admin',
        email: 'admin@brochure-tracking.com',
        passwordHash: 'hash',
        role: 'company_admin',
        status: 'active',
      })
      .onConflictDoNothing();

    const [proj] = await testDb
      .insert(projects)
      .values({
        companyId,
        name: 'DLF The Camellias',
        builderName: 'DLF Limited',
        location: 'Golf Course Road, Gurugram',
        status: 'completed',
      })
      .returning();

    projectId = proj.id;

    const [cont] = await testDb
      .insert(contacts)
      .values({
        companyId,
        firstName: 'Rohan',
        lastName: 'Verma',
        phone: '+919811223344',
      })
      .returning();

    const [lead] = await testDb
      .insert(leads)
      .values({
        companyId,
        contactId: cont.id,
        status: 'new',
        priority: 'medium',
        intentScore: 50,
        intentLabel: 'warm',
        source: 'chat',
      })
      .returning();

    leadId = lead.id;
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  it('POST /api/properties/projects/:id/brochures creates a brochure asset', async () => {
    const res = await request(app)
      .post(`/api/properties/projects/${projectId}/brochures`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'The Camellias Luxury Brochure & Floor Plans',
        fileUrl: 'https://cdn.example.com/camellias-brochure.pdf',
        isGated: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toContain('The Camellias');
    expect(res.body.data.isGated).toBe(true);
    brochureId = res.body.data.id;
  });

  it('POST /api/properties/projects/:id/brochures/:brochureId/request generates signed tracking URL', async () => {
    const res = await request(app)
      .post(`/api/properties/projects/${projectId}/brochures/${brochureId}/request`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        leadId,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.downloadUrl).toContain('/api/properties/brochures/track/');
    expect(res.body.data.trackingToken).toBeDefined();

    // Now visit the tracking URL
    const trackRes = await request(app).get(
      `/api/properties/brochures/track/${res.body.data.trackingToken}`,
    );

    expect(trackRes.status).toBe(302);
    expect(trackRes.headers.location).toBe('https://cdn.example.com/camellias-brochure.pdf');

    // Verify brochure_opened activity logged
    const dbActivities = await testDb
      .select()
      .from(leadActivities)
      .where(eq(leadActivities.leadId, leadId));
    const openedActivity = dbActivities.find((a) => a.activityType === 'brochure_opened');
    expect(openedActivity).toBeDefined();
  });
});
