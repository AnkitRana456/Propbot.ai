import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { MemoryRateLimiter } from '../../src/middlewares/rate-limiter.js';

describe('Security: Per-Tenant and Per-IP Rate Limiting (Phase 14.1)', () => {
  it('allows requests within threshold and blocks excess with HTTP 429', async () => {
    const testLimiter = new MemoryRateLimiter({
      windowMs: 10000,
      max: 3,
      message: 'Rate limit exceeded for testing.',
      skipInTests: false,
    });

    const app = express();
    app.use(testLimiter.middleware());
    app.get('/test', (_req, res) => {
      res.json({ ok: true });
    });

    // 1st request -> Allowed
    const res1 = await request(app).get('/test').set('x-forwarded-for', '192.168.1.100');
    expect(res1.status).toBe(200);
    expect(res1.headers['x-ratelimit-remaining']).toBe('2');

    // 2nd request -> Allowed
    const res2 = await request(app).get('/test').set('x-forwarded-for', '192.168.1.100');
    expect(res2.status).toBe(200);
    expect(res2.headers['x-ratelimit-remaining']).toBe('1');

    // 3rd request -> Allowed
    const res3 = await request(app).get('/test').set('x-forwarded-for', '192.168.1.100');
    expect(res3.status).toBe(200);
    expect(res3.headers['x-ratelimit-remaining']).toBe('0');

    // 4th request -> Blocked with 429
    const res4 = await request(app).get('/test').set('x-forwarded-for', '192.168.1.100');
    expect(res4.status).toBe(429);
    expect(res4.body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(res4.headers['retry-after']).toBeDefined();

    // Different IP is NOT blocked
    const resDiffIp = await request(app).get('/test').set('x-forwarded-for', '192.168.1.101');
    expect(resDiffIp.status).toBe(200);
  });
});
