import type { Request, Response, NextFunction } from 'express';
import { ROLE_PERMISSIONS } from '@propbot/shared';

export function tenantGuard(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || !req.user.companyId) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required for tenant operations.',
      },
    });
    return;
  }

  // Reject any attempts to supply a mismatched company_id via body or query
  const claimedCompanyId =
    req.body?.companyId || req.body?.company_id || req.query?.companyId || req.query?.company_id;

  if (
    claimedCompanyId &&
    claimedCompanyId !== req.user.companyId &&
    req.user.role !== 'super_admin'
  ) {
    res.status(403).json({
      error: {
        code: 'TENANT_MISMATCH',
        message: 'Access denied: Client company parameter does not match authenticated tenant.',
      },
    });
    return;
  }

  req.tenant = {
    companyId: req.user.companyId,
    userId: req.user.id,
    role: req.user.role,
    permissions: ROLE_PERMISSIONS[req.user.role] ?? [],
  };
  req.companyId = req.user.companyId;

  next();
}
