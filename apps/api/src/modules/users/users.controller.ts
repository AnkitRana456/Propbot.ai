import type { Request, Response, NextFunction } from 'express';
import {
  userFilterSchema,
  updateUserSchema,
  inviteUserSchema,
  acceptInviteSchema,
  auditLogFilterSchema,
} from '@propbot/shared';
import { usersService } from './users.service.js';
import { invitationsService } from './invitations.service.js';
import { auditService } from '../audit/audit.service.js';

export class UsersController {
  async getUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const isSuperAdmin = req.user!.role === 'ps-owner';
      const filter = userFilterSchema.parse(req.query);

      const result = await usersService.getUsers(companyId, isSuperAdmin, filter);
      res.json({ success: true, data: result.users, pagination: result.pagination });
    } catch (err) {
      next(err);
    }
  }

  async getKpis(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const isSuperAdmin = req.user!.role === 'ps-owner';

      const data = await usersService.getKpis(companyId, isSuperAdmin);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async updateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const actorId = req.user!.id;
      const isSuperAdmin = req.user!.role === 'ps-owner';
      const targetUserId = req.params.id!;
      const input = updateUserSchema.parse(req.body);

      const data = await usersService.updateUser(
        companyId,
        targetUserId,
        input,
        actorId,
        isSuperAdmin,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async deleteUser(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const actorId = req.user!.id;
      const isSuperAdmin = req.user!.role === 'ps-owner';
      const targetUserId = req.params.id!;

      await usersService.deleteUser(companyId, targetUserId, actorId, isSuperAdmin);
      res.json({ success: true, message: 'User deactivated successfully.' });
    } catch (err) {
      next(err);
    }
  }

  async inviteUser(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const invitedBy = req.user!.id;
      const input = inviteUserSchema.parse(req.body);
      if (input.role === 'ps-owner' && req.user!.role !== 'ps-owner') {
        res.status(403).json({
          error: { code: 'FORBIDDEN_ROLE', message: 'Only a platform owner can invite a ps-owner.' },
        });
        return;
      }

      const data = await invitationsService.inviteUser(
        companyId,
        invitedBy,
        input,
        req.ip,
        req.headers['user-agent'],
      );
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getInvitations(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const data = await invitationsService.getInvitations(companyId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async revokeInvitation(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const actorId = req.user!.id;
      const invitationId = req.params.id!;

      await invitationsService.revokeInvitation(companyId, invitationId, actorId);
      res.json({ success: true, message: 'Invitation revoked successfully.' });
    } catch (err) {
      next(err);
    }
  }

  async acceptInvitation(req: Request, res: Response, next: NextFunction) {
    try {
      const input = acceptInviteSchema.parse(req.body);
      const result = await invitationsService.acceptInvitation(input);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async resetTwoFactor(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const actorId = req.user!.id;
      const targetUserId = req.params.id!;

      const result = await usersService.resetTwoFactor(companyId, targetUserId, actorId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const filter = auditLogFilterSchema.parse(req.query);

      const result = await auditService.getAuditLogs(companyId, filter);
      res.json({ success: true, data: result.logs, pagination: result.pagination });
    } catch (err) {
      next(err);
    }
  }

  async getUserSessions(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const data = await usersService.getUserSessions(userId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async revokeSession(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const familyId = req.params.familyId!;

      await usersService.revokeSession(userId, familyId, userId);
      res.json({ success: true, message: 'Session revoked successfully.' });
    } catch (err) {
      next(err);
    }
  }
}

export const usersController = new UsersController();
