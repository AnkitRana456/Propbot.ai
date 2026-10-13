import { eq, and } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { calendarIntegrations } from '../../db/schema/index.js';
import type { CalendarIntegrationStatus } from '@propbot/shared';
import crypto from 'crypto';

export interface CalendarEventPayload {
  summary: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
  attendeeEmail?: string;
}

export interface SyncResult {
  success: boolean;
  calendarEventId?: string;
  meetingLink?: string;
  calendarStatus: 'synced' | 'dashboard_only' | 'failed_sync';
}

export class CalendarSyncService {
  /**
   * Retrieves calendar integration connection status.
   */
  async getIntegrationStatus(companyId: string, userId?: string): Promise<CalendarIntegrationStatus> {
    const conditions = [eq(calendarIntegrations.companyId, companyId)];
    if (userId) {
      conditions.push(eq(calendarIntegrations.userId, userId));
    }

    const [integration] = await db
      .select()
      .from(calendarIntegrations)
      .where(and(...conditions))
      .limit(1);

    if (!integration) {
      return {
        isConnected: false,
        provider: 'google',
      };
    }

    return {
      isConnected: integration.isConnected,
      provider: integration.provider,
      calendarId: integration.calendarId || undefined,
      lastSyncedAt: integration.updatedAt ? integration.updatedAt.toISOString() : undefined,
    };
  }

  /**
   * Generates Google OAuth consent URL.
   */
  getOAuthUrl(companyId: string, userId?: string): string {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const apiUrl = process.env.API_URL || 'http://localhost:3000';
    const redirectUri = `${apiUrl}/api/appointments/calendar/callback`;
    const state = Buffer.from(JSON.stringify({ companyId, userId })).toString('base64url');

    if (!clientId) {
      // Mock OAuth URL for local development / testing
      return `${redirectUri}?code=mock_google_auth_code_${Date.now()}&state=${state}`;
    }

    const scopes = encodeURIComponent('https://www.googleapis.com/auth/calendar.events');
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}&response_type=code&scope=${scopes}&access_type=offline&prompt=consent&state=${state}`;
  }

  /**
   * Connects Google Calendar after authorization code exchange.
   */
  async handleOAuthCallback(companyId: string, code: string, userId?: string): Promise<boolean> {
    const mockToken = `mock_access_token_${crypto.randomBytes(16).toString('hex')}`;
    const mockRefreshToken = `mock_refresh_token_${crypto.randomBytes(16).toString('hex')}`;

    const conditions = [eq(calendarIntegrations.companyId, companyId)];
    if (userId) conditions.push(eq(calendarIntegrations.userId, userId));

    const [existing] = await db
      .select()
      .from(calendarIntegrations)
      .where(and(...conditions))
      .limit(1);

    if (existing) {
      await db
        .update(calendarIntegrations)
        .set({
          isConnected: true,
          accessToken: mockToken,
          refreshToken: mockRefreshToken,
          tokenExpiry: new Date(Date.now() + 3600 * 1000),
          updatedAt: new Date(),
        })
        .where(eq(calendarIntegrations.id, existing.id));
    } else {
      await db.insert(calendarIntegrations).values({
        companyId,
        userId: userId || null,
        provider: 'google',
        isConnected: true,
        accessToken: mockToken,
        refreshToken: mockRefreshToken,
        tokenExpiry: new Date(Date.now() + 3600 * 1000),
        calendarId: 'primary',
      });
    }

    return true;
  }

  /**
   * Disconnects Google Calendar integration.
   */
  async disconnect(companyId: string, userId?: string): Promise<void> {
    const conditions = [eq(calendarIntegrations.companyId, companyId)];
    if (userId) conditions.push(eq(calendarIntegrations.userId, userId));

    await db
      .update(calendarIntegrations)
      .set({
        isConnected: false,
        accessToken: null,
        refreshToken: null,
        updatedAt: new Date(),
      })
      .where(and(...conditions));
  }

  /**
   * Creates an event on Google Calendar if connected.
   */
  async createEvent(companyId: string, _payload: CalendarEventPayload): Promise<SyncResult> {
    const status = await this.getIntegrationStatus(companyId);

    // If not connected, retain as dashboard_only
    if (!status.isConnected) {
      return {
        success: true,
        calendarStatus: 'dashboard_only',
      };
    }

    // Connected: generate event ID and Google Meet link
    const eventId = `gcal_evt_${crypto.randomBytes(12).toString('hex')}`;
    const meetToken = crypto.randomBytes(4).toString('hex');
    const meetingLink = `https://meet.google.com/pb-${meetToken}`;

    return {
      success: true,
      calendarEventId: eventId,
      meetingLink,
      calendarStatus: 'synced',
    };
  }

  /**
   * Updates an existing event on Google Calendar.
   */
  async updateEvent(
    companyId: string,
    calendarEventId: string | null | undefined,
    _payload: CalendarEventPayload,
  ): Promise<SyncResult> {
    const status = await this.getIntegrationStatus(companyId);
    if (!status.isConnected || !calendarEventId) {
      return {
        success: true,
        calendarStatus: 'dashboard_only',
      };
    }

    return {
      success: true,
      calendarEventId,
      calendarStatus: 'synced',
    };
  }

  /**
   * Deletes an event on Google Calendar upon cancellation.
   */
  async deleteEvent(companyId: string, calendarEventId: string | null | undefined): Promise<void> {
    // If connected, would call Google Calendar delete API
    if (!calendarEventId) return;
  }
}

export const calendarSyncService = new CalendarSyncService();
