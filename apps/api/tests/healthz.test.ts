import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/server.js';

describe('GET /healthz', () => {
  const app = createApp();

  it('returns 200 OK with expected health payload', async () => {
    const res = await request(app).get('/healthz');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('service', 'propbot-api');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('memory');
    expect(res.body.memory).toHaveProperty('rssMb');
  });

  it('returns 404 for unknown endpoints', async () => {
    const res = await request(app).get('/unknown-endpoint');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toHaveProperty('code', 'NOT_FOUND');
  });

  it('GET /healthz/ready returns 200 with database connected status', async () => {
    const res = await request(app).get('/healthz/ready');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ready');
    expect(res.body).toHaveProperty('database', 'connected');
  });
});
