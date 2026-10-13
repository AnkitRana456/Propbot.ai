import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import {
  companies,
  users,
  chatbots,
  conversations,
} from '../../src/db/schema/index.js';
import { forecastingService } from '../../src/modules/analytics/forecasting.service.js';

describe('30-Day Time-Series Forecasting Engine', () => {
  const app = createApp();
  const companyId = '99999999-9999-9999-9999-999999999924';
  const userId = '00000000-0000-0000-0000-000000000205';
  const botId = '88888888-8888-8888-8888-888888888803';

  const token = signAccessToken({
    sub: userId,
    companyId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@forecasttest.com',
    name: 'Forecast Admin',
  });

  beforeAll(async () => {
    await cleanupTestDatabase([companyId]);

    await testDb
      .insert(companies)
      .values({ id: companyId, name: 'Forecast Realty', slug: 'forecast-realty', plan: 'enterprise', status: 'active' })
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values({ id: userId, companyId, name: 'Admin', email: 'admin@forecasttest.com', role: 'company_admin', status: 'active', passwordHash: 'dummy' })
      .onConflictDoNothing();

    await testDb
      .insert(chatbots)
      .values({ id: botId, companyId, name: 'Bot', status: 'active', publicKey: 'pub_forecast_bot_01' })
      .onConflictDoNothing();

    // Seed conversations across multiple days
    for (let i = 1; i <= 10; i++) {
      await testDb.insert(conversations).values({
        companyId,
        chatbotId: botId,
        channel: 'web',
        status: 'bot',
        createdAt: new Date(Date.now() - i * 86400000),
      });
    }
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  it('unit: mathematical forecaster produces 30 points with confidence intervals and estimate flag', () => {
    const historical = [
      { date: '2026-09-01', value: 12 },
      { date: '2026-09-02', value: 15 },
      { date: '2026-09-03', value: 18 },
      { date: '2026-09-04', value: 14 },
      { date: '2026-09-05', value: 22 },
      { date: '2026-09-06', value: 28 },
      { date: '2026-09-07', value: 20 },
    ];

    const result = forecastingService.generate30DayForecast(historical, 'conversations');

    expect(result.metric).toBe('conversations');
    expect(result.isEstimate).toBe(true);
    expect(result.points.length).toBe(30);

    for (const pt of result.points) {
      expect(pt.date).toBeDefined();
      expect(pt.predictedValue).toBeGreaterThanOrEqual(0);
      expect(pt.confidenceUpper).toBeGreaterThanOrEqual(pt.predictedValue);
      expect(pt.predictedValue).toBeGreaterThanOrEqual(pt.confidenceLower);
      expect(pt.isEstimate).toBe(true);
    }
  });

  it('integration: GET /api/analytics/forecast returns explainable 30-day forecast', async () => {
    const res = await request(app)
      .get('/api/analytics/forecast?metric=conversations')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.isEstimate).toBe(true);
    expect(data.points.length).toBe(30);
    expect(data.methodology).toContain('moving average');
  });
});
