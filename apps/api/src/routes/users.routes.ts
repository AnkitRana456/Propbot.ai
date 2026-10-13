import { Router } from 'express';
import { usersController } from '../modules/users/users.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { tenantGuard } from '../middlewares/tenant-guard.js';
import { requirePermission } from '../middlewares/rbac.js';
import { enforcePlanLimit } from '../middlewares/plan-limits.js';

export const usersRouter: Router = Router();

// Public invitation acceptance
usersRouter.post('/accept-invite', (req, res, next) =>
  usersController.acceptInvitation(req, res, next),
);

// Protected routes
usersRouter.use(authenticate, tenantGuard);

// Personal session management (all active authenticated users)
usersRouter.get('/sessions', (req, res, next) => usersController.getUserSessions(req, res, next));
usersRouter.delete('/sessions/:familyId', (req, res, next) =>
  usersController.revokeSession(req, res, next),
);

// User & team management (requires manage_users)
usersRouter.get('/', requirePermission('manage_users'), (req, res, next) =>
  usersController.getUsers(req, res, next),
);
usersRouter.get('/kpis', requirePermission('manage_users'), (req, res, next) =>
  usersController.getKpis(req, res, next),
);
usersRouter.post(
  '/invite',
  requirePermission('manage_users'),
  enforcePlanLimit('users'),
  (req, res, next) => usersController.inviteUser(req, res, next),
);
usersRouter.get('/invitations', requirePermission('manage_users'), (req, res, next) =>
  usersController.getInvitations(req, res, next),
);
usersRouter.delete('/invitations/:id', requirePermission('manage_users'), (req, res, next) =>
  usersController.revokeInvitation(req, res, next),
);
usersRouter.put('/:id', requirePermission('manage_users'), (req, res, next) =>
  usersController.updateUser(req, res, next),
);
usersRouter.delete('/:id', requirePermission('manage_users'), (req, res, next) =>
  usersController.deleteUser(req, res, next),
);
usersRouter.post('/:id/reset-2fa', requirePermission('manage_users'), (req, res, next) =>
  usersController.resetTwoFactor(req, res, next),
);
usersRouter.get('/audit-logs', requirePermission('manage_users'), (req, res, next) =>
  usersController.getAuditLogs(req, res, next),
);
