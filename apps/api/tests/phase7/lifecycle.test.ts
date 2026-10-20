import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import crypto from 'node:crypto';
import request from 'supertest';
import { and, eq } from 'drizzle-orm';
import { createApp } from '../../src/server.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { createAuthenticatedUser } from '../helpers/test-fixtures.js';
import { chatbots, contacts, conversations, leads, messages } from '../../src/db/schema/index.js';
import { scheduledJobsService, ARCHIVE_STUB_MESSAGE } from '../../src/jobs/scheduled-jobs.service.js';
import { leadsService } from '../../src/modules/leads/leads.service.js';
import { csvCell } from '../../src/modules/chatbots/leads-export.service.js';

const DAY = 86_400_000;

describe('30-day chat retention', () => {
  let companyId: string;
  let botId: string;
  let leadId: string;
  let contactId: string;
  const ids: Record<string, string> = {};

  async function convo(label: string, ageDays: number, msgCount: number, linked = false) {
    const at = new Date(Date.now() - ageDays * DAY);
    const [c] = await testDb
      .insert(conversations)
      .values({
        companyId,
        chatbotId: botId,
        channel: 'web',
        status: 'bot',
        metadata: {},
        leadId: linked ? leadId : null,
        contactId: linked ? contactId : null,
        createdAt: at,
        updatedAt: at,
      })
      .returning();
    for (let i = 0; i < msgCount; i++) {
      await testDb.insert(messages).values({
        companyId,
        conversationId: c!.id,
        senderType: i % 2 ? 'bot' : 'visitor',
        content: `${label} message ${i}`,
        createdAt: new Date(at.getTime() + i * 1000),
      });
    }
    ids[label] = c!.id;
    return c!;
  }

  beforeAll(async () => {
    const a = await createAuthenticatedUser('company_admin');
    companyId = a.company.id;
    const [bot] = await testDb
      .insert(chatbots)
      .values({ companyId, name: 'Retention Bot', type: 'web', status: 'active', publicKey: `pb_ret_${crypto.randomBytes(6).toString('hex')}`, config: {} })
      .returning();
    botId = bot!.id;
    const { lead } = await leadsService.captureOrUpdateLead(companyId, { chatbotId: botId, name: 'Kept Lead', phone: '9890000031' });
    leadId = lead.id;
    contactId = lead.contactId;

    await convo('old-with-lead', 45, 6, true);
    await convo('old-anon-bounced', 40, 1);
    await convo('old-anon-empty', 40, 0);
    await convo('old-anon-chatty', 40, 4); // anonymous but real conversation: archived, not deleted
    await convo('recent', 3, 5, true);
    // old creation date but active yesterday: must be left alone
    const active = await convo('old-but-active', 60, 2);
    await testDb.insert(messages).values({ companyId, conversationId: active.id, senderType: 'visitor', content: 'still here', createdAt: new Date(Date.now() - DAY) });
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  const msgsOf = (id: string) => testDb.select().from(messages).where(eq(messages.conversationId, id));
  const convOf = async (id: string) => (await testDb.select().from(conversations).where(eq(conversations.id, id)))[0];

  it('archives old chats to a stub, keeps records, timestamps and lead links, deletes anonymous empty/bounced chats', async () => {
    const result = await scheduledJobsService.archiveOldChats(new Date(), 200, companyId);
    expect(result).toEqual({ archived: 2, deleted: 2 });

    // archived: one stub message, row + links + original timestamps preserved
    const withLead = await msgsOf(ids['old-with-lead']!);
    expect(withLead).toHaveLength(1);
    expect(withLead[0]!.content).toBe(ARCHIVE_STUB_MESSAGE);
    const row = await convOf(ids['old-with-lead']!);
    expect(row!.leadId).toBe(leadId);
    expect(row!.contactId).toBe(contactId);
    expect(row!.metadata).toHaveProperty('archivedAt');
    expect(Date.now() - row!.createdAt.getTime()).toBeGreaterThan(44 * DAY);

    const chatty = await msgsOf(ids['old-anon-chatty']!);
    expect(chatty.map(m => m.content)).toEqual([ARCHIVE_STUB_MESSAGE]);
    expect(await convOf(ids['old-anon-chatty']!)).toBeDefined();

    // anonymous 0-1 message chats are permanently deleted
    expect(await convOf(ids['old-anon-bounced']!)).toBeUndefined();
    expect(await convOf(ids['old-anon-empty']!)).toBeUndefined();
    expect(await msgsOf(ids['old-anon-bounced']!)).toHaveLength(0);

    // recent and recently-active chats are untouched
    expect(await msgsOf(ids['recent']!)).toHaveLength(5);
    expect(await msgsOf(ids['old-but-active']!)).toHaveLength(3);

    // the lead itself is untouched
    const [lead] = await testDb.select().from(leads).where(eq(leads.id, leadId));
    expect(lead).toBeDefined();
  });

  it('is idempotent: a second run changes nothing and never re-archives the stub', async () => {
    const again = await scheduledJobsService.archiveOldChats(new Date(), 200, companyId);
    expect(again).toEqual({ archived: 0, deleted: 0 });
    expect(await msgsOf(ids['old-with-lead']!)).toHaveLength(1);
  });

  it('a later run (31+ days on) also archives the chats that were recent today', async () => {
    const future = new Date(Date.now() + 40 * DAY);
    const result = await scheduledJobsService.archiveOldChats(future, 200, companyId);
    expect(result.archived).toBeGreaterThanOrEqual(2);
    expect((await msgsOf(ids['recent']!)).map(m => m.content)).toEqual([ARCHIVE_STUB_MESSAGE]);
  });
});

describe('cron endpoints require CRON_SECRET', () => {
  const app = createApp();
  const saved = process.env.CRON_SECRET;
  afterAll(() => {
    if (saved === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = saved;
  });

  it('rejects calls without / with a wrong secret, and when no secret is configured at all', async () => {
    delete process.env.CRON_SECRET;
    expect((await request(app).post('/api/cron/archive-chats')).status).toBe(401);
    expect((await request(app).post('/api/cron/archive-chats').set('Authorization', 'Bearer ')).status).toBe(401);

    process.env.CRON_SECRET = 'cron-secret-for-tests';
    expect((await request(app).post('/api/cron/archive-chats')).status).toBe(401);
    expect((await request(app).get('/api/cron/archive-chats').set('Authorization', 'Bearer nope')).status).toBe(401);
    expect((await request(app).post('/api/cron/archive-chats').set('x-cron-secret', 'x')).status).toBe(401);
  });

  it('runs the job with the right secret (Bearer or x-cron-secret; GET or POST). The job is stubbed so no real data is touched', async () => {
    process.env.CRON_SECRET = 'cron-secret-for-tests';
    const spy = vi.spyOn(scheduledJobsService, 'archiveOldChats').mockResolvedValue({ archived: 3, deleted: 1 });
    const post = await request(app).post('/api/cron/archive-chats').set('Authorization', 'Bearer cron-secret-for-tests');
    expect(post.status).toBe(200);
    expect(post.body.data).toEqual({ archived: 3, deleted: 1 });
    const get = await request(app).get('/api/cron/archive-chats').set('x-cron-secret', 'cron-secret-for-tests');
    expect(get.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });
});

describe('chatbot deletion keeps leads; CSV export', () => {
  const app = createApp();
  let a: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let other: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let botId: string;
  let publicKey: string;

  beforeAll(async () => {
    a = await createAuthenticatedUser('company_admin');
    other = await createAuthenticatedUser('company_admin');
    publicKey = `pb_del_${crypto.randomBytes(6).toString('hex')}`;
    const [bot] = await testDb
      .insert(chatbots)
      .values({ companyId: a.company.id, name: 'Delete Me Bot', type: 'web', status: 'active', publicKey, config: {} })
      .returning();
    botId = bot!.id;
    await leadsService.captureOrUpdateLead(a.company.id, {
      chatbotId: botId,
      name: '=HYPERLINK("http://evil.test","click")',
      phone: '9890000041',
      email: 'safe@example.com',
      utmParams: { utm_source: 'google', utm_agencypartner: 'acme' },
    });
    await leadsService.captureOrUpdateLead(a.company.id, { chatbotId: botId, name: 'Second, "Quoted" Lead', phone: '9890000042' });
  });

  afterAll(async () => {
    await cleanupTestDatabase([a.company.id, other.company.id]);
  });

  it('soft-deletes: the chatbot stops serving, but every lead and contact is kept', async () => {
    const before = await testDb.select().from(leads).where(eq(leads.chatbotId, botId));
    expect(before).toHaveLength(2);

    const res = await request(app).delete(`/api/chatbots/${botId}`).set('Authorization', a.authHeader);
    expect(res.status).toBe(200);
    expect(res.body.leadsRetained).toBe(true);
    expect(res.body.exportUrl).toBe(`/api/chatbots/${botId}/leads/export`);

    const [bot] = await testDb.select().from(chatbots).where(eq(chatbots.id, botId));
    expect(bot!.deletedAt).not.toBeNull(); // row still exists
    const after = await testDb.select().from(leads).where(eq(leads.chatbotId, botId));
    expect(after).toHaveLength(2);
    expect(after.every(l => l.deletedAt === null)).toBe(true);
    const cs = await testDb.select().from(contacts).where(and(eq(contacts.companyId, a.company.id)));
    expect(cs.length).toBeGreaterThanOrEqual(2);

    expect((await request(app).get(`/public/config/${publicKey}`)).status).toBe(404);
  });

  it('exports the deleted chatbot’s leads as CSV with formula-injection protection and UTMs', async () => {
    const res = await request(app).get(`/api/chatbots/${botId}/leads/export`).set('Authorization', a.authHeader);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="leads-delete-me-bot\.csv"/);
    expect(res.headers['x-lead-count']).toBe('2');

    const lines = res.text.replace(/^\uFEFF/, '').trim().split('\r\n');
    expect(lines[0]).toContain('UTMAgencyPartner');
    expect(lines).toHaveLength(3);
    const csv = res.text;
    expect(csv).toContain(`"'=HYPERLINK(""http://evil.test"",""click"")"`); // neutralised with a leading apostrophe
    expect(csv).not.toMatch(/,=HYPERLINK/);
    expect(csv).toContain('"Second, ""Quoted"" Lead"');
    expect(csv).toContain('+919890000041');
    expect(csv).toContain('acme');
  });

  it('does not export another company’s chatbot', async () => {
    const res = await request(app).get(`/api/chatbots/${botId}/leads/export`).set('Authorization', other.authHeader);
    expect(res.status).toBe(404);
    expect((await request(app).get(`/api/chatbots/${botId}/leads/export`)).status).toBe(401);
  });

  it('csvCell neutralises = + - @ and quotes separators', () => {
    expect(csvCell('=1+1')).toBe("'=1+1");
    expect(csvCell('+91 98')).toBe("'+91 98");
    expect(csvCell('-2')).toBe("'-2");
    expect(csvCell('@x')).toBe("'@x");
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell(null)).toBe('');
  });
});
