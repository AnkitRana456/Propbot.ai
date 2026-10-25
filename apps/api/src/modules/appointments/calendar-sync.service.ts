import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import { pino } from 'pino';
import { db } from '../../db/index.js';
import { calendarIntegrations } from '../../db/schema/index.js';
import type { CalendarIntegrationStatus } from '@propbot/shared';
import { openSecret, sealSecret } from '../../utils/crypto-vault.js';
import { ApiError, badRequest } from '../../utils/api-error.js';
import { requireSimulation } from '../../utils/simulation.js';

const logger = pino({ name: 'calendar-sync', level: process.env.LOG_LEVEL ?? 'info' });

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const API = 'https://www.googleapis.com/calendar/v3';
const SCOPE = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly';
const STATE_TTL_MS = 15 * 60 * 1000;

export interface CalendarEventPayload {
  summary: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
  attendeeEmail?: string;
  /** Ask Google for a Meet link (video calls only). */
  withMeet?: boolean;
}

export interface SyncResult {
  success: boolean;
  calendarEventId?: string;
  meetingLink?: string;
  calendarStatus: 'synced' | 'dashboard_only' | 'failed_sync';
}

type Integration = typeof calendarIntegrations.$inferSelect;

export const googleCalendarConfigured = (): boolean => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const redirectUri = () => `${(process.env.API_URL || 'http://localhost:3000').replace(/\/+$/, '')}/api/appointments/calendar/callback`;
const stateKey = () => process.env.CALENDAR_STATE_SECRET || process.env.JWT_ACCESS_SECRET || 'local-development-only';

/** The OAuth state is signed, so nobody can attach their Google account to another company's workspace. */
export function signCalendarState(payload: { companyId: string; userId?: string }, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: now + STATE_TTL_MS, n: crypto.randomBytes(6).toString('hex') })).toString('base64url');
  const mac = crypto.createHmac('sha256', stateKey()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

export function verifyCalendarState(state: string, now = Date.now()): { companyId: string; userId?: string } | null {
  const [body, mac] = state.split('.');
  if (!body || !mac) return null;
  const expected = crypto.createHmac('sha256', stateKey()).update(body).digest('base64url');
  if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { companyId?: string; userId?: string; exp?: number };
    if (!p.companyId || !p.exp || p.exp < now) return null;
    return { companyId: p.companyId, userId: p.userId };
  } catch {
    return null;
  }
}

async function google<T>(url: string, init: RequestInit): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(12_000) });
    const text = await res.text();
    const data = text ? (JSON.parse(text) as T & { error?: { message?: string } | string; error_description?: string }) : ({} as T);
    if (!res.ok) {
      const err = data as { error?: { message?: string } | string; error_description?: string };
      const message = typeof err.error === 'string' ? err.error_description || err.error : err.error?.message || `HTTP ${res.status}`;
      return { ok: false, status: res.status, message };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, status: 0, message: e instanceof Error ? e.message : 'network error' };
  }
}

export class CalendarSyncService {
  private async find(companyId: string, userId?: string): Promise<Integration | undefined> {
    const conditions = [eq(calendarIntegrations.companyId, companyId)];
    if (userId) conditions.push(eq(calendarIntegrations.userId, userId));
    const [row] = await db.select().from(calendarIntegrations).where(and(...conditions)).limit(1);
    if (row || !userId) return row;
    // Fall back to the company's shared calendar when the user has none of their own
    const [shared] = await db.select().from(calendarIntegrations).where(eq(calendarIntegrations.companyId, companyId)).limit(1);
    return shared;
  }

  async getIntegrationStatus(companyId: string, userId?: string): Promise<CalendarIntegrationStatus> {
    const row = await this.find(companyId, userId);
    if (!row) return { isConnected: false, provider: 'google', configured: googleCalendarConfigured() };
    return {
      isConnected: row.isConnected,
      provider: row.provider,
      email: row.accountEmail ?? undefined,
      calendarId: row.calendarId || undefined,
      lastSyncedAt: row.updatedAt ? row.updatedAt.toISOString() : undefined,
      simulated: row.simulated,
      configured: googleCalendarConfigured(),
    };
  }

  /** Google's consent screen, or (development only, without Google keys) a simulated connection. */
  getOAuthUrl(companyId: string, userId?: string): string {
    const state = signCalendarState({ companyId, userId });
    if (!googleCalendarConfigured()) {
      requireSimulation('Google Calendar', 'Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
      return `${redirectUri()}?code=simulated&state=${encodeURIComponent(state)}`;
    }
    const q = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: redirectUri(),
      response_type: 'code',
      scope: SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    });
    return `${AUTH_URL}?${q.toString()}`;
  }

  /** Finishes the OAuth flow: checks the signed state, swaps the code for tokens and stores them encrypted. */
  async handleOAuthCallback(state: string, code: string): Promise<{ companyId: string }> {
    const who = verifyCalendarState(state);
    if (!who) throw badRequest('CALENDAR_STATE_INVALID', 'This calendar link has expired or was changed. Start the connection again.');
    if (!code) throw badRequest('CALENDAR_CODE_MISSING', 'Google did not return an authorisation code.');

    if (code === 'simulated' && !googleCalendarConfigured()) {
      requireSimulation('Google Calendar', 'Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
      await this.save(who.companyId, who.userId, { simulated: true, accessToken: null, refreshToken: null, tokenExpiry: null, accountEmail: 'simulated calendar' });
      return { companyId: who.companyId };
    }
    if (!googleCalendarConfigured()) throw new ApiError(503, 'PROVIDER_NOT_CONFIGURED', 'Google Calendar is not set up on this server.');

    const tokens = await google<{ access_token: string; refresh_token?: string; expires_in: number }>(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: redirectUri(), grant_type: 'authorization_code' }).toString(),
    });
    if (!tokens.ok) throw new ApiError(502, 'CALENDAR_CONNECT_FAILED', `Google refused the connection: ${tokens.message}`);

    // The primary calendar's id is the account's e-mail address
    const primary = await google<{ id?: string }>(`${API}/calendars/primary`, { headers: { Authorization: `Bearer ${tokens.data.access_token}` } });
    const existing = await this.find(who.companyId, who.userId);
    await this.save(who.companyId, who.userId, {
      simulated: false,
      accessToken: sealSecret(tokens.data.access_token),
      // Google sends a refresh token only on first consent; keep the one we have otherwise
      refreshToken: tokens.data.refresh_token ? sealSecret(tokens.data.refresh_token) : existing?.refreshToken ?? null,
      tokenExpiry: new Date(Date.now() + Math.max(60, tokens.data.expires_in - 60) * 1000),
      accountEmail: primary.ok ? primary.data.id ?? null : null,
    });
    return { companyId: who.companyId };
  }

  /** Development only: connects a simulated calendar without going through Google. */
  async connectSimulated(companyId: string, userId?: string): Promise<CalendarIntegrationStatus> {
    requireSimulation('Google Calendar', 'Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
    await this.save(companyId, userId, { simulated: true, accessToken: null, refreshToken: null, tokenExpiry: null, accountEmail: 'simulated calendar' });
    return this.getIntegrationStatus(companyId, userId);
  }

  private async save(
    companyId: string,
    userId: string | undefined,
    v: { simulated: boolean; accessToken: string | null; refreshToken: string | null; tokenExpiry: Date | null; accountEmail: string | null },
  ): Promise<void> {
    const conditions = [eq(calendarIntegrations.companyId, companyId)];
    if (userId) conditions.push(eq(calendarIntegrations.userId, userId));
    const [existing] = await db.select({ id: calendarIntegrations.id }).from(calendarIntegrations).where(and(...conditions)).limit(1);
    const values = { isConnected: true, ...v, updatedAt: new Date() };
    if (existing) await db.update(calendarIntegrations).set(values).where(eq(calendarIntegrations.id, existing.id));
    else await db.insert(calendarIntegrations).values({ companyId, userId: userId || null, provider: 'google', calendarId: 'primary', ...values });
  }

  async disconnect(companyId: string, userId?: string): Promise<void> {
    const row = await this.find(companyId, userId);
    if (row?.refreshToken && !row.simulated) {
      const token = openSecret(row.refreshToken);
      if (token) await google(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    }
    const conditions = [eq(calendarIntegrations.companyId, companyId)];
    if (userId) conditions.push(eq(calendarIntegrations.userId, userId));
    await db
      .update(calendarIntegrations)
      .set({ isConnected: false, accessToken: null, refreshToken: null, tokenExpiry: null, simulated: false, updatedAt: new Date() })
      .where(and(...conditions));
  }

  /** A valid access token, refreshed when it has expired. Null when the calendar cannot be used. */
  private async accessToken(row: Integration): Promise<string | null> {
    if (!row.isConnected || row.simulated) return null;
    const current = openSecret(row.accessToken);
    if (current && row.tokenExpiry && row.tokenExpiry.getTime() > Date.now() + 30_000) return current;
    const refresh = openSecret(row.refreshToken);
    if (!refresh || !googleCalendarConfigured()) return null;
    const r = await google<{ access_token: string; expires_in: number }>(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ refresh_token: refresh, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, grant_type: 'refresh_token' }).toString(),
    });
    if (!r.ok) {
      logger.warn({ companyId: row.companyId, status: r.status, message: r.message }, 'Google token refresh failed');
      // A revoked grant cannot recover: mark the calendar disconnected so the team sees it
      if (r.status === 400 || r.status === 401) await db.update(calendarIntegrations).set({ isConnected: false, updatedAt: new Date() }).where(eq(calendarIntegrations.id, row.id));
      return null;
    }
    await db
      .update(calendarIntegrations)
      .set({ accessToken: sealSecret(r.data.access_token), tokenExpiry: new Date(Date.now() + Math.max(60, r.data.expires_in - 60) * 1000), updatedAt: new Date() })
      .where(eq(calendarIntegrations.id, row.id));
    return r.data.access_token;
  }

  private eventBody(p: CalendarEventPayload) {
    const tz = process.env.CALENDAR_TIME_ZONE || 'Asia/Kolkata';
    return {
      summary: p.summary,
      description: p.description,
      location: p.location,
      start: { dateTime: p.start.toISOString(), timeZone: tz },
      end: { dateTime: p.end.toISOString(), timeZone: tz },
      ...(p.attendeeEmail ? { attendees: [{ email: p.attendeeEmail }] } : {}),
      ...(p.withMeet ? { conferenceData: { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } } } } : {}),
      reminders: { useDefault: true },
    };
  }

  /** Creates the event on the connected Google Calendar. Never throws: a failed sync keeps the booking. */
  async createEvent(companyId: string, payload: CalendarEventPayload): Promise<SyncResult> {
    const row = await this.find(companyId);
    const token = row ? await this.accessToken(row) : null;
    if (!row || !token) return { success: true, calendarStatus: 'dashboard_only' };
    const q = new URLSearchParams({ sendUpdates: payload.attendeeEmail ? 'all' : 'none', ...(payload.withMeet ? { conferenceDataVersion: '1' } : {}) });
    const r = await google<{ id: string; hangoutLink?: string }>(`${API}/calendars/${encodeURIComponent(row.calendarId || 'primary')}/events?${q.toString()}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(this.eventBody(payload)),
    });
    if (!r.ok) {
      logger.warn({ companyId, status: r.status, message: r.message }, 'Google Calendar event could not be created');
      return { success: false, calendarStatus: 'failed_sync' };
    }
    return { success: true, calendarEventId: r.data.id, meetingLink: r.data.hangoutLink, calendarStatus: 'synced' };
  }

  async updateEvent(companyId: string, calendarEventId: string | null | undefined, payload: CalendarEventPayload): Promise<SyncResult> {
    const row = await this.find(companyId);
    const token = row && calendarEventId ? await this.accessToken(row) : null;
    if (!row || !token || !calendarEventId) return { success: true, calendarStatus: 'dashboard_only' };
    const r = await google<{ id: string }>(`${API}/calendars/${encodeURIComponent(row.calendarId || 'primary')}/events/${encodeURIComponent(calendarEventId)}?sendUpdates=all`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: payload.summary, location: payload.location, start: this.eventBody(payload).start, end: this.eventBody(payload).end }),
    });
    if (!r.ok) {
      logger.warn({ companyId, status: r.status, message: r.message }, 'Google Calendar event could not be updated');
      return { success: false, calendarEventId, calendarStatus: 'failed_sync' };
    }
    return { success: true, calendarEventId, calendarStatus: 'synced' };
  }

  async deleteEvent(companyId: string, calendarEventId: string | null | undefined): Promise<void> {
    if (!calendarEventId) return;
    const row = await this.find(companyId);
    const token = row ? await this.accessToken(row) : null;
    if (!row || !token) return;
    const r = await google(`${API}/calendars/${encodeURIComponent(row.calendarId || 'primary')}/events/${encodeURIComponent(calendarEventId)}?sendUpdates=all`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    // 404 / 410: already gone in Google, which is what we wanted
    if (!r.ok && r.status !== 404 && r.status !== 410) logger.warn({ companyId, status: r.status, message: r.message }, 'Google Calendar event could not be deleted');
  }
}

export const calendarSyncService = new CalendarSyncService();
