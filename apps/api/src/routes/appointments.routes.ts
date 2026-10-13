import { Router } from 'express';
import { appointmentsController } from '../modules/appointments/appointments.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { tenantGuard } from '../middlewares/tenant-guard.js';
import { requirePermission } from '../middlewares/rbac.js';

export const appointmentsRouter: Router = Router();

// ==========================================
// Public Endpoints (Calendar OAuth Callback & Survey)
// ==========================================

appointmentsRouter.get('/calendar/callback', (req, res, next) => {
  appointmentsController.handleCalendarCallback(req, res, next);
});

appointmentsRouter.post('/survey/:token', (req, res, next) => {
  appointmentsController.submitSurvey(req, res, next);
});

// ==========================================
// Authenticated Dashboard Endpoints
// ==========================================

appointmentsRouter.use(authenticate, tenantGuard);

// Availability & Slots
appointmentsRouter.get(
  '/available-slots',
  requirePermission('view_appointments'),
  (req, res, next) => {
    appointmentsController.getAvailableSlots(req, res, next);
  },
);

appointmentsRouter.get(
  '/settings/availability',
  requirePermission('view_appointments'),
  (req, res, next) => {
    appointmentsController.getAvailabilitySettings(req, res, next);
  },
);

appointmentsRouter.put(
  '/settings/availability',
  requirePermission('manage_settings'),
  (req, res, next) => {
    appointmentsController.updateAvailabilitySettings(req, res, next);
  },
);

// Calendar Setup & OAuth
appointmentsRouter.get(
  '/calendar/status',
  requirePermission('view_appointments'),
  (req, res, next) => {
    appointmentsController.getCalendarStatus(req, res, next);
  },
);

appointmentsRouter.get(
  '/calendar/oauth-url',
  requirePermission('manage_appointments'),
  (req, res, next) => {
    appointmentsController.getCalendarOAuthUrl(req, res, next);
  },
);

appointmentsRouter.post(
  '/calendar/mock-connect',
  requirePermission('manage_appointments'),
  (req, res, next) => {
    appointmentsController.mockConnectCalendar(req, res, next);
  },
);

appointmentsRouter.post(
  '/calendar/disconnect',
  requirePermission('manage_appointments'),
  (req, res, next) => {
    appointmentsController.disconnectCalendar(req, res, next);
  },
);

appointmentsRouter.delete(
  '/calendar/disconnect',
  requirePermission('manage_appointments'),
  (req, res, next) => {
    appointmentsController.disconnectCalendar(req, res, next);
  },
);

// Reminders Sweep (Worker or Admin trigger)
appointmentsRouter.post(
  '/reminders/sweep',
  requirePermission('manage_appointments'),
  (req, res, next) => {
    appointmentsController.triggerReminderSweep(req, res, next);
  },
);

// Appointments CRUD & KPIs
appointmentsRouter.get(
  '/kpis',
  requirePermission('view_appointments'),
  (req, res, next) => {
    appointmentsController.getKpis(req, res, next);
  },
);

appointmentsRouter.get(
  '/',
  requirePermission('view_appointments'),
  (req, res, next) => {
    appointmentsController.list(req, res, next);
  },
);

appointmentsRouter.post(
  '/',
  requirePermission('manage_appointments'),
  (req, res, next) => {
    appointmentsController.create(req, res, next);
  },
);

appointmentsRouter.get(
  '/:id',
  requirePermission('view_appointments'),
  (req, res, next) => {
    appointmentsController.getById(req, res, next);
  },
);

appointmentsRouter.post(
  '/:id/reschedule',
  requirePermission('manage_appointments'),
  (req, res, next) => {
    appointmentsController.reschedule(req, res, next);
  },
);

appointmentsRouter.patch(
  '/:id/reschedule',
  requirePermission('manage_appointments'),
  (req, res, next) => {
    appointmentsController.reschedule(req, res, next);
  },
);

appointmentsRouter.patch(
  '/:id/status',
  requirePermission('manage_appointments'),
  (req, res, next) => {
    appointmentsController.updateStatus(req, res, next);
  },
);
