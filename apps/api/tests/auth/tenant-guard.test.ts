import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { tenantGuard } from '../../src/middlewares/tenant-guard.js';

describe('Tenant Guard Middleware', () => {
  it('blocks unauthenticated requests without req.user', () => {
    const req = {} as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    tenantGuard(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('populates req.tenant from authenticated user token', () => {
    const req = {
      user: {
        id: 'user-123',
        companyId: 'company-abc',
        role: 'company_admin',
        status: 'active',
        name: 'Admin',
        email: 'admin@company.com',
      },
    } as unknown as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    tenantGuard(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.tenant).toBeDefined();
    expect(req.tenant?.companyId).toBe('company-abc');
    expect(req.tenant?.role).toBe('company_admin');
    expect(req.tenant?.permissions).toContain('approve_users');
  });

  it('rejects client attempts to override companyId with a mismatched ID', () => {
    const req = {
      user: {
        id: 'user-123',
        companyId: 'company-legit',
        role: 'company_admin',
        status: 'active',
      },
      body: {
        companyId: 'company-malicious-target',
      },
    } as unknown as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    tenantGuard(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
