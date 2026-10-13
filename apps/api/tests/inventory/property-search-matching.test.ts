import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { companies, users, projects, units } from '../../src/db/schema/index.js';

describe('Property Search & Buyer DNA Matching Endpoints', () => {
  const app = createApp();
  const companyId = '77777777-7777-7777-7777-777777777773';

  const adminToken = signAccessToken({
    sub: '00000000-0000-0000-0000-000000000073',
    companyId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@search-matching.com',
    name: 'Search Admin',
  });

  beforeAll(async () => {
    await testDb
      .insert(companies)
      .values({
        id: companyId,
        name: 'Matching Realty',
        slug: 'matching-realty',
        plan: 'growth',
        status: 'active',
      })
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values({
        id: '00000000-0000-0000-0000-000000000073',
        companyId,
        name: 'Search Admin',
        email: 'admin@search-matching.com',
        passwordHash: 'hash',
        role: 'company_admin',
        status: 'active',
      })
      .onConflictDoNothing();

    // Project 1: High match for Whitefield 3 BHK, budget 1.5 - 2 Cr
    const [p1] = await testDb
      .insert(projects)
      .values({
        companyId,
        name: 'Prestige Lakeside',
        builderName: 'Prestige Group',
        location: 'Whitefield, Bengaluru',
        status: 'under_construction',
        possessionDate: 'Dec 2026',
        amenities: ['Pool', 'Gym'],
        usps: ['Lakefront', 'Metro nearby'],
        pricingDetails: { startingPrice: 16000000 },
      })
      .returning();

    await testDb.insert(units).values([
      {
        companyId,
        projectId: p1.id,
        unitNumber: 'A-101',
        bhk: 3,
        carpetAreaSqft: 1400,
        price: 18000000,
        status: 'available',
      },
    ]);

    // Project 2: High match for Sarjapur 2 BHK, budget 80L - 1.2 Cr
    const [p2] = await testDb
      .insert(projects)
      .values({
        companyId,
        name: 'Sobha Dream Acres',
        builderName: 'Sobha Developers',
        location: 'Sarjapur Road, Bengaluru',
        status: 'ready_to_move',
        possessionDate: 'Ready',
        amenities: ['Clubhouse'],
        usps: ['Precast Tech'],
        pricingDetails: { startingPrice: 8500000 },
      })
      .returning();

    await testDb.insert(units).values([
      {
        companyId,
        projectId: p2.id,
        unitNumber: 'B-201',
        bhk: 2,
        carpetAreaSqft: 950,
        price: 9000000,
        status: 'available',
      },
    ]);
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  it('GET /api/properties/search filters properties by locality and budget', async () => {
    const res = await request(app)
      .get('/api/properties/search?locality=Whitefield&budgetMin=15000000&budgetMax=25000000&bhk=3')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);

    const match = res.body.data[0];
    expect(match.name).toBe('Prestige Lakeside');
    expect(match.location).toContain('Whitefield');
    expect(match.bhkOptions).toContain(3);
    expect(match.matchScore).toBeGreaterThanOrEqual(80);
    expect(match.matchHighlights).toBeDefined();
  });

  it('GET /api/properties/search respects ready_to_move status and lower budget filter', async () => {
    const res = await request(app)
      .get('/api/properties/search?status=ready_to_move&budgetMax=12000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);

    const match = res.body.data[0];
    expect(match.name).toBe('Sobha Dream Acres');
    expect(match.status).toBe('ready_to_move');
  });
});
