import crypto from 'crypto';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { authenticate } from './authenticate.js';
import { tenantGuard } from './tenant-guard.js';
import { requirePermission } from './rbac.js';

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** True when the request carries `Authorization: Bearer <CRON_SECRET>` (or x-cron-secret). */
export function hasValidCronSecret(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // never accept an empty/unset secret
  const header = req.headers.authorization;
  const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  const provided = bearer ?? (req.headers['x-cron-secret'] as string | undefined);
  return Boolean(provided) && safeEqual(provided as string, secret);
}

/** Cron-only endpoints (e.g. the 30-day archival job). 401 without a valid CRON_SECRET. */
export const requireCronSecret: RequestHandler = (req, res, next) => {
  if (hasValidCronSecret(req)) {
    next();
    return;
  }
  res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Valid cron secret required.' } });
};

/**
 * Maintenance endpoints: either the scheduler (CRON_SECRET) or a signed-in admin
 * (ps-owner / company_admin via manage_company). `req.cronRun` tells handlers which one called.
 */
export const cronOrAdmin: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  if (hasValidCronSecret(req)) {
    (req as Request & { cronRun?: boolean }).cronRun = true;
    next();
    return;
  }
  const requireAdmin = requirePermission('manage_company');
  authenticate(req, res, (e1?: unknown) => {
    if (e1) return next(e1);
    tenantGuard(req, res, (e2?: unknown) => {
      if (e2) return next(e2);
      requireAdmin(req, res, next);
    });
  });
};
