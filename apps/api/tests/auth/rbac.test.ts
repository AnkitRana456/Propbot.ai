import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@propbot/shared';
import { requireRole, requirePermission } from '../../src/middlewares/rbac.js';

describe('RBAC Middleware', () => {
  function createMockContext(role: UserRole) {
    const req = {
      user: {
        id: 'user-1',
        companyId: 'comp-1',
        email: 'test@example.com',
        name: 'Test',
        role,
        status: 'active',
      },
    } as unknown as Request;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;

    const next = vi.fn() as NextFunction;

    return { req, res, next };
  }

  describe('requireRole', () => {
    it('allows users with matching role', () => {
      const { req, res, next } = createMockContext('company_admin');
      const middleware = requireRole('company_admin', 'sales_manager');

      middleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('always permits super_admin', () => {
      const { req, res, next } = createMockContext('super_admin');
      const middleware = requireRole('sales_manager');

      middleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('denies access to non-matching role', () => {
      const { req, res, next } = createMockContext('agent');
      const middleware = requireRole('company_admin');

      middleware(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('requirePermission', () => {
    it('permits role with assigned permission', () => {
      const { req, res, next } = createMockContext('company_admin');
      const middleware = requirePermission('manage_chatbots', 'approve_users');

      middleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('blocks role without required permission', () => {
      const { req, res, next } = createMockContext('agent');
      const middleware = requirePermission('manage_billing');

      middleware(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});
