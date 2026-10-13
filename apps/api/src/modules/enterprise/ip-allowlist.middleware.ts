import type { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { companies } from '../../db/schema/index.js';

/**
 * Checks client IP address against company-configured IP allowlist.
 */
export async function ipAllowlistGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const companyId = req.companyId;
  if (!companyId) {
    return next();
  }

  try {
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) {
      return next();
    }

    const settings = (company.settings as Record<string, unknown>) || {};
    const allowlist = settings.ipAllowlist as string[] | undefined;

    if (!allowlist || !Array.isArray(allowlist) || allowlist.length === 0) {
      return next();
    }

    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      req.ip ||
      '';

    const normalizedClient = clientIp.replace(/^::ffff:/, '');

    const isAllowed = allowlist.some((allowed) => {
      const normalizedAllowed = allowed.trim().replace(/^::ffff:/, '');
      if (normalizedAllowed === '*' || normalizedAllowed === normalizedClient) {
        return true;
      }
      // Simple subnet prefix match or CIDR
      if (normalizedAllowed.endsWith('/24')) {
        const prefix = normalizedAllowed.split('.').slice(0, 3).join('.');
        return normalizedClient.startsWith(prefix);
      }
      return false;
    });

    if (!isAllowed) {
      res.status(403).json({
        error: {
          code: 'IP_RESTRICTED',
          message: `Access denied: IP address ${normalizedClient} is not permitted by company IP allowlist policy.`,
        },
      });
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}
