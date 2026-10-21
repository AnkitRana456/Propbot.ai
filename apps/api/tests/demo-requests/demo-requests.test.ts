import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { eq, inArray } from 'drizzle-orm';
import { createApp } from '../../src/server.js';
import { testDb } from '../helpers/test-db.js';
import { demoRequests } from '../../src/db/schema/index.js';

describe('POST /api/demo-requests (public marketing form)', () => {
  const app = createApp();
  const tag = `demo-${Date.now()}`;
  const body = (over: object = {}) => ({ name: 'Asha Rao', email: `${tag}-a@example.com`, mobile: '+91 98660 00001', agency: 'Skyline Realty', listings: '51-200', ...over });
  const post = (b: object, bypass = true) => {
    const r = request(app).post('/api/demo-requests');
    return (bypass ? r.set('x-bypass-rate-limit', 'test-bypass') : r).send(b);
  };

  afterAll(async () => {
    await testDb.delete(demoRequests).where(inArray(demoRequests.email, [`${tag}-a@example.com`, `${tag}-b@example.com`, `${tag}-bot@example.com`, `${tag}-rl@example.com`]));
  });

  it('stores a valid request without needing a login', async () => {
    const res = await post(body());
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.data).toEqual({ received: true });
    const rows = await testDb.select().from(demoRequests).where(eq(demoRequests.email, `${tag}-a@example.com`));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ agency: 'Skyline Realty', listings: '51-200', status: 'new' });
  });

  it('does not store the same e-mail twice within a day', async () => {
    expect((await post(body())).status).toBe(201);
    const rows = await testDb.select().from(demoRequests).where(eq(demoRequests.email, `${tag}-a@example.com`));
    expect(rows).toHaveLength(1);
  });

  it('rejects bad input', async () => {
    expect((await post(body({ email: 'nope' }))).status).toBe(400);
    expect((await post(body({ mobile: '12' }))).status).toBe(400);
    expect((await post(body({ name: '' }))).status).toBe(400);
    expect((await post(body({ listings: 'lots' }))).status).toBe(400);
    expect((await post({})).status).toBe(400);
  });

  it('quietly drops honeypot submissions', async () => {
    const res = await post(body({ email: `${tag}-bot@example.com`, website: 'http://spam.example' }));
    expect(res.status).toBe(201);
    const rows = await testDb.select().from(demoRequests).where(eq(demoRequests.email, `${tag}-bot@example.com`));
    expect(rows).toHaveLength(0);
  });

  it('rate limits repeated submissions from one address', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await post(body({ email: `${tag}-rl@example.com` }), false)).status);
    expect(statuses).toContain(429);
  });
});
