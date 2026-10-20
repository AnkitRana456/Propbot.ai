import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../../src/server.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { createAuthenticatedUser } from '../helpers/test-fixtures.js';
import { chatbots, messages, projects } from '../../src/db/schema/index.js';
import { inventoryService } from '../../src/modules/inventory/inventory.service.js';

describe('Phase 6: media in chat (photos, floor plans, master plan, map)', () => {
  const app = createApp();
  let admin: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let publicKey: string;
  let companyId: string;
  let otherCompanyId: string;

  const session = async () => {
    const res = await request(app).post('/public/session').send({ publicKey, visitorId: `v_${crypto.randomBytes(5).toString('hex')}` });
    return { token: res.body.data.sessionToken as string, conversationId: res.body.data.conversationId as string };
  };
  const say = (s: { token: string; conversationId: string }, message: string) =>
    request(app).post('/public/message').set('Authorization', `Bearer ${s.token}`).send({ conversationId: s.conversationId, message });

  beforeAll(async () => {
    admin = await createAuthenticatedUser('company_admin');
    companyId = admin.company.id;
    const other = await createAuthenticatedUser('company_admin');
    otherCompanyId = other.company.id;

    publicKey = `pb_media_${crypto.randomBytes(6).toString('hex')}`;
    await testDb
      .insert(chatbots)
      .values({ companyId, name: 'Media Bot', type: 'web', status: 'active', publicKey, config: {} });

    await inventoryService.createProject(companyId, {
      name: 'Lakeside Habitat',
      builderName: 'ACME',
      location: 'Whitefield',
      latitude: 12.9716,
      longitude: 77.5946,
      highlightPhotos: ['https://cdn.example.com/lake-1.jpg', 'https://cdn.example.com/lake-2.jpg'],
      masterPlanUrl: 'https://cdn.example.com/lake-master.png',
      floorPlans: [
        { title: '2BHK Type A', bhk: 2, carpetAreaSqft: 850, planUrl: 'https://cdn.example.com/lake-2a.png' },
        { title: '3BHK Type B', bhk: 3, carpetAreaSqft: 1200, planUrl: 'https://cdn.example.com/lake-3b.png' },
      ],
    });
    // A second project of the same company, to test "named in the message" selection
    await inventoryService.createProject(companyId, {
      name: 'Skyline Towers',
      builderName: 'ACME',
      location: 'Hebbal',
      highlightPhotos: ['https://cdn.example.com/sky-1.jpg'],
      masterPlanUrl: 'https://cdn.example.com/sky-master.png',
    });
    // Another company's project must never leak
    await inventoryService.createProject(otherCompanyId, {
      name: 'Secret Rival Project',
      builderName: 'Rival',
      location: 'Elsewhere',
      highlightPhotos: ['https://cdn.example.com/rival.jpg'],
    });
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId, otherCompanyId]);
  });

  it('the new project columns round-trip through the inventory service', async () => {
    const rows = await testDb.select().from(projects).where(eq(projects.companyId, companyId));
    const lake = rows.find(r => r.name === 'Lakeside Habitat')!;
    expect(lake.highlightPhotos).toEqual(['https://cdn.example.com/lake-1.jpg', 'https://cdn.example.com/lake-2.jpg']);
    expect(lake.masterPlanUrl).toBe('https://cdn.example.com/lake-master.png');
  });

  it('first message auto-shows highlight photos of the (latest) project; later messages do not', async () => {
    const s = await session();
    const first = await say(s, 'Hello');
    expect(first.status).toBe(200);
    const kinds = (first.body.data.media as Array<{ kind: string; urls: string[] }>).map(m => m.kind);
    expect(kinds).toEqual(['highlight_photos']);
    const urls = first.body.data.media[0].urls as string[];
    expect(urls.every(u => u.startsWith('https://cdn.example.com/'))).toBe(true);
    expect(urls.join()).not.toContain('rival'); // tenant isolation

    const second = await say(s, 'What is the possession date?');
    expect(second.body.data.media).toEqual([]);
  });

  it('floor plan questions return the matching BHK plan', async () => {
    const s = await session();
    await say(s, 'hi');
    const res = await say(s, 'Show me the 3BHK floor plan of Lakeside Habitat');
    const plan = (res.body.data.media as Array<{ kind: string; urls: string[]; caption: string }>).find(m => m.kind === 'floor_plan')!;
    expect(plan.urls).toEqual(['https://cdn.example.com/lake-3b.png']);
    expect(plan.caption).toContain('1200 sq ft');
  });

  it('master plan, project layout and location triggers', async () => {
    const s = await session();
    await say(s, 'hi');
    const master = await say(s, 'Can I see the master plan of Lakeside Habitat?');
    expect(master.body.data.media.map((m: { kind: string }) => m.kind)).toContain('master_plan');

    const layout = await say(s, 'share the project layout for Lakeside Habitat');
    const lk = layout.body.data.media.map((m: { kind: string }) => m.kind);
    expect(lk).toContain('master_plan');
    expect(lk).not.toContain('floor_plan');

    const where = await say(s, 'How to reach Lakeside Habitat?');
    const map = where.body.data.media.find((m: { kind: string }) => m.kind === 'location_map');
    expect(map.embedUrl).toBe('https://www.google.com/maps?q=12.9716,77.5946&output=embed');
  });

  it('a project named in the message wins over the default project', async () => {
    const s = await session();
    await say(s, 'hi');
    const res = await say(s, 'master plan of Skyline Towers please');
    const master = res.body.data.media.find((m: { kind: string }) => m.kind === 'master_plan');
    expect(master.urls).toEqual(['https://cdn.example.com/sky-master.png']);
  });

  it('media is kept on the stored bot message and returned with the conversation history', async () => {
    const s = await session();
    await say(s, 'hello');
    const hist = await request(app).get('/public/history').set('Authorization', `Bearer ${s.token}`).query({ conversationId: s.conversationId });
    expect(hist.status).toBe(200);
    const bot = hist.body.data.messages.filter((m: { senderType: string }) => m.senderType === 'bot').pop();
    expect(bot.metadata.media[0].kind).toBe('highlight_photos');
    const rows = await testDb.select().from(messages).where(eq(messages.conversationId, s.conversationId));
    expect(rows.some(r => (r.metadata as { media?: unknown[] }).media?.length)).toBe(true);
  });

  it('a pinned config.mediaProjectId is used when no project is named', async () => {
    const [pinnedProject] = (await testDb.select().from(projects).where(eq(projects.companyId, companyId))).filter(p => p.name === 'Skyline Towers');
    await testDb.update(chatbots).set({ config: { mediaProjectId: pinnedProject!.id } }).where(eq(chatbots.publicKey, publicKey));
    const s = await session();
    await say(s, 'hi');
    const res = await say(s, 'where is it');
    expect(res.body.data.media.find((m: { kind: string }) => m.kind === 'location_map')).toBeUndefined(); // Skyline has no coordinates
    const master = await say(s, 'show the site plan');
    expect(master.body.data.media[0].urls).toEqual(['https://cdn.example.com/sky-master.png']);
    await testDb.update(chatbots).set({ config: {} }).where(eq(chatbots.publicKey, publicKey));
  });

  it('companies without any project still chat normally (no media, no error)', async () => {
    const lone = await createAuthenticatedUser('company_admin');
    const key = `pb_lone_${crypto.randomBytes(5).toString('hex')}`;
    await testDb.insert(chatbots).values({ companyId: lone.company.id, name: 'Lone', type: 'web', status: 'active', publicKey: key, config: {} });
    const sres = await request(app).post('/public/session').send({ publicKey: key, visitorId: 'v_lone' });
    const res = await request(app)
      .post('/public/message')
      .set('Authorization', `Bearer ${sres.body.data.sessionToken}`)
      .send({ conversationId: sres.body.data.conversationId, message: 'hello, show me the floor plan' });
    expect(res.status).toBe(200);
    expect(res.body.data.media).toEqual([]);
    await cleanupTestDatabase([lone.company.id]);
  }, 30_000);

  it('the properties API rejects non-https media URLs and saves valid ones', async () => {
    const [lake] = (await testDb.select().from(projects).where(eq(projects.companyId, companyId))).filter(p => p.name === 'Lakeside Habitat');
    const bad = await request(app)
      .put(`/api/properties/projects/${lake!.id}`)
      .set('Authorization', admin.authHeader)
      .send({ highlightPhotos: ['http://insecure.example.com/x.jpg'] });
    expect(bad.status).toBe(400);
    const badPlan = await request(app)
      .put(`/api/properties/projects/${lake!.id}`)
      .set('Authorization', admin.authHeader)
      .send({ masterPlanUrl: 'javascript:alert(1)' });
    expect(badPlan.status).toBe(400);

    const ok = await request(app)
      .put(`/api/properties/projects/${lake!.id}`)
      .set('Authorization', admin.authHeader)
      .send({ highlightPhotos: ['https://cdn.example.com/new.jpg'], masterPlanUrl: null });
    expect(ok.status).toBe(200);
    const saved = ok.body.data ?? ok.body;
    expect(saved.highlightPhotos).toEqual(['https://cdn.example.com/new.jpg']);
    expect(saved.masterPlanUrl).toBeNull();
  });
});
