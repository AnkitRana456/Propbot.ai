import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { apiKeys } from '../../db/schema/index.js';
import { pino } from 'pino';

export const mcpLogger = pino({
  name: 'mcp-server',
  level: process.env.LOG_LEVEL ?? 'info',
});

// In-memory token bucket rate limiter for MCP (60 requests / minute per API key)
interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}
const rateLimits = new Map<string, RateLimitBucket>();
const RATE_LIMIT_CAPACITY = 60;
const RATE_LIMIT_REFILL_MS = 60000;

function checkRateLimit(keyId: string): boolean {
  const now = Date.now();
  let bucket = rateLimits.get(keyId);

  if (!bucket) {
    bucket = { tokens: RATE_LIMIT_CAPACITY - 1, lastRefill: now };
    rateLimits.set(keyId, bucket);
    return true;
  }

  const elapsed = now - bucket.lastRefill;
  if (elapsed > RATE_LIMIT_REFILL_MS) {
    bucket.tokens = RATE_LIMIT_CAPACITY;
    bucket.lastRefill = now;
  }

  if (bucket.tokens > 0) {
    bucket.tokens -= 1;
    return true;
  }

  return false;
}

export interface AuthenticatedMcpRequest extends Request {
  apiKey?: {
    id: string;
    companyId: string;
    name: string;
    permissions: string[];
    isGracePeriod?: boolean;
  };
}

/**
 * Middleware that authenticates MCP requests using bearer tokens against api_keys table.
 * Strictly derives companyId from the verified key.
 */
export async function mcpAuthMiddleware(
  req: AuthenticatedMcpRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or malformed Authorization bearer token for MCP server.',
      },
    });
    return;
  }

  const token = authHeader.substring(7).trim();
  const keyHash = crypto.createHash('sha256').update(token).digest('hex');

  try {
    const [key] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1);

    if (!key) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid API key.',
        },
      });
      return;
    }

    if (key.expiresAt && key.expiresAt.getTime() < Date.now()) {
      res.status(401).json({ error: { code: 'KEY_EXPIRED', message: 'This API key has expired. Create a new one.' } });
      return;
    }

    let isGracePeriod = false;
    if (key.revokedAt) {
      // 24-hour grace window for rotated keys
      const gracePeriodMs = 24 * 60 * 60 * 1000;
      const revokedTime = new Date(key.revokedAt).getTime();
      const now = Date.now();

      if (now - revokedTime < gracePeriodMs) {
        isGracePeriod = true;
        res.setHeader('X-API-Key-Deprecated', 'true');
        res.setHeader('X-API-Key-Grace-Expires', new Date(revokedTime + gracePeriodMs).toISOString());
      } else {
        res.status(401).json({
          error: {
            code: 'KEY_REVOKED',
            message: 'This API key has been revoked and the 24-hour grace window has expired.',
          },
        });
        return;
      }
    }

    // Rate Limiting check
    if (!checkRateLimit(key.id)) {
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'MCP rate limit exceeded (60 requests/minute limit).',
        },
      });
      return;
    }

    // Update lastUsedAt asynchronously
    db.update(apiKeys)
      .set({ lastUsedAt: new Date(), usageCount: sql`${apiKeys.usageCount} + 1` })
      .where(eq(apiKeys.id, key.id))
      .catch((err) => mcpLogger.warn({ err }, 'Failed to update api_key lastUsedAt'));

    // Strictly set tenant context
    req.companyId = key.companyId;
    req.apiKey = {
      id: key.id,
      companyId: key.companyId,
      name: key.name,
      permissions: key.permissions || [],
      isGracePeriod,
    };

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Permission guard for MCP tool actions (e.g. 'mcp:read', 'mcp:write')
 */
export function requireMcpScope(scope: 'mcp:read' | 'mcp:write') {
  return (req: AuthenticatedMcpRequest, res: Response, next: NextFunction): void => {
    const permissions = req.apiKey?.permissions || [];
    const hasScope =
      permissions.includes('*') ||
      permissions.includes('mcp:*') ||
      permissions.includes(scope) ||
      (scope === 'mcp:read' && permissions.includes('mcp:write'));

    if (!hasScope) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Insufficient API key scope. Required: ${scope}`,
        },
      });
      return;
    }

    next();
  };
}
