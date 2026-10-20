import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { db } from '../../db/index.js';
import { webhookLogs } from '../../db/schema/index.js';
import type { OutboundWebhookEnvelope, WebhookEventType } from '@propbot/shared';
import { WebhookSigner } from './webhook-signer.js';
import { SsrfGuard } from './ssrf-guard.js';

export const webhookLogger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  name: 'webhook-dispatcher',
});

/** Spec section 5: zapier/make cold starts can be slow, so each attempt may take up to 30s. */
export const WEBHOOK_TIMEOUT_MS = Number(process.env.WEBHOOK_TIMEOUT_MS) || 30_000;
/** 1 initial attempt + 3 retries, waiting 1s, 2s, 4s between attempts. */
export const WEBHOOK_MAX_ATTEMPTS = 4;
export const WEBHOOK_RETRY_DELAYS_SECONDS = [1, 2, 4] as const;

export interface DispatchOptions {
  companyId: string;
  endpointId: string;
  endpointUrl: string;
  endpointSecret: string;
  endpointHeaders?: Record<string, string>;
  eventType: WebhookEventType;
  eventId?: string;
  leadId?: string | null;
  leadName?: string | null;
  chatbotId?: string | null;
  data: Record<string, unknown>;
  attempt?: number;
  maxAttempts?: number;
  existingLogId?: string;
  allowLocalForTesting?: boolean;
}

export interface DispatchResult {
  success: boolean;
  logId: string;
  statusCode: number | null;
  durationMs: number;
  status: 'success' | 'retrying' | 'failed' | 'dead_letter';
  errorMessage?: string;
}

export class WebhookDispatcherService {
  /**
   * Sanitizes header dictionary for safe storage in audit logs without exposing secrets.
   */
  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      const lower = key.toLowerCase();
      if (
        lower.includes('authorization') ||
        lower.includes('token') ||
        lower.includes('secret') ||
        lower.includes('key')
      ) {
        sanitized[key] = '••••••••';
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  /**
   * Exponential backoff: after attempt 1 wait 1s, after attempt 2 wait 2s, after attempt 3 wait 4s.
   */
  private calculateNextRetry(attempt: number): Date {
    const idx = Math.min(Math.max(attempt, 1), WEBHOOK_RETRY_DELAYS_SECONDS.length) - 1;
    return new Date(Date.now() + WEBHOOK_RETRY_DELAYS_SECONDS[idx]! * 1000);
  }

  /**
   * Executes HTTP POST delivery to a target endpoint and logs attempt.
   */
  async dispatch(options: DispatchOptions): Promise<DispatchResult> {
    const {
      companyId,
      endpointId,
      endpointUrl,
      endpointSecret,
      endpointHeaders = {},
      eventType,
      eventId = `evt_${Date.now()}`,
      leadId = null,
      leadName = null,
      chatbotId = null,
      data,
      attempt = 1,
      maxAttempts = WEBHOOK_MAX_ATTEMPTS,
      existingLogId,
      allowLocalForTesting = process.env.NODE_ENV === 'test',
    } = options;

    const startTime = Date.now();
    let statusCode: number | null = null;
    let responseBodyText: string | null = null;
    const responseHeadersObj: Record<string, string> = {};
    let errorMsg: string | null = null;

    // 1. SSRF Guard Check
    try {
      SsrfGuard.assertSafeUrl(endpointUrl, allowLocalForTesting);
    } catch (ssrfErr) {
      const durationMs = Date.now() - startTime;
      const errMsg = ssrfErr instanceof Error ? ssrfErr.message : 'SSRF check failed';
      webhookLogger.warn({ endpointUrl, errMsg }, 'Webhook delivery blocked by SSRF guard');

      const [logRow] = await db
        .insert(webhookLogs)
        .values({
          companyId,
          endpointId,
          leadId,
          leadName,
          chatbotId,
          eventId,
          eventType,
          status: 'dead_letter',
          statusCode: 400,
          attempt,
          maxAttempts,
          requestPayload: data,
          requestHeaders: endpointHeaders,
          responseBody: errMsg,
          responseHeaders: {},
          durationMs,
          errorMessage: errMsg,
        })
        .returning();

      return {
        success: false,
        logId: logRow?.id || '',
        statusCode: 400,
        durationMs,
        status: 'dead_letter',
        errorMessage: errMsg,
      };
    }

    // 2. Prepare payload envelope & HMAC Signature
    const envelope: OutboundWebhookEnvelope = {
      id: eventId,
      event: eventType,
      company_id: companyId,
      chatbot_id: chatbotId,
      timestamp: new Date().toISOString(),
      attempt,
      data,
    };

    const payloadString = JSON.stringify(envelope);
    const { headerValue, timestamp: signTs } = WebhookSigner.sign(payloadString, endpointSecret);

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'PropBot-Webhook-Dispatcher/1.0',
      'X-PropBot-Signature-256': headerValue,
      'X-PropBot-Timestamp': String(signTs),
      'X-PropBot-Event-Id': eventId,
      'X-PropBot-Attempt': `${attempt}/${maxAttempts}`,
      ...endpointHeaders,
    };

    // 3. Execute HTTP Dispatch (30s timeout)
    try {
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: requestHeaders,
        body: payloadString,
        signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      });

      statusCode = response.status;
      try {
        responseBodyText = await response.text();
        // Limit response body log to 10kb
        if (responseBodyText.length > 10240) {
          responseBodyText = `${responseBodyText.slice(0, 10240)}... [truncated]`;
        }
      } catch {
        responseBodyText = null;
      }

      response.headers.forEach((v, k) => {
        responseHeadersObj[k] = v;
      });
    } catch (fetchErr) {
      errorMsg = fetchErr instanceof Error ? fetchErr.message : 'Network / Timeout Error';
      webhookLogger.warn({ endpointUrl, errorMsg }, 'Outbound webhook fetch failed');
    }

    const durationMs = Date.now() - startTime;
    const isSuccess = statusCode !== null && statusCode >= 200 && statusCode < 300;

    let status: 'success' | 'retrying' | 'failed' | 'dead_letter';
    let nextRetryAt: Date | null = null;

    if (isSuccess) {
      status = 'success';
    } else if (attempt < maxAttempts) {
      status = 'retrying';
      nextRetryAt = this.calculateNextRetry(attempt);
    } else {
      status = 'dead_letter';
    }

    const sanitizedRequestHeaders = this.sanitizeHeaders(requestHeaders);

    // 4. Update or Insert Webhook Delivery Log
    let logId = existingLogId || '';

    if (existingLogId) {
      await db
        .update(webhookLogs)
        .set({
          status,
          statusCode,
          attempt,
          requestPayload: envelope as unknown as Record<string, unknown>,
          requestHeaders: sanitizedRequestHeaders,
          responseBody: responseBodyText,
          responseHeaders: responseHeadersObj,
          durationMs,
          errorMessage: errorMsg,
          nextRetryAt,
          updatedAt: new Date(),
        })
        .where(eq(webhookLogs.id, existingLogId));
    } else {
      const [inserted] = await db
        .insert(webhookLogs)
        .values({
          companyId,
          endpointId,
          leadId,
          leadName,
          chatbotId,
          eventId,
          eventType,
          status,
          statusCode,
          attempt,
          maxAttempts,
          requestPayload: envelope as unknown as Record<string, unknown>,
          requestHeaders: sanitizedRequestHeaders,
          responseBody: responseBodyText,
          responseHeaders: responseHeadersObj,
          durationMs,
          errorMessage: errorMsg,
          nextRetryAt,
        })
        .returning();
      logId = inserted?.id || '';
    }

    return {
      success: isSuccess,
      logId,
      statusCode,
      durationMs,
      status,
      errorMessage: errorMsg || undefined,
    };
  }
}

export const webhookDispatcherService = new WebhookDispatcherService();
