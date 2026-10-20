import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../../src/server.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { createAuthenticatedUser } from '../helpers/test-fixtures.js';
import { projects, units, toolRuns } from '../../src/db/schema/index.js';
import { inventoryService } from '../../src/modules/inventory/inventory.service.js';
import { toolsService } from '../../src/modules/tools/tools.service.js';
import { parseBudget, parseUnitQuery, liveInventoryFacts } from '../../src/modules/tools/live-inventory.js';
import { renderTemplate, pickPath } from '../../src/modules/tools/api-tool.js';

describe('P2: tools and actions', () => {
  const app = createApp();
  let a: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let b: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let agentUser: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let server: http.Server;
  let base = '';
  const seen: Array<{ url?: string; auth?: string; key?: string; body: string }> = [];
  const api = (method: 'get' | 'post' | 'put' | 'delete', url: string, who = a) => request(app)[method](url).set('Authorization', who.authHeader);

  beforeAll(async () => {
    a = await createAuthenticatedUser('company_admin');
    b = await createAuthenticatedUser('company_admin');
    agentUser = await createAuthenticatedUser('agent', { id: a.company.id } as never);

    server = http.createServer((req, res) => {
      let body = '';
      req.on('data', c => (body += c));
      req.on('end', () => {
        seen.push({ url: req.url, auth: req.headers.authorization, key: req.headers['x-api-key'] as string | undefined, body });
        if (req.url?.startsWith('/redirect')) {
          res.writeHead(302, { Location: 'http://169.254.169.254/' }).end();
        } else if (req.url?.startsWith('/boom')) {
          res.writeHead(500).end('nope');
        } else {
          res.setHeader('Content-Type', 'application/json').end(JSON.stringify({ data: { items: [{ price: 12500000, tower: 'B' }] }, echo: req.url }));
        }
      });
    });
    await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const project = await inventoryService.createProject(a.company.id, { name: 'Lakeside Habitat', builderName: 'ACME', location: 'Whitefield' });
    const rows = [
      { tower: 'B', unitNumber: 'B-101', bhk: 3, price: '12500000', status: 'available' },
      { tower: 'B', unitNumber: 'B-202', bhk: 3, price: '18000000', status: 'available' },
      { tower: 'A', unitNumber: 'A-301', bhk: 2, price: '7000000', status: 'available' },
      { tower: 'B', unitNumber: 'B-303', bhk: 3, price: '9000000', status: 'sold' },
    ];
    for (const r of rows) {
      await testDb.insert(units).values({ companyId: a.company.id, projectId: project.id, carpetAreaSqft: '1100', floor: 1, ...r });
    }
  });
  afterAll(async () => {
    await new Promise(r => server.close(r));
    await cleanupTestDatabase([a.company.id, b.company.id]);
  });

  describe('helpers', () => {
    it('renders templates safely per mode', () => {
      expect(renderTemplate('/x?q={{q}}', { q: 'a b&c' }, 'url')).toBe('/x?q=a%20b%26c');
      expect(renderTemplate('{"n":"{{n}}"}', { n: 'he said "hi"\n' }, 'json')).toBe('{"n":"he said \\"hi\\"\\n"}');
      expect(renderTemplate('Hi {{missing}}!', {})).toBe('Hi !');
    });
    it('picks dot paths and refuses prototype keys', () => {
      expect(pickPath({ a: { b: [{ c: 5 }] } }, 'a.b.0.c')).toBe(5);
      expect(pickPath({ a: 1 }, 'a.b.c')).toBeUndefined();
      expect(pickPath({}, '__proto__.polluted')).toBeUndefined();
    });
    it('parses budgets and unit questions', () => {
      expect(parseBudget('3bhk under 1.5 Cr')).toBe(15_000_000);
      expect(parseBudget('below 80 lakh please')).toBe(8_000_000);
      expect(parseBudget('hello there')).toBeUndefined();
      expect(parseUnitQuery('is a 3BHK in Tower B available under 1.5 Cr?')).toEqual({ bhk: 3, maxPrice: 15_000_000, tower: 'B' });
      expect(parseUnitQuery('what are your timings')).toBeNull();
    });
  });

  describe('actions', () => {
    it('answers "is a 3BHK in Tower B available under 1.5 Cr?" live from inventory', async () => {
      const res = await api('post', '/api/actions/check_unit_availability/run').send({ input: { bhk: 3, tower: 'B', maxPrice: 15_000_000 } });
      expect(res.status).toBe(200);
      expect(res.body.data.available).toBe(true);
      expect(res.body.data.count).toBe(1);
      expect(res.body.data.units[0].unitNumber).toBe('B-101');
      expect(res.body.data.cheapestPrice).toBe(12_500_000);
    });
    it('does not offer sold units or other companies\' stock', async () => {
      const mine = await api('post', '/api/actions/search_inventory/run').send({ input: { bhk: 3 } });
      expect(mine.body.data.units.map((u: { unitNumber: string }) => u.unitNumber)).toEqual(['B-101', 'B-202']);
      const theirs = await api('post', '/api/actions/search_inventory/run', b).send({ input: { bhk: 3 } });
      expect(theirs.body.data.count).toBe(0);
    });
    it('checks one exact unit and reports sold ones as unavailable', async () => {
      const res = await api('post', '/api/actions/check_unit_availability/run').send({ input: { unitNumber: 'B-303' } });
      expect(res.body.data.available).toBe(false);
    });
    it('lists the catalogue and rejects unknown actions', async () => {
      const list = await api('get', '/api/actions');
      expect(list.body.data.map((x: { id: string }) => x.id)).toEqual(expect.arrayContaining(['search_inventory', 'update_lead_stage']));
      expect((await api('post', '/api/actions/nope/run').send({ input: {} })).status).toBe(404);
    });
    it('builds authoritative live facts for chat, or null for small talk', async () => {
      const facts = await liveInventoryFacts(a.company.id, 'Is a 3BHK in Tower B available under 1.5 Cr?');
      expect(facts).toContain('B-101');
      expect(facts).not.toContain('B-202');
      expect(await liveInventoryFacts(a.company.id, 'Hello!')).toBeNull();
      const none = await liveInventoryFacts(a.company.id, 'any 5 bhk under 10 lakh available?');
      expect(none).toContain('NO matching units');
    });
  });

  describe('API tools', () => {
    let toolId = '';
    const body = () => ({
      key: 'price_lookup',
      name: 'Price lookup',
      type: 'api',
      config: {
        method: 'GET',
        url: `${base}/prices?tower={{tower}}`,
        authMode: 'bearer',
        responseMapping: { price: 'data.items.0.price', missing: 'data.nope' },
      },
      inputSchema: [{ key: 'tower', type: 'string', required: true }],
      secret: 'super-secret-token',
    });

    it('creates a tool, never returns the secret, and isolates tenants', async () => {
      const res = await api('post', '/api/tools').send(body());
      expect(res.status).toBe(201);
      toolId = res.body.data.id;
      expect(res.body.data.hasSecret).toBe(true);
      expect(JSON.stringify(res.body)).not.toContain('super-secret-token');
      expect(JSON.stringify(res.body)).not.toContain('vault:v1');
      expect((await api('get', `/api/tools/${toolId}`, b)).status).toBe(404);
      expect((await api('get', '/api/tools', b)).body.data).toEqual([]);
      expect((await api('post', '/api/tools').send(body())).status).toBe(409);
    });
    it('only managers may manage tools', async () => {
      expect((await api('get', '/api/tools', agentUser)).status).toBe(403);
    });
    it('calls the endpoint with the vaulted bearer token, maps the response and logs the run', async () => {
      const res = await api('post', `/api/tools/${toolId}/run`).send({ input: { tower: 'B & C' } });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ok');
      expect(res.body.data.output).toEqual({ price: 12_500_000, missing: undefined });
      const hit = seen.at(-1)!;
      expect(hit.url).toBe('/prices?tower=B%20%26%20C');
      expect(hit.auth).toBe('Bearer super-secret-token');
      const runs = await api('get', `/api/tools/${toolId}/runs`);
      expect(runs.body.data.length).toBeGreaterThan(0);
      expect(JSON.stringify(runs.body)).not.toContain('super-secret-token');
    });
    it('records validation errors, HTTP failures and refuses redirects', async () => {
      const missing = await api('post', `/api/tools/${toolId}/run`).send({ input: {} });
      expect(missing.body.data.status).toBe('error');
      expect(missing.body.data.error).toContain('tower');

      const boom = await api('post', '/api/tools').send({ ...body(), key: 'boom_tool', config: { method: 'GET', url: `${base}/boom` }, secret: undefined, inputSchema: [] });
      const failed = await api('post', `/api/tools/${boom.body.data.id}/run`).send({ input: {} });
      expect(failed.body.data.status).toBe('error');
      expect(failed.body.data.error).toContain('500');

      const redir = await api('post', '/api/tools').send({ ...body(), key: 'redir_tool', config: { method: 'GET', url: `${base}/redirect` }, secret: undefined, inputSchema: [] });
      const blocked = await api('post', `/api/tools/${redir.body.data.id}/run`).send({ input: {} });
      expect(blocked.body.data.status).toBe('error');
      expect(blocked.body.data.error).toContain('redirect');
    });
    it('blocks private addresses (SSRF) even though localhost is allowed in tests', async () => {
      const t = await api('post', '/api/tools').send({ ...body(), key: 'ssrf_tool', config: { method: 'GET', url: 'http://169.254.169.254/latest/meta-data' }, secret: undefined, inputSchema: [] });
      const run = await api('post', `/api/tools/${t.body.data.id}/run`).send({ input: {} });
      expect(run.body.data.status).toBe('error');
      expect(run.body.data.error).toContain('SSRF');
    });
    it('holds agent-initiated calls of approval-required tools instead of running them', async () => {
      const t = await api('post', '/api/tools').send({ ...body(), key: 'approval_tool', requiresApproval: true, secret: undefined, inputSchema: [], config: { method: 'POST', url: `${base}/book` } });
      const before = seen.length;
      const run = await toolsService.execute(a.company.id, t.body.data.id, {}, { source: 'agent' });
      expect(run.status).toBe('pending_approval');
      expect(seen.length).toBe(before);
      const test = await toolsService.execute(a.company.id, t.body.data.id, {}, { source: 'test' });
      expect(test.status).toBe('ok');
    });
    it('enforces the per-minute rate limit and the disabled state', async () => {
      const t = await api('post', '/api/tools').send({ ...body(), key: 'limited_tool', rateLimitPerMin: 2, secret: undefined, inputSchema: [], config: { method: 'GET', url: `${base}/ok` } });
      const id = t.body.data.id as string;
      const results = [];
      for (let i = 0; i < 3; i++) results.push((await toolsService.execute(a.company.id, id, {}, { source: 'test' })).status);
      expect(results).toEqual(['ok', 'ok', 'blocked']);
      await api('put', `/api/tools/${id}`).send({ status: 'disabled' });
      expect((await toolsService.execute(a.company.id, id, {}, { source: 'test' })).status).toBe('blocked');
    });
    it('keeps the secret on update unless replaced or cleared, and soft-deletes', async () => {
      const upd = await api('put', `/api/tools/${toolId}`).send({ name: 'Price lookup v2' });
      expect(upd.body.data.hasSecret).toBe(true);
      const cleared = await api('put', `/api/tools/${toolId}`).send({ clearSecret: true });
      expect(cleared.body.data.hasSecret).toBe(false);
      expect((await api('delete', `/api/tools/${toolId}`)).status).toBe(200);
      expect((await api('get', `/api/tools/${toolId}`)).status).toBe(404);
      const rows = await testDb.select().from(toolRuns).where(eq(toolRuns.companyId, a.company.id));
      expect(rows.length).toBeGreaterThan(0);
    });
    it('validates config on create', async () => {
      const bad = await api('post', '/api/tools').send({ ...body(), key: 'bad_cfg', config: { method: 'GET' } });
      expect(bad.status).toBe(400);
    });
  });

  it('project rows are untouched by tool tests', async () => {
    const rows = await testDb.select().from(projects).where(eq(projects.companyId, a.company.id));
    expect(rows).toHaveLength(1);
  });
});
