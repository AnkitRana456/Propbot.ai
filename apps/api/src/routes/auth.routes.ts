import { Router } from 'express';
import {
  registerCompanySchema,
  loginSchema,
  refreshTokenSchema,
  logoutSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '@propbot/shared';
import { authController } from '../modules/auth/auth.controller.js';
import { handleGoogleAuth, handleGoogleCallback } from '../modules/auth/google-oauth.js';
import { validateBody } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/authenticate.js';
import { tenantGuard } from '../middlewares/tenant-guard.js';
import { requireRole } from '../middlewares/rbac.js';

export const authRouter: Router = Router();

// Public Authentication
authRouter.post('/register', validateBody(registerCompanySchema), (req, res, next) => {
  authController.register(req, res, next);
});

authRouter.post('/login', validateBody(loginSchema), (req, res, next) => {
  authController.login(req, res, next);
});

authRouter.post('/refresh', validateBody(refreshTokenSchema), (req, res, next) => {
  authController.refresh(req, res, next);
});

authRouter.post('/logout', authenticate, validateBody(logoutSchema), (req, res, next) => {
  authController.logout(req, res, next);
});

authRouter.post('/forgot-password', validateBody(forgotPasswordSchema), (req, res, next) => {
  authController.forgotPassword(req, res, next);
});

authRouter.post('/reset-password', validateBody(resetPasswordSchema), (req, res, next) => {
  authController.resetPassword(req, res, next);
});

// Authenticated User & Tenant Context
authRouter.get('/me', authenticate, tenantGuard, (req, res) => {
  authController.me(req, res);
});

// Admin Approval for Pending Users
authRouter.get(
  '/users/pending',
  authenticate,
  tenantGuard,
  requireRole('company_admin', 'super_admin'),
  (req, res, next) => {
    authController.getPendingUsers(req, res, next);
  },
);

authRouter.post(
  '/users/:id/approve',
  authenticate,
  tenantGuard,
  requireRole('company_admin', 'super_admin'),
  (req, res, next) => {
    authController.approveUser(req, res, next);
  },
);

authRouter.post(
  '/users/:id/reject',
  authenticate,
  tenantGuard,
  requireRole('company_admin', 'super_admin'),
  (req, res, next) => {
    authController.rejectUser(req, res, next);
  },
);

// Optional Google OAuth
authRouter.get('/google', handleGoogleAuth);
authRouter.get('/google/callback', handleGoogleCallback);
