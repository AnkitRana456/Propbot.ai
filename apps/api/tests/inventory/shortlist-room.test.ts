import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { companies, users, projects, units, contacts, leads, shortlistRooms } from '../../src/db/schema/index.js';
import { eq } from 'drizzle-orm';

describe('Smart Shortlist Room Endpoints', () => {
  const app = createApp();
  const companyId = '77777777-7777-7777-7777-777777777775';
  let projectId: string;
  let leadId: string;
  let roomToken: string;

  const adminToken = signAccessToken({
    sub: '00000000-0000-0000-0000-000000000075',
    companyId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@shortlist-room.com',
    name: 'Shortlist Admin',
  });

  beforeAll(async () => {
    await testDb
      .insert(companies)
      .values({
        id: companyId,
        name: 'Shortlist Prestige Realty',
        slug: 'shortlist-prestige-realty',
        plan: 'growth',
        status: 'active',
      })
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values({
        id: '00000000-0000-0000-0000-000000000075',
        companyId,
        name: 'Shortlist Admin',
        email: 'admin@shortlist-room.com',
        passwordHash: 'hash',
        role: 'company_admin',
        status: 'active',
      })
      .onConflictDoNothing();

    const [proj] = await testDb
      .insert(projects)
      .values({
        companyId,
        name: 'Total Environment Windmills of Your Mind',
        builderName: 'Total Environment',
        location: 'Whitefield, Bengaluru',
        status: 'ready_to_move',
        overview: 'Duplex apartments with earth sheltered terrace gardens.',
        amenities: ['Private Garden', 'Clubhouse', 'Heated Pool'],
        usps: ['Customized interiors', 'Terrace gardens'],
        pricingDetails: { startingPrice: 45000000 },
      })
      .returning();

    projectId = proj.id;

    await testDb.insert(units).values([
      {
        companyId,
        projectId,
        unitNumber: 'W-402',
        bhk: 4,
        carpetAreaSqft: 3800,
        price: 52000000,
        status: 'available',
      },
    ]);

    const [cont] = await testDb
      .insert(contacts)
      .values({
        companyId,
        firstName: 'Sameer',
        lastName: 'Nair',
        phone: '+919988776655',
      })
      .returning();

    const [lead] = await testDb
      .insert(leads)
      .values({
        companyId,
        contactId: cont.id,
        status: 'qualified',
        priority: 'high',
        intentScore: 65,
        intentLabel: 'hot',
        source: 'chat',
        buyerDna: {
          budgetMin: 40000000,
          budgetMax: 60000000,
          bhk: ['4BHK'],
          localities: ['Whitefield'],
          propertyType: 'apartment',
          timeline: 'immediate',
        },
      })
      .returning();

    leadId = lead.id;
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  it('POST /api/properties/shortlist-rooms creates a smart shortlist room', async () => {
    const res = await request(app)
      .post('/api/properties/shortlist-rooms')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        leadId,
        title: 'Exclusive Luxury Duplex Shortlist for Sameer',
        projectIds: [projectId],
        expiresInDays: 14,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.shareableUrl).toContain(res.body.data.token);
    roomToken = res.body.data.token;
  });

  it('GET /api/shortlist-room/:token resolves public room without authentication', async () => {
    const res = await request(app).get(`/api/shortlist-room/${roomToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.leadFirstName).toBe('Sameer');
    expect(res.body.data.agencyName).toBe('Shortlist Prestige Realty');
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].project.name).toBe('Total Environment Windmills of Your Mind');
    expect(res.body.data.comparisonMatrix).toBeDefined();
    expect(res.body.data.comparisonMatrix.attributes.length).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/shortlist-room/:token/track logs telemetry, dwell time, and boosts lead intent score', async () => {
    // Record view telemetry
    const viewRes = await request(app)
      .post(`/api/shortlist-room/${roomToken}/track`)
      .send({
        event: 'view',
        timeSpentSeconds: 30,
        projectId,
      });

    expect(viewRes.status).toBe(200);
    expect(viewRes.body.success).toBe(true);

    // Record dwell & focus
    const dwellRes = await request(app)
      .post(`/api/shortlist-room/${roomToken}/track`)
      .send({
        event: 'dwell',
        timeSpentSeconds: 60,
        projectId,
      });

    expect(dwellRes.status).toBe(200);

    // Verify room stats updated in DB
    const [dbRoom] = await testDb
      .select()
      .from(shortlistRooms)
      .where(eq(shortlistRooms.token, roomToken));

    expect(dbRoom.viewsCount).toBeGreaterThanOrEqual(1);
    expect(dbRoom.totalTimeSpentSeconds).toBeGreaterThanOrEqual(90);
    expect(dbRoom.favoriteProjectId).toBe(projectId);

    // Verify lead's intent score boosted (+15 points per interaction)
    const [updatedLead] = await testDb.select().from(leads).where(eq(leads.id, leadId));
    expect(updatedLead.intentScore).toBe(95); // 65 + 15 + 15
  });
});
