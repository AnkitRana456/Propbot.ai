import type { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

interface RateLimiterOptions {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
  skipInTests?: boolean;
}

export class MemoryRateLimiter {
  private store = new Map<string, RateLimitRecord>();
  private windowMs: number;
  private max: number;
  private message: string;
  private keyGenerator: (req: Request) => string;
  private skipInTests: boolean;

  constructor(options: RateLimiterOptions) {
    this.windowMs = options.windowMs;
    this.max = options.max;
    this.message = options.message || 'Too many requests, please try again later.';
    this.keyGenerator =
      options.keyGenerator ||
      ((req: Request) => req.ip || req.socket.remoteAddress || '127.0.0.1');
    this.skipInTests = options.skipInTests ?? false;

    // Periodic cleanup of expired keys every 60 seconds
    setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.store.entries()) {
        if (record.resetAt <= now) {
          this.store.delete(key);
        }
      }
    }, 60000).unref();
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      // Allow test override header or test bypass if configured
      if (process.env.NODE_ENV === 'test' && req.headers['x-bypass-rate-limit'] === 'test-bypass') {
        next();
        return;
      }
      if (this.skipInTests && process.env.NODE_ENV === 'test') {
        next();
        return;
      }

      const key = this.keyGenerator(req);
      const now = Date.now();
      const record = this.store.get(key);

      if (!record || record.resetAt <= now) {
        this.store.set(key, { count: 1, resetAt: now + this.windowMs });
        res.setHeader('X-RateLimit-Limit', this.max);
        res.setHeader('X-RateLimit-Remaining', this.max - 1);
        next();
        return;
      }

      record.count += 1;
      const remaining = Math.max(0, this.max - record.count);
      res.setHeader('X-RateLimit-Limit', this.max);
      res.setHeader('X-RateLimit-Remaining', remaining);

      if (record.count > this.max) {
        const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
        res.setHeader('Retry-After', retryAfterSeconds);
        res.status(429).json({
          error: {
            code: 'TOO_MANY_REQUESTS',
            message: this.message,
            retryAfterSeconds,
          },
        });
        return;
      }

      next();
    };
  }

  resetKey(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

// Pre-configured rate limiters
export const authRateLimiter = new MemoryRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 5, // spec: 5 attempts per 15 min
  message: 'Too many authentication attempts. Please wait 15 minutes before trying again.',
  skipInTests: true,
});

/** SMS cost / enumeration guard for OTP send + verify (per IP). */
export const otpRateLimiter = new MemoryRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.OTP_RATE_LIMIT_MAX) || 10,
  message: 'Too many verification requests. Please try again later.',
  skipInTests: true,
});

/** Public demo form: a handful of submissions per IP per hour is plenty for a real person. */
export const demoRequestRateLimiter = new MemoryRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.DEMO_REQUEST_RATE_LIMIT_MAX) || 5,
  message: 'You have sent several requests already. Please try again in an hour.',
  skipInTests: false,
});

export const publicSessionRateLimiter = new MemoryRateLimiter({
  windowMs: 60 * 1000, // 1 min
  max: 30, // 30 new visitor sessions / min / IP
  message: 'Too many visitor sessions created from this IP. Please wait a minute.',
  skipInTests: false,
});

export const publicChatRateLimiter = new MemoryRateLimiter({
  windowMs: 60 * 1000, // 1 min
  max: Number(process.env.CHAT_RATE_LIMIT_MAX) || 100, // spec: 100 messages / min
  keyGenerator: req => {
    const sessionId = (req.body && req.body.sessionId) || req.query.sessionId;
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
    return sessionId ? `chat:${sessionId}` : `ip:${ip}`;
  },
  message: 'You are sending messages too quickly. Please pause for a few seconds.',
  skipInTests: false,
});

/** Agent test panel / version comparison: every call spends Gemini tokens. */
export const aiTestRateLimiter = new MemoryRateLimiter({
  windowMs: 60 * 1000,
  max: Number(process.env.AI_TEST_RATE_LIMIT_MAX) || 20,
  keyGenerator: req => `aitest:${(req as Request & { user?: { id?: string } }).user?.id || req.ip || 'anon'}`,
  message: 'Too many test runs. Please wait a minute.',
  skipInTests: true,
});

/** Spec: uploads - 1 min window, 10 uploads. Keyed per signed-in user (falls back to IP). */
export const uploadRateLimiter = new MemoryRateLimiter({
  windowMs: 60 * 1000,
  max: Number(process.env.UPLOAD_RATE_LIMIT_MAX) || 10,
  keyGenerator: req => `upload:${(req as Request & { user?: { id?: string } }).user?.id || req.ip || 'anon'}`,
  message: 'Too many uploads. Please wait a minute before uploading again.',
  skipInTests: true,
});

/**
 * Spec: general API - 1 min window, 60 requests. Applied to anonymous traffic (no Authorization header),
 * keyed by client IP.
 */
export const generalApiRateLimiter = new MemoryRateLimiter({
  windowMs: 60 * 1000,
  max: Number(process.env.GENERAL_RATE_LIMIT_MAX) || 60,
  keyGenerator: req => `general:${req.ip || 'anon'}`,
  skipInTests: true,
});

/**
 * Signed-in dashboard traffic. The spec's 60/min would be exhausted by the SPA alone (the WhatsApp inbox
 * polls every 3-5 s), so authenticated requests get their own, higher bucket per client IP.
 * Tune with API_AUTH_RATE_LIMIT_MAX.
 */
export const tenantApiRateLimiter = new MemoryRateLimiter({
  windowMs: 60 * 1000,
  max: Number(process.env.API_AUTH_RATE_LIMIT_MAX) || 600,
  keyGenerator: req => `authed:${req.ip || 'anon'}`,
  skipInTests: true,
});
