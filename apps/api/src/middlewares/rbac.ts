import type { Request, Response, NextFunction } from 'express';
import { type UserRole, type Permission, hasPermission } from '@propbot/shared';

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
      return;
    }

    if (req.user.role === 'super_admin') {
      next();
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN_ROLE',
          message: `Access denied. Requires one of roles: ${roles.join(', ')}`,
        },
      });
      return;
    }

    next();
  };
}

export function requirePermission(...permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
      return;
    }

    if (req.user.role === 'super_admin') {
      next();
      return;
    }

    const missingPermissions = permissions.filter(p => !hasPermission(req.user!.role, p));

    if (missingPermissions.length > 0) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN_PERMISSION',
          message: `Access denied. Missing required permissions: ${missingPermissions.join(', ')}`,
        },
      });
      return;
    }

    next();
  };
}
