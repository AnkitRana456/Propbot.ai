import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import {
  companies,
  users,
  calendarIntegrations,
} from '../../src/db/schema/index.js';

describe('Google Calendar Integration & Mock Provider', () => {
  const app = createApp();
  const companyId = '88888888-8888-8888-8888-888888888883';
  const userId = '00000000-0000-0000-0000-000000000083';

  const adminToken = signAccessToken({
    sub: userId,
    companyId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@calendar-sync.com',
    name: 'Admin Calendar',
  });

  beforeAll(async () => {
    await cleanupTestDatabase([companyId]);
    await testDb
      .insert(companies)
      .values({
        id: companyId,
        name: 'Calendar Realty Ltd',
        slug: 'calendar-realty-p8',
        plan: 'growth',
        status: 'active',
      })
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values({
        id: userId,
        companyId,
        name: 'Admin Calendar',
        email: 'admin@calendar-sync.com',
        passwordHash: 'hash',
        role: 'company_admin',
        status: 'active',
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  it('checks calendar integration status when not connected (dashboard_only)', async () => {
    const res = await request(app)
      .get('/api/appointments/calendar/status')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isConnected).toBe(false);
  });

  it('connects Google Calendar via mock OAuth callback and generates active integration', async () => {
    const res = await request(app)
      .post('/api/appointments/calendar/mock-connect')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'agent@proprealty.com',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isConnected).toBe(true);
    expect(res.body.data.email).toBe('agent@proprealty.com');

    // Verify stored in calendarIntegrations table
    const [integration] = await testDb
      .select()
      .from(calendarIntegrations);
    expect(integration).toBeDefined();
    expect(integration.isConnected).toBe(true);
  });

  it('disconnects Google Calendar and resets status', async () => {
    const res = await request(app)
      .delete('/api/appointments/calendar/disconnect')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const statusRes = await request(app)
      .get('/api/appointments/calendar/status')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(statusRes.body.data.isConnected).toBe(false);
  });
});
