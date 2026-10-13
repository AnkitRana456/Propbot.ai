import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { tenantGuard } from '../middlewares/tenant-guard.js';
import { requirePermission } from '../middlewares/rbac.js';
import { eventsController } from '../modules/events/events.controller.js';

export const eventsRouter: Router = Router();

eventsRouter.use(authenticate, tenantGuard);

// List domain events (manager/admin)
eventsRouter.get('/', requirePermission('manage_settings'), (req, res, next) =>
  eventsController.list(req, res, next),
);

// Replay a domain event (admin only)
eventsRouter.post('/:id/replay', requirePermission('manage_settings'), (req, res, next) =>
  eventsController.replay(req, res, next),
);
