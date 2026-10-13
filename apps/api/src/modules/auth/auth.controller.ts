import type { Request, Response, NextFunction } from 'express';
import { authService, AuthError } from './auth.service.js';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.registerCompany(req.body);
      res.status(201).json({
        data: result,
      });
    } catch (err) {
      if (err instanceof AuthError) {
        res.status(err.statusCode).json({
          error: {
            code: err.code,
            message: err.message,
          },
        });
        return;
      }
      next(err);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.login(req.body);
      if (result && 'requires2faSetup' in result && result.requires2faSetup) {
        res.status(200).json({
          requires2faSetup: true,
          message: result.message,
          data: result,
        });
        return;
      }
      res.status(200).json({
        data: result,
      });
    } catch (err) {
      if (err instanceof AuthError) {
        res.status(err.statusCode).json({
          error: {
            code: err.code,
            message: err.message,
          },
        });
        return;
      }
      next(err);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refreshToken(refreshToken);
      res.status(200).json({
        data: result,
      });
    } catch (err) {
      if (err instanceof AuthError) {
        res.status(err.statusCode).json({
          error: {
            code: err.code,
            message: err.message,
          },
        });
        return;
      }
      next(err);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken, allDevices } = req.body;
      await authService.logout(refreshToken, allDevices, req.user?.id);
      res.status(200).json({
        data: {
          success: true,
          message: 'Logged out successfully.',
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;
      const result = await authService.forgotPassword(email);
      res.status(200).json({
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, newPassword } = req.body;
      const result = await authService.resetPassword(token, newPassword);
      res.status(200).json({
        data: result,
      });
    } catch (err) {
      if (err instanceof AuthError) {
        res.status(err.statusCode).json({
          error: {
            code: err.code,
            message: err.message,
          },
        });
        return;
      }
      next(err);
    }
  }

  async me(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      data: {
        user: req.user,
        tenant: req.tenant,
      },
    });
  }

  async getPendingUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const users = await authService.getPendingUsers(companyId);
      res.status(200).json({
        data: users,
      });
    } catch (err) {
      next(err);
    }
  }

  async approveUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const targetUserId = req.params.id;
      if (!targetUserId) {
        res.status(400).json({
          error: {
            code: 'MISSING_PARAM',
            message: 'User ID is required',
          },
        });
        return;
      }

      const approvedUser = await authService.approveUser(companyId, targetUserId);
      res.status(200).json({
        data: approvedUser,
      });
    } catch (err) {
      if (err instanceof AuthError) {
        res.status(err.statusCode).json({
          error: {
            code: err.code,
            message: err.message,
          },
        });
        return;
      }
      next(err);
    }
  }

  async rejectUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const targetUserId = req.params.id;
      if (!targetUserId) {
        res.status(400).json({
          error: {
            code: 'MISSING_PARAM',
            message: 'User ID is required',
          },
        });
        return;
      }

      const rejectedUser = await authService.rejectUser(companyId, targetUserId);
      res.status(200).json({
        data: rejectedUser,
      });
    } catch (err) {
      if (err instanceof AuthError) {
        res.status(err.statusCode).json({
          error: {
            code: err.code,
            message: err.message,
          },
        });
        return;
      }
      next(err);
    }
  }
}

export const authController = new AuthController();
