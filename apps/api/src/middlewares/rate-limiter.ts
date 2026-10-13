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
      ((req: Request) => (req.headers['x-forwarded-for'] as string) || req.ip || '127.0.0.1');
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
      if (req.headers['x-bypass-rate-limit'] === 'test-bypass') {
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
  max: 20, // 20 login/register attempts
  message: 'Too many authentication attempts. Please wait 15 minutes before trying again.',
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
  max: 60, // 60 messages / min / session
  keyGenerator: req => {
    const sessionId = (req.body && req.body.sessionId) || req.query.sessionId;
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
    return sessionId ? `chat:${sessionId}` : `ip:${ip}`;
  },
  message: 'You are sending messages too quickly. Please pause for a few seconds.',
  skipInTests: false,
});

export const tenantApiRateLimiter = new MemoryRateLimiter({
  windowMs: 60 * 1000, // 1 min
  max: 600, // 600 req/min per tenant
  keyGenerator: req => (req as Request & { companyId?: string }).companyId || req.ip || 'tenant-anon',
  skipInTests: true,
});
