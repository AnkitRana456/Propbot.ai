import crypto from 'crypto';
import { and, desc, eq, lt, isNull, sql } from 'drizzle-orm';
import { validatePhone } from '@propbot/shared';
import { pino } from 'pino';
import { db } from '../../db/index.js';
import { leadOtps, leads } from '../../db/schema/index.js';

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });

export interface OtpSettings {
  enabled: boolean;
  expiryMinutes: number;
  maxAttempts: number;
  resendCooldownSeconds: number;
}

export const DEFAULT_OTP_SETTINGS: OtpSettings = {
  enabled: false,
  expiryMinutes: 10,
  maxAttempts: 5,
  resendCooldownSeconds: 30,
};

/** A verified OTP authorises one lead submission for this long. */
const VERIFIED_GRACE_MS = 30 * 60 * 1000;

export function resolveOtpSettings(raw: unknown): OtpSettings {
  const o = (raw ?? {}) as Partial<OtpSettings>;
  const clamp = (v: unknown, min: number, max: number, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.floor(n))) : fallback;
  };
  return {
    enabled: o.enabled === true,
    expiryMinutes: clamp(o.expiryMinutes, 1, 30, DEFAULT_OTP_SETTINGS.expiryMinutes),
    maxAttempts: clamp(o.maxAttempts, 1, 10, DEFAULT_OTP_SETTINGS.maxAttempts),
    resendCooldownSeconds: clamp(o.resendCooldownSeconds, 0, 300, DEFAULT_OTP_SETTINGS.resendCooldownSeconds),
  };
}

export class OtpError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode: number,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'OtpError';
  }
}

export type SmsSender = (to: string, body: string) => Promise<{ channel: 'twilio' | 'console' }>;

/** Real Twilio call when credentials exist; console fallback in non-production otherwise. */
export const defaultSmsSender: SmsSender = async (to, body) => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  const messagingSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

  if (!sid || !token || (!from && !messagingSid)) {
    if (process.env.NODE_ENV === 'production') {
      throw new OtpError('SMS_NOT_CONFIGURED', 'SMS verification is not available right now.', 503);
    }
    // Dev-mode fallback: the message (with its code) goes to the server console only.
    console.info(`[DEV SMS] to=${to} body="${body}"`);
    return { channel: 'console' };
  }

  const form = new URLSearchParams({ To: to, Body: body });
  if (messagingSid) form.set('MessagingServiceSid', messagingSid);
  else form.set('From', from as string);

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    log.error({ status: res.status }, 'Twilio SMS send failed');
    throw new OtpError('SMS_SEND_FAILED', 'Could not send the verification code. Please try again.', 502);
  }
  return { channel: 'twilio' };
};

export class OtpService {
  private sender: SmsSender = defaultSmsSender;

  /** Test seam: replace the SMS transport (Twilio is mocked in tests). */
  setSender(sender: SmsSender): void {
    this.sender = sender;
  }

  private hashCode(phone: string, code: string): string {
    const secret = process.env.OTP_HASH_SECRET || process.env.JWT_ACCESS_SECRET || 'dev-otp-secret';
    return crypto.createHmac('sha256', secret).update(`${phone}:${code}`).digest('hex');
  }

  private normalize(rawPhone: string): string {
    const v = validatePhone(rawPhone);
    if (!v.valid || !v.e164) {
      throw new OtpError('INVALID_PHONE', 'Please enter a valid phone number.', 400);
    }
    return v.e164;
  }

  private scope(companyId: string, chatbotId: string | null, phone: string) {
    return and(
      eq(leadOtps.companyId, companyId),
      chatbotId ? eq(leadOtps.chatbotId, chatbotId) : isNull(leadOtps.chatbotId),
      eq(leadOtps.phone, phone),
    );
  }

  async sendOtp(params: {
    companyId: string;
    chatbotId: string | null;
    phone: string;
    settings: OtpSettings;
  }): Promise<{ sent: true; expiresInSeconds: number; channel: 'twilio' | 'console' }> {
    const phone = this.normalize(params.phone);
    const { settings } = params;

    const [latest] = await db
      .select()
      .from(leadOtps)
      .where(this.scope(params.companyId, params.chatbotId, phone))
      .orderBy(desc(leadOtps.createdAt))
      .limit(1);

    if (latest) {
      const since = (Date.now() - latest.lastSentAt.getTime()) / 1000;
      if (since < settings.resendCooldownSeconds) {
        const wait = Math.ceil(settings.resendCooldownSeconds - since);
        throw new OtpError('OTP_COOLDOWN', `Please wait ${wait}s before requesting another code.`, 429, wait);
      }
    }

    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    const expiresAt = new Date(Date.now() + settings.expiryMinutes * 60_000);

    // One live challenge per phone: replace any previous one atomically.
    await db.transaction(async tx => {
      await tx.delete(leadOtps).where(this.scope(params.companyId, params.chatbotId, phone));
      await tx.insert(leadOtps).values({
        companyId: params.companyId,
        chatbotId: params.chatbotId,
        phone,
        codeHash: this.hashCode(phone, code),
        maxAttempts: settings.maxAttempts,
        expiresAt,
      });
    });

    const { channel } = await this.sender(
      phone,
      `Your verification code is ${code}. It expires in ${settings.expiryMinutes} minutes.`,
    );
    return { sent: true, expiresInSeconds: settings.expiryMinutes * 60, channel };
  }

  async verifyOtp(params: {
    companyId: string;
    chatbotId: string | null;
    phone: string;
    code: string;
  }): Promise<{ verified: true }> {
    const phone = this.normalize(params.phone);
    const scope = this.scope(params.companyId, params.chatbotId, phone);

    const [row] = await db.select().from(leadOtps).where(scope).orderBy(desc(leadOtps.createdAt)).limit(1);
    if (!row) {
      throw new OtpError('OTP_NOT_FOUND', 'No verification code was requested for this number.', 400);
    }
    if (row.verifiedAt) return { verified: true };

    if (row.expiresAt.getTime() <= Date.now()) {
      await db.delete(leadOtps).where(eq(leadOtps.id, row.id));
      throw new OtpError('OTP_EXPIRED', 'This code has expired. Please request a new one.', 400);
    }

    // Count the attempt atomically before comparing, so parallel guesses cannot exceed maxAttempts.
    const [bumped] = await db
      .update(leadOtps)
      .set({ attempts: sql`${leadOtps.attempts} + 1` })
      .where(and(eq(leadOtps.id, row.id), lt(leadOtps.attempts, row.maxAttempts)))
      .returning({ attempts: leadOtps.attempts });

    if (!bumped) {
      await db.delete(leadOtps).where(eq(leadOtps.id, row.id));
      throw new OtpError('OTP_LOCKED', 'Too many incorrect attempts. Please request a new code.', 429);
    }

    const expected = Buffer.from(row.codeHash, 'hex');
    const actual = Buffer.from(this.hashCode(phone, params.code.trim()), 'hex');
    const ok = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);

    if (!ok) {
      if (bumped.attempts >= row.maxAttempts) {
        // maxAttempts reached: purge the record so the code can never be brute-forced further.
        await db.delete(leadOtps).where(eq(leadOtps.id, row.id));
        throw new OtpError('OTP_LOCKED', 'Too many incorrect attempts. Please request a new code.', 429);
      }
      throw new OtpError(
        'OTP_INVALID',
        `Incorrect code. ${row.maxAttempts - bumped.attempts} attempt(s) left.`,
        400,
      );
    }

    await db.update(leadOtps).set({ verifiedAt: new Date() }).where(eq(leadOtps.id, row.id));
    return { verified: true };
  }

  /** True if this phone passed OTP recently (used to gate lead submission when OTP is enabled). */
  async hasRecentVerification(companyId: string, chatbotId: string | null, rawPhone: string): Promise<boolean> {
    const phone = this.normalize(rawPhone);
    const [row] = await db
      .select({ verifiedAt: leadOtps.verifiedAt })
      .from(leadOtps)
      .where(this.scope(companyId, chatbotId, phone))
      .orderBy(desc(leadOtps.createdAt))
      .limit(1);
    return Boolean(row?.verifiedAt && Date.now() - row.verifiedAt.getTime() < VERIFIED_GRACE_MS);
  }

  /** Marks the lead's phone verified. Only called after verifyOtp succeeded. */
  async markLeadPhoneVerified(companyId: string, leadId: string): Promise<void> {
    await db
      .update(leads)
      .set({ phoneVerified: true, updatedAt: new Date() })
      .where(and(eq(leads.id, leadId), eq(leads.companyId, companyId)));
  }

  /** Postgres has no TTL index, so a scheduled job purges expired challenges. */
  async purgeExpired(): Promise<number> {
    const deleted = await db
      .delete(leadOtps)
      .where(lt(leadOtps.expiresAt, new Date()))
      .returning({ id: leadOtps.id });
    return deleted.length;
  }
}

export const otpService = new OtpService();
