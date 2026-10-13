import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { companies, users } from '../../src/db/schema/index.js';

describe('Property Inventory CRUD Endpoints', () => {
  const app = createApp();
  const companyId = '77777777-7777-7777-7777-777777777771';
  let projectId: string;
  let unitId: string;

  const adminToken = signAccessToken({
    sub: '00000000-0000-0000-0000-000000000071',
    companyId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@inventory-crud.com',
    name: 'Inventory Admin',
  });

  beforeAll(async () => {
    await testDb
      .insert(companies)
      .values({
        id: companyId,
        name: 'Inventory CRUD Realty',
        slug: 'inventory-crud-realty',
        plan: 'growth',
        status: 'active',
      })
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values({
        id: '00000000-0000-0000-0000-000000000071',
        companyId,
        name: 'Inventory Admin',
        email: 'admin@inventory-crud.com',
        passwordHash: 'hash',
        role: 'company_admin',
        status: 'active',
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  it('POST /api/properties/projects creates a project with full specifications', async () => {
    const res = await request(app)
      .post('/api/properties/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Godrej Woods',
        builderName: 'Godrej Properties',
        location: 'Sector 43, Noida',
        status: 'under_construction',
        reraNo: 'UPRERAPRJ704730',
        possessionDate: 'March 2026',
        overview: 'Urban forest themed luxury residences in Noida.',
        amenities: ['Forest trail', 'Clubhouse', 'Olympic pool'],
        usps: ['Adjacent to Golf Course', '1100+ trees on site'],
        gallery: ['https://example.com/gw1.jpg'],
        pricingDetails: {
          startingPrice: 17500000,
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Godrej Woods');
    expect(res.body.data.builderName).toBe('Godrej Properties');
    expect(res.body.data.amenities).toContain('Forest trail');
    expect(res.body.data.usps).toContain('Adjacent to Golf Course');
    projectId = res.body.data.id;
  });

  it('GET /api/properties/projects lists projects with pagination and filters', async () => {
    const res = await request(app)
      .get('/api/properties/projects?search=Godrej')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.items[0].name).toBe('Godrej Woods');
  });

  it('GET /api/properties/projects/:id returns single project details', async () => {
    const res = await request(app)
      .get(`/api/properties/projects/${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(projectId);
    expect(res.body.data.reraNo).toBe('UPRERAPRJ704730');
  });

  it('POST /api/properties/projects/:id/units creates a single unit', async () => {
    const res = await request(app)
      .post(`/api/properties/projects/${projectId}/units`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        tower: 'Oak Tower',
        floor: 14,
        unitNumber: 'O-1402',
        bhk: 3,
        carpetAreaSqft: 1420,
        superAreaSqft: 1890,
        price: 21500000,
        status: 'available',
        facing: 'East',
        furnishing: 'Semi-Furnished',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.unitNumber).toBe('O-1402');
    expect(res.body.data.status).toBe('available');
    unitId = res.body.data.id;
  });

  it('GET /api/properties/projects/:id/units lists units for the project', async () => {
    const res = await request(app)
      .get(`/api/properties/projects/${projectId}/units`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.items[0].unitNumber).toBe('O-1402');
  });

  it('PATCH /api/properties/units/:id/status updates unit status', async () => {
    const res = await request(app)
      .patch(`/api/properties/units/${unitId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'booked',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('booked');
  });
});
