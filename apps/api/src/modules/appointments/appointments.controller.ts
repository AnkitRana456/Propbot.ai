import type { Request, Response, NextFunction } from 'express';
import { appointmentsService } from './appointments.service.js';
import { availabilityService } from './availability.service.js';
import { calendarSyncService } from './calendar-sync.service.js';
import { appointmentReminderService } from './appointment-reminder.service.js';
import {
  createAppointmentInputSchema,
  rescheduleAppointmentInputSchema,
  updateAppointmentStatusInputSchema,
  availableSlotsQuerySchema,
  availabilitySettingsSchema,
  bookVisitChatInputSchema,
  appointmentSurveyInputSchema,
  type AppointmentStatus,
} from '@propbot/shared';

function getCompanyId(req: Request): string {
  const companyId = req.tenant?.companyId;
  if (!companyId) {
    const err = new Error('Tenant context required');
    Object.assign(err, { statusCode: 403 });
    throw err;
  }
  return companyId;
}

export class AppointmentsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const { status, search, date, agentId, projectId, leadId, page, limit } = req.query;

      const result = await appointmentsService.listAppointments(companyId, {
        status: status ? (String(status) as AppointmentStatus) : undefined,
        search: search ? String(search) : undefined,
        date: date ? String(date) : undefined,
        agentId: agentId ? String(agentId) : undefined,
        projectId: projectId ? String(projectId) : undefined,
        leadId: leadId ? String(leadId) : undefined,
        page: page ? parseInt(String(page), 10) : undefined,
        limit: limit ? parseInt(String(limit), 10) : undefined,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getKpis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const result = await appointmentsService.getKpis(companyId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const result = await appointmentsService.getAppointmentById(companyId, req.params.id as string);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const parsed = createAppointmentInputSchema.parse(req.body);
      const result = await appointmentsService.createAppointment(companyId, parsed);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async reschedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const parsed = rescheduleAppointmentInputSchema.parse(req.body);
      const result = await appointmentsService.rescheduleAppointment(companyId, req.params.id as string, parsed);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const parsed = updateAppointmentStatusInputSchema.parse(req.body);
      const result = await appointmentsService.updateAppointmentStatus(companyId, req.params.id as string, parsed);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getAvailableSlots(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant?.companyId || (req.query.companyId as string);
      if (!companyId) {
        res.status(400).json({ error: { message: 'Company ID is required' } });
        return;
      }

      const parsed = availableSlotsQuerySchema.parse(req.query);
      const result = await availabilityService.getAvailableSlots(
        companyId,
        parsed.date,
        parsed.projectId,
        parsed.agentId,
      );

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getAvailabilitySettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const { agentId, projectId } = req.query;
      const result = await availabilityService.getAvailabilitySettings(
        companyId,
        agentId ? String(agentId) : undefined,
        projectId ? String(projectId) : undefined,
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async updateAvailabilitySettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const { agentId, projectId } = req.query;
      const parsed = availabilitySettingsSchema.partial().parse(req.body);
      const result = await availabilityService.updateAvailabilitySettings(
        companyId,
        parsed,
        agentId ? String(agentId) : undefined,
        projectId ? String(projectId) : undefined,
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getCalendarStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const result = await calendarSyncService.getIntegrationStatus(companyId, req.user?.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getCalendarOAuthUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const url = calendarSyncService.getOAuthUrl(companyId, req.user?.id);
      res.json({ success: true, data: { url } });
    } catch (err) {
      next(err);
    }
  }

  async handleCalendarCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, state } = req.query;
      let companyId: string | undefined;
      let userId: string | undefined;

      if (state) {
        try {
          const parsedState = JSON.parse(Buffer.from(String(state), 'base64url').toString('utf8'));
          companyId = parsedState.companyId;
          userId = parsedState.userId;
        } catch {
          // ignore error
        }
      }

      if (!companyId) {
        companyId = req.tenant?.companyId;
      }

      if (!companyId) {
        res.status(400).json({ error: { message: 'Missing company context in OAuth callback' } });
        return;
      }

      await calendarSyncService.handleOAuthCallback(companyId, String(code || 'mock_code'), userId);

      const webUrl = process.env.WEB_URL || 'http://localhost:5173';
      res.redirect(`${webUrl}/appointments?calendar_connected=true`);
    } catch (err) {
      next(err);
    }
  }

  async disconnectCalendar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      await calendarSyncService.disconnect(companyId, req.user?.id);
      res.json({ success: true, message: 'Google Calendar disconnected' });
    } catch (err) {
      next(err);
    }
  }

  async mockConnectCalendar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const email = req.body?.email || 'agent@proprealty.com';
      await calendarSyncService.handleOAuthCallback(companyId, 'mock_code', req.user?.id);
      const status = await calendarSyncService.getIntegrationStatus(companyId);
      res.json({
        success: true,
        data: {
          ...status,
          email,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async bookVisitFromChat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = bookVisitChatInputSchema.parse(req.body);
      const result = await appointmentsService.bookVisitFromChat(req.params.chatbotId as string, parsed);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async submitSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = appointmentSurveyInputSchema.parse(req.body);
      const result = await appointmentReminderService.submitSurvey(req.params.token as string, parsed);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async triggerReminderSweep(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await appointmentReminderService.sweepAndSendReminders();
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const appointmentsController = new AppointmentsController();
