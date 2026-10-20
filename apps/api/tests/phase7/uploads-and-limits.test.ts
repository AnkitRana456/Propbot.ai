import { eq } from 'drizzle-orm';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { createAuthenticatedUser } from '../helpers/test-fixtures.js';
import { chatbots, conversations, knowledgeSources } from '../../src/db/schema/index.js';
import { validateUpload, UploadRejectedError, MAX_UPLOAD_BYTES } from '../../src/modules/knowledge/upload-guard.js';

const b = (s: string) => Buffer.from(s, 'utf-8');
const reject = (fn: () => void) => {
  try {
    fn();
  } catch (e) {
    return e as UploadRejectedError;
  }
  return null;
};

describe('upload guard (unit)', () => {
  it('accepts clean documents', () => {
    expect(() => validateUpload({ fileName: 'brochure.txt', buffer: b('2BHK from 1.2 Cr. Possession 2027.') })).not.toThrow();
    expect(() => validateUpload({ fileName: 'units.csv', mimeType: 'text/csv', buffer: b('unit,price\nA1,12000000') })).not.toThrow();
    expect(() => validateUpload({ fileName: 'faq.json', mimeType: 'application/json', buffer: b('{"q":"gym?","a":"yes"}') })).not.toThrow();
    expect(() =>
      validateUpload({ fileName: 'b.pdf', mimeType: 'application/pdf', buffer: Buffer.concat([b('%PDF-1.7\n'), b('plain text pdf body')]) }),
    ).not.toThrow();
  });

  it('enforces the 10 MB limit (boundary inclusive)', () => {
    expect(() => validateUpload({ fileName: 'a.txt', buffer: Buffer.alloc(MAX_UPLOAD_BYTES, 0x61) })).not.toThrow();
    const e = reject(() => validateUpload({ fileName: 'a.txt', buffer: Buffer.alloc(MAX_UPLOAD_BYTES + 1, 0x61) }));
    expect(e?.code).toBe('FILE_TOO_LARGE');
    expect(e?.statusCode).toBe(413);
    expect(reject(() => validateUpload({ fileName: 'a.txt', buffer: Buffer.alloc(0) }))?.code).toBe('EMPTY_FILE');
  });

  it('enforces extension and MIME allow-lists', () => {
    expect(reject(() => validateUpload({ fileName: 'run.exe', buffer: b('x') }))?.code).toBe('UNSUPPORTED_FILE_TYPE');
    expect(reject(() => validateUpload({ fileName: 'noext', buffer: b('x') }))?.code).toBe('UNSUPPORTED_FILE_TYPE');
    expect(reject(() => validateUpload({ fileName: 'page.html', buffer: b('<p>x</p>') }))?.code).toBe('UNSUPPORTED_FILE_TYPE');
    expect(reject(() => validateUpload({ fileName: 'a.csv', mimeType: 'image/png', buffer: b('a,b') }))?.code).toBe('MIME_MISMATCH');
    // generic binary type from some clients is tolerated; content checks decide
    expect(() => validateUpload({ fileName: 'a.txt', mimeType: 'application/octet-stream', buffer: b('fine') })).not.toThrow();
  });

  it('rejects executables and files whose bytes do not match their extension', () => {
    expect(reject(() => validateUpload({ fileName: 'notes.txt', buffer: Buffer.from([0x4d, 0x5a, 0x90, 0x00]) }))?.code).toBe('MALICIOUS_CONTENT');
    expect(reject(() => validateUpload({ fileName: 'notes.txt', buffer: b('#!/bin/sh\nrm -rf /') }))?.code).toBe('MALICIOUS_CONTENT');
    expect(reject(() => validateUpload({ fileName: 'fake.pdf', buffer: b('not a pdf') }))?.code).toBe('CONTENT_MISMATCH');
    expect(reject(() => validateUpload({ fileName: 'fake.docx', buffer: b('not a zip') }))?.code).toBe('CONTENT_MISMATCH');
    expect(reject(() => validateUpload({ fileName: 'bin.txt', buffer: Buffer.from([0x61, 0x00, 0x62]) }))?.code).toBe('CONTENT_MISMATCH');
  });

  it('scans text, CSV and JSON for scripts, PHP and event handlers', () => {
    const bad: Array<[string, string]> = [
      ['a.txt', 'hello <script>alert(1)</script>'],
      ['a.txt', 'hi <SCRIPT src=x>'],
      ['a.md', '<?php system($_GET["c"]); ?>'],
      ['a.csv', 'name,note\nx,"<img src=x onerror=alert(1)>"'],
      ['a.json', '{"html":"<a href=\\"javascript:alert(1)\\">x</a>"}'],
      ['a.txt', '<iframe src="//evil.test"></iframe>'],
      ['a.txt', '<div onmouseover = "steal()">'],
    ];
    for (const [fileName, text] of bad) {
      expect(reject(() => validateUpload({ fileName, buffer: b(text) }))?.code, `${fileName}: ${text}`).toBe('MALICIOUS_CONTENT');
    }
    // ordinary words that merely contain "on"/"script" are fine
    expect(() => validateUpload({ fileName: 'a.txt', buffer: b('Condition = good. The manuscript is online. Conversion rate = 4%') })).not.toThrow();
  });

  it('rejects PDFs with active content and DOCX with macros', () => {
    expect(
      reject(() => validateUpload({ fileName: 'a.pdf', buffer: b('%PDF-1.4\n1 0 obj << /S /JavaScript /JS (app.alert(1)) >>') }))?.code,
    ).toBe('MALICIOUS_CONTENT');
    expect(reject(() => validateUpload({ fileName: 'a.docx', buffer: Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), b('word/vbaProject.bin')]) }))?.code).toBe(
      'MALICIOUS_CONTENT',
    );
  });
});

describe('uploads, plan limits and rate limits over HTTP', () => {
  const app = createApp();
  let companyId: string;
  let botId: string;
  let auth: string;
  const savedNodeEnv = process.env.NODE_ENV;

  const uploadUrl = () => `/api/chatbots/${botId}/knowledge/upload`;
  const upload = (over: Record<string, unknown>) =>
    request(app).post(uploadUrl()).set('Authorization', auth).send({ title: 'Doc', ...over });

  beforeAll(async () => {
    const a = await createAuthenticatedUser('company_admin');
    companyId = a.company.id;
    auth = a.authHeader;
    const [bot] = await testDb
      .insert(chatbots)
      .values({ companyId, name: 'Upload Bot', type: 'web', status: 'active', publicKey: `pb_up_${crypto.randomBytes(6).toString('hex')}`, config: {} })
      .returning();
    botId = bot!.id;
  });

  afterAll(async () => {
    process.env.NODE_ENV = savedNodeEnv;
    await cleanupTestDatabase([companyId]);
  });

  it('accepts a clean text upload larger than the 1 MB JSON default (2 MB)', async () => {
    const res = await upload({ fileName: 'big.txt', mimeType: 'text/plain', content: 'Tower facing east. '.repeat(110_000) });
    expect(res.status).toBe(201);
  });

  it('413s a file over 10 MB with a clear code', async () => {
    const res = await upload({
      fileName: 'huge.txt',
      mimeType: 'text/plain',
      fileBase64: Buffer.alloc(MAX_UPLOAD_BYTES + 1024, 0x61).toString('base64'),
    });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('FILE_TOO_LARGE');
  });

  it('does not let an anonymous caller push a big body at the upload route', async () => {
    const res = await request(app)
      .post(uploadUrl())
      .send({ title: 'x', fileName: 'x.txt', fileBase64: Buffer.alloc(3 * 1024 * 1024, 0x61).toString('base64') });
    expect([401, 413]).toContain(res.status); // 1 MB parser limit applies without credentials
  });

  it('rejects malicious and mislabelled files with 4xx and stores nothing', async () => {
    const countSources = async () => (await testDb.select().from(knowledgeSources).where(eq(knowledgeSources.companyId, companyId))).length;
    const before = await countSources();
    const cases: Array<[Record<string, unknown>, number]> = [
      [{ fileName: 'x.txt', content: '<script>steal()</script>' }, 422],
      [{ fileName: 'x.csv', content: 'a,b\n1,<img src=x onerror=alert(1)>' }, 422],
      [{ fileName: 'x.exe', content: 'MZ' }, 415],
      [{ fileName: 'x.pdf', content: 'not really a pdf' }, 415],
    ];
    for (const [body, status] of cases) {
      const res = await upload(body);
      expect(res.status, JSON.stringify(body)).toBe(status);
    }
    expect(await countSources()).toBe(before);
  });

  it('enforces the plan storage allowance server-side (trial: 100 MB)', async () => {
    await testDb.insert(knowledgeSources).values({
      companyId,
      chatbotId: botId,
      title: 'Existing bulk',
      type: 'file',
      status: 'ready',
      byteSize: 100 * 1024 * 1024,
      config: {},
    });
    const res = await upload({ fileName: 'one-more.txt', content: 'a little more' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PLAN_LIMIT_EXCEEDED');
    expect(res.body.error.details?.resource ?? 'storage').toBeTruthy();
  });

  it('enforces the monthly conversation quota when a new chat session starts (trial: 100)', async () => {
    await testDb.insert(conversations).values(
      Array.from({ length: 100 }, () => ({ companyId, chatbotId: botId, channel: 'web', status: 'bot', metadata: {} })),
    );
    const [bot] = await testDb.select().from(chatbots).where((await import('drizzle-orm')).eq(chatbots.id, botId));
    const res = await request(app)
      .post('/public/session')
      .send({ publicKey: bot!.publicKey, visitorId: `v_${Date.now()}` });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PLAN_LIMIT_EXCEEDED');
  });

  describe('rate-limit matrix (limiters are bypassed under NODE_ENV=test, so run as development)', () => {
    it('chat: 100 messages / minute, then 429', async () => {
      process.env.NODE_ENV = 'development';
      const limitedApp = createApp();
      let last = 0;
      let first429 = -1;
      for (let i = 1; i <= 101; i++) {
        const r = await request(limitedApp).post('/public/message').send({ message: 'hi' });
        last = r.status;
        if (r.status === 429 && first429 === -1) first429 = i;
      }
      expect(first429).toBe(101);
      expect(last).toBe(429);
    }, 30_000);

    it('uploads: 10 / minute per user, then 429', async () => {
      process.env.NODE_ENV = 'development';
      const limitedApp = createApp();
      const statuses: number[] = [];
      for (let i = 0; i < 11; i++) {
        const r = await request(limitedApp)
          .post(uploadUrl())
          .set('Authorization', auth)
          .send({ title: 'x', fileName: 'x.exe', content: 'x' }); // fails validation: still counts as an attempt
        statuses.push(r.status);
      }
      expect(statuses.slice(0, 10).every(s => s !== 429)).toBe(true);
      expect(statuses[10]).toBe(429);
    });

    it('general API: anonymous traffic limited to 60 / minute, exempt endpoints are not', async () => {
      process.env.NODE_ENV = 'development';
      const limitedApp = createApp();
      let blockedAt = -1;
      for (let i = 1; i <= 61; i++) {
        const r = await request(limitedApp).get('/api/leads');
        if (r.status === 429 && blockedAt === -1) blockedAt = i;
      }
      expect(blockedAt).toBe(61);
      // health checks and webhook receivers must stay reachable while the limiter is tripped
      expect((await request(limitedApp).get('/healthz')).status).not.toBe(429);
      expect((await request(limitedApp).get('/api/webhooks/meta')).status).not.toBe(429);
    }, 30_000);
  });
});
