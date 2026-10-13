import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../modules/auth/auth.utils.js';

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token required',
      },
    });
    return;
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid bearer authorization header format',
      },
    });
    return;
  }

  try {
    const payload = verifyAccessToken(token);

    if (payload.status === 'pending_approval') {
      res.status(403).json({
        error: {
          code: 'ACCOUNT_PENDING_APPROVAL',
          message: 'Your account is pending administrator approval.',
        },
      });
      return;
    }

    if (payload.status === 'disabled') {
      res.status(403).json({
        error: {
          code: 'ACCOUNT_DISABLED',
          message: 'Your account has been disabled.',
        },
      });
      return;
    }

    req.user = {
      id: payload.sub,
      companyId: payload.companyId,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      status: payload.status,
    };

    next();
  } catch {
    res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Access token is invalid or expired',
      },
    });
  }
}
