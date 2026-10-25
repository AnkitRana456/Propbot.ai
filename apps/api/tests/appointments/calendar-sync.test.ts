import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../../src/server.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { companies, users, calendarIntegrations } from '../../src/db/schema/index.js';
import { calendarSyncService, signCalendarState, verifyCalendarState } from '../../src/modules/appointments/calendar-sync.service.js';

describe('Google Calendar integration', () => {
  const app = createApp();
  const companyId = '88888888-8888-8888-8888-888888888883';
  const userId = '00000000-0000-0000-0000-000000000083';
  const saved = { ...process.env };
  const adminToken = signAccessToken({ sub: userId, companyId, role: 'company_admin', status: 'active', email: 'admin@calendar-sync.com', name: 'Admin Calendar' });
  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${adminToken}`);
  const row = async () => (await testDb.select().from(calendarIntegrations).where(eq(calendarIntegrations.companyId, companyId)))[0];

  beforeAll(async () => {
    await cleanupTestDatabase([companyId]);
    await testDb.insert(companies).values({ id: companyId, name: 'Calendar Realty Ltd', slug: 'calendar-realty-p8', plan: 'growth', status: 'active' }).onConflictDoNothing();
    await testDb
      .insert(users)
      .values({ id: userId, companyId, name: 'Admin Calendar', email: 'admin@calendar-sync.com', passwordHash: 'hash', role: 'company_admin', status: 'active' })
      .onConflictDoNothing();
  });
  afterEach(() => {
    process.env = { ...saved };
    vi.restoreAllMocks();
  });
  afterAll(async () => {
    process.env = { ...saved };
    await cleanupTestDatabase([companyId]);
  });

  it('reports not connected at first', async () => {
    const res = await auth(request(app).get('/api/appointments/calendar/status'));
    expect(res.status).toBe(200);
    expect(res.body.data.isConnected).toBe(false);
  });

  it('signs the OAuth state so it cannot be pointed at another company', () => {
    const state = signCalendarState({ companyId, userId });
    expect(verifyCalendarState(state)).toEqual({ companyId, userId });
    const [body] = state.split('.');
    const forged = Buffer.from(JSON.stringify({ companyId: '11111111-1111-4111-a111-111111111111', exp: Date.now() + 60_000 })).toString('base64url');
    expect(verifyCalendarState(`${forged}.${state.split('.')[1]}`)).toBeNull();
    expect(verifyCalendarState(`${body}.tampered`)).toBeNull();
    expect(verifyCalendarState(state, Date.now() + 16 * 60_000)).toBeNull();
  });

  it('a forged callback redirects with an error and connects nothing', async () => {
    const res = await request(app).get('/api/appointments/calendar/callback').query({ code: 'x', state: 'eyJjb21wYW55SWQiOiJ4In0.bad' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('calendar_error=CALENDAR_STATE_INVALID');
    expect(await row()).toBeUndefined();
  });

  it('simulated connection in development makes no fake events or meeting links', async () => {
    const res = await auth(request(app).post('/api/appointments/calendar/mock-connect'));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ isConnected: true, simulated: true });
    const sync = await calendarSyncService.createEvent(companyId, { summary: 'Visit', start: new Date(), end: new Date(Date.now() + 3600_000), withMeet: true });
    expect(sync).toEqual({ success: true, calendarStatus: 'dashboard_only' });
  });

  it('refuses a simulated calendar in production', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.GOOGLE_CLIENT_ID;
    const res = await auth(request(app).post('/api/appointments/calendar/mock-connect'));
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('PROVIDER_NOT_CONFIGURED');
  });

  it('connects a real Google account, stores tokens encrypted and creates, refreshes and deletes events', async () => {
    process.env.GOOGLE_CLIENT_ID = 'client-123.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET = 'secret-xyz';
    const calls: Array<{ url: string; method: string; body?: string; auth?: string }> = [];
    let tokenCalls = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push({ url, method, body: init?.body ? String(init.body) : undefined, auth: (init?.headers as Record<string, string> | undefined)?.Authorization });
      if (url.startsWith('https://oauth2.googleapis.com/token')) {
        tokenCalls++;
        return new Response(JSON.stringify(tokenCalls === 1 ? { access_token: 'at-1', refresh_token: 'rt-1', expires_in: 3600 } : { access_token: 'at-2', expires_in: 3600 }), { status: 200 });
      }
      if (url.endsWith('/calendars/primary')) return new Response(JSON.stringify({ id: 'sales@skyline.example' }), { status: 200 });
      if (url.includes('/events') && method === 'POST') return new Response(JSON.stringify({ id: 'evt_1', hangoutLink: 'https://meet.google.com/abc-defg-hij' }), { status: 200 });
      if (method === 'DELETE') return new Response(null, { status: 204 });
      return new Response('{}', { status: 200 });
    });

    const urlRes = await auth(request(app).get('/api/appointments/calendar/oauth-url'));
    const consent = new URL(urlRes.body.data.url);
    expect(consent.origin).toBe('https://accounts.google.com');
    expect(consent.searchParams.get('client_id')).toBe('client-123.apps.googleusercontent.com');
    const state = consent.searchParams.get('state')!;

    const cb = await request(app).get('/api/appointments/calendar/callback').query({ code: 'auth-code-1', state });
    expect(cb.headers.location).toContain('calendar_connected=true');
    const stored = (await row())!;
    expect(stored).toMatchObject({ isConnected: true, simulated: false, accountEmail: 'sales@skyline.example' });
    expect(stored.accessToken).toMatch(/^vault:v1:/);
    expect(stored.refreshToken).toMatch(/^vault:v1:/);
    expect(calls[0]!.body).toContain('code=auth-code-1');

    const created = await calendarSyncService.createEvent(companyId, { summary: 'Site visit', start: new Date('2026-11-01T05:30:00Z'), end: new Date('2026-11-01T06:15:00Z'), attendeeEmail: 'buyer@example.com', withMeet: true });
    expect(created).toEqual({ success: true, calendarEventId: 'evt_1', meetingLink: 'https://meet.google.com/abc-defg-hij', calendarStatus: 'synced' });
    const post = calls.find(c => c.method === 'POST' && c.url.includes('/events'))!;
    expect(post.auth).toBe('Bearer at-1');
    expect(post.url).toContain('conferenceDataVersion=1');
    expect(JSON.parse(post.body!).attendees).toEqual([{ email: 'buyer@example.com' }]);

    // An expired access token is refreshed before the next call
    await testDb.update(calendarIntegrations).set({ tokenExpiry: new Date(Date.now() - 1000) }).where(eq(calendarIntegrations.companyId, companyId));
    await calendarSyncService.deleteEvent(companyId, 'evt_1');
    expect(tokenCalls).toBe(2);
    expect(calls.at(-1)).toMatchObject({ method: 'DELETE', auth: 'Bearer at-2' });

    const disc = await auth(request(app).delete('/api/appointments/calendar/disconnect'));
    expect(disc.status).toBe(200);
    expect(calls.some(c => c.url.startsWith('https://oauth2.googleapis.com/revoke'))).toBe(true);
    expect((await row())!.isConnected).toBe(false);
  });
});
