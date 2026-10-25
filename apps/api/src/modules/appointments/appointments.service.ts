import { eq, ne, and, sql, desc, or, ilike, notInArray, gte, lte } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  appointments,
  leads,
  contacts,
  projects,
  users,
  leadActivities,
  domainEvents,
  tasks,
  chatbots,
} from '../../db/schema/index.js';
import type {
  AppointmentItem,
  CreateAppointmentInput,
  RescheduleAppointmentInput,
  UpdateAppointmentStatusInput,
  AppointmentsListResponse,
  AppointmentsKpiResponse,
  BookVisitChatInput,
  AppointmentStatus,
  ScoreHistoryItem,
} from '@propbot/shared';
import crypto from 'crypto';
import { availabilityService } from './availability.service.js';
import { calendarSyncService } from './calendar-sync.service.js';
import { appointmentReminderService } from './appointment-reminder.service.js';
import { IntentScorerService } from '../leads/intent-scorer.service.js';
import { leadsService } from '../leads/leads.service.js';

export class AppointmentsService {
  private intentScorer = new IntentScorerService();

  /**
   * Lists appointments with search, status filters, date range, pagination, and KPI metrics.
   */
  async listAppointments(
    companyId: string,
    query: {
      status?: AppointmentStatus;
      search?: string;
      date?: string; // 'today' | 'upcoming' | 'past' | YYYY-MM-DD
      agentId?: string;
      projectId?: string;
      leadId?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<AppointmentsListResponse> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const offset = (page - 1) * limit;

    const conditions = [eq(appointments.companyId, companyId)];

    if (query.status) {
      conditions.push(eq(appointments.status, query.status));
    }

    if (query.agentId) {
      conditions.push(eq(appointments.assignedAgentId, query.agentId));
    }

    if (query.projectId) {
      conditions.push(eq(appointments.projectId, query.projectId));
    }

    if (query.leadId) {
      conditions.push(eq(appointments.leadId, query.leadId));
    }

    const now = new Date();
    if (query.date === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      conditions.push(gte(appointments.scheduledAt, todayStart), lte(appointments.scheduledAt, todayEnd));
    } else if (query.date === 'upcoming') {
      conditions.push(gte(appointments.scheduledAt, now));
    } else if (query.date === 'past') {
      conditions.push(lte(appointments.scheduledAt, now));
    } else if (query.date && /^\d{4}-\d{2}-\d{2}$/.test(query.date)) {
      const dayStart = new Date(`${query.date}T00:00:00.000Z`);
      const dayEnd = new Date(`${query.date}T23:59:59.999Z`);
      conditions.push(gte(appointments.scheduledAt, dayStart), lte(appointments.scheduledAt, dayEnd));
    }

    if (query.search?.trim()) {
      const s = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(contacts.firstName, s),
          ilike(contacts.lastName, s),
          ilike(contacts.phone, s),
          ilike(contacts.email, s),
          ilike(projects.name, s),
          ilike(users.name, s),
        )!,
      );
    }

    // 1. Fetch total count
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(appointments)
      .leftJoin(leads, eq(appointments.leadId, leads.id))
      .leftJoin(contacts, eq(leads.contactId, contacts.id))
      .leftJoin(projects, eq(appointments.projectId, projects.id))
      .leftJoin(users, eq(appointments.assignedAgentId, users.id))
      .where(and(...conditions));

    const total = countRow?.count || 0;

    // 2. Fetch rows
    const rows = await db
      .select({
        appointment: appointments,
        contactFirstName: contacts.firstName,
        contactLastName: contacts.lastName,
        contactPhone: contacts.phone,
        contactEmail: contacts.email,
        leadSource: leads.source,
        projectName: projects.name,
        projectLocation: projects.location,
        assignedAgentName: users.name,
        assignedAgentEmail: users.email,
      })
      .from(appointments)
      .leftJoin(leads, eq(appointments.leadId, leads.id))
      .leftJoin(contacts, eq(leads.contactId, contacts.id))
      .leftJoin(projects, eq(appointments.projectId, projects.id))
      .leftJoin(users, eq(appointments.assignedAgentId, users.id))
      .where(and(...conditions))
      .orderBy(desc(appointments.scheduledAt))
      .limit(limit)
      .offset(offset);

    const items: AppointmentItem[] = rows.map(r => {
      const leadName = [r.contactFirstName, r.contactLastName].filter(Boolean).join(' ') || undefined;
      return {
        id: r.appointment.id,
        companyId: r.appointment.companyId,
        leadId: r.appointment.leadId,
        projectId: r.appointment.projectId,
        assignedAgentId: r.appointment.assignedAgentId,
        scheduledAt: r.appointment.scheduledAt.toISOString(),
        durationMinutes: r.appointment.durationMinutes,
        status: r.appointment.status as AppointmentItem['status'],
        appointmentType: r.appointment.appointmentType as AppointmentItem['appointmentType'],
        location: r.appointment.location,
        meetingLink: r.appointment.meetingLink,
        calendarEventId: r.appointment.calendarEventId,
        calendarStatus: r.appointment.calendarStatus as AppointmentItem['calendarStatus'],
        notes: r.appointment.notes,
        cancellationReason: r.appointment.cancellationReason,
        rescheduledFromId: r.appointment.rescheduledFromId,
        reminderSent24h: r.appointment.reminderSent24h,
        reminderSent2h: r.appointment.reminderSent2h,
        surveyToken: r.appointment.surveyToken,
        surveyRating: r.appointment.surveyRating,
        surveyFeedback: r.appointment.surveyFeedback,
        surveyInterestedInBooking: r.appointment.surveyInterestedInBooking as AppointmentItem['surveyInterestedInBooking'],
        surveyCompletedAt: r.appointment.surveyCompletedAt ? r.appointment.surveyCompletedAt.toISOString() : null,
        leadName,
        leadPhone: r.contactPhone || undefined,
        leadEmail: r.contactEmail || undefined,
        leadSource: r.leadSource || undefined,
        projectName: r.projectName || undefined,
        projectLocation: r.projectLocation || undefined,
        assignedAgentName: r.assignedAgentName || undefined,
        assignedAgentEmail: r.assignedAgentEmail || undefined,
        createdAt: r.appointment.createdAt.toISOString(),
        updatedAt: r.appointment.updatedAt.toISOString(),
      };
    });

    // 3. Compute KPI metrics for company
    const kpis = await this.getKpis(companyId);

    return {
      items,
      total,
      page,
      limit,
      kpis,
    };
  }

  /**
   * Computes KPI cards: Upcoming, Today, Calendar Synced, All.
   */
  async getKpis(companyId: string): Promise<AppointmentsKpiResponse> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const [kpiRow] = await db
      .select({
        all: sql<number>`count(*)::int`,
        upcoming: sql<number>`count(case when ${appointments.scheduledAt} >= ${now.toISOString()}::timestamptz and ${appointments.status} in ('scheduled', 'confirmed') then 1 end)::int`,
        today: sql<number>`count(case when ${appointments.scheduledAt} >= ${todayStart.toISOString()}::timestamptz and ${appointments.scheduledAt} <= ${todayEnd.toISOString()}::timestamptz and ${appointments.status} not in ('cancelled', 'rescheduled') then 1 end)::int`,
        calendarSynced: sql<number>`count(case when ${appointments.calendarStatus} = 'synced' then 1 end)::int`,
      })
      .from(appointments)
      .where(eq(appointments.companyId, companyId));

    return {
      upcoming: kpiRow?.upcoming || 0,
      today: kpiRow?.today || 0,
      calendarSynced: kpiRow?.calendarSynced || 0,
      all: kpiRow?.all || 0,
    };
  }

  /**
   * Retrieves single appointment by ID.
   */
  async getAppointmentById(companyId: string, id: string): Promise<AppointmentItem> {
    const [row] = await db
      .select({
        appointment: appointments,
        contactFirstName: contacts.firstName,
        contactLastName: contacts.lastName,
        contactPhone: contacts.phone,
        contactEmail: contacts.email,
        leadSource: leads.source,
        projectName: projects.name,
        projectLocation: projects.location,
        assignedAgentName: users.name,
        assignedAgentEmail: users.email,
      })
      .from(appointments)
      .leftJoin(leads, eq(appointments.leadId, leads.id))
      .leftJoin(contacts, eq(leads.contactId, contacts.id))
      .leftJoin(projects, eq(appointments.projectId, projects.id))
      .leftJoin(users, eq(appointments.assignedAgentId, users.id))
      .where(and(eq(appointments.id, id), eq(appointments.companyId, companyId)));

    if (!row) {
      const err = new Error('Appointment not found');
      Object.assign(err, { statusCode: 404 });
      throw err;
    }

    const leadName = [row.contactFirstName, row.contactLastName].filter(Boolean).join(' ') || undefined;

    return {
      id: row.appointment.id,
      companyId: row.appointment.companyId,
      leadId: row.appointment.leadId,
      projectId: row.appointment.projectId,
      assignedAgentId: row.appointment.assignedAgentId,
      scheduledAt: row.appointment.scheduledAt.toISOString(),
      durationMinutes: row.appointment.durationMinutes,
      status: row.appointment.status as AppointmentItem['status'],
      appointmentType: row.appointment.appointmentType as AppointmentItem['appointmentType'],
      location: row.appointment.location,
      meetingLink: row.appointment.meetingLink,
      calendarEventId: row.appointment.calendarEventId,
      calendarStatus: row.appointment.calendarStatus as AppointmentItem['calendarStatus'],
      notes: row.appointment.notes,
      cancellationReason: row.appointment.cancellationReason,
      rescheduledFromId: row.appointment.rescheduledFromId,
      reminderSent24h: row.appointment.reminderSent24h,
      reminderSent2h: row.appointment.reminderSent2h,
      surveyToken: row.appointment.surveyToken,
      surveyRating: row.appointment.surveyRating,
      surveyFeedback: row.appointment.surveyFeedback,
      surveyInterestedInBooking: row.appointment.surveyInterestedInBooking as AppointmentItem['surveyInterestedInBooking'],
      surveyCompletedAt: row.appointment.surveyCompletedAt ? row.appointment.surveyCompletedAt.toISOString() : null,
      leadName,
      leadPhone: row.contactPhone || undefined,
      leadEmail: row.contactEmail || undefined,
      leadSource: row.leadSource || undefined,
      projectName: row.projectName || undefined,
      projectLocation: row.projectLocation || undefined,
      assignedAgentName: row.assignedAgentName || undefined,
      assignedAgentEmail: row.assignedAgentEmail || undefined,
      createdAt: row.appointment.createdAt.toISOString(),
      updatedAt: row.appointment.updatedAt.toISOString(),
    };
  }

  /**
   * Creates a new appointment with concurrency conflict detection, agent round-robin, and calendar sync.
   */
  async createAppointment(companyId: string, input: CreateAppointmentInput): Promise<AppointmentItem> {
    const scheduledAt = new Date(input.scheduledAt);
    if (isNaN(scheduledAt.getTime())) {
      throw new Error('Invalid scheduledAt timestamp');
    }

    // 1. Validate lead ownership
    const [lead] = await db
      .select({
        lead: leads,
        contact: contacts,
      })
      .from(leads)
      .leftJoin(contacts, eq(leads.contactId, contacts.id))
      .where(and(eq(leads.id, input.leadId), eq(leads.companyId, companyId)));

    if (!lead) {
      const err = new Error('Lead not found');
      Object.assign(err, { statusCode: 404 });
      throw err;
    }

    const leadFullName = lead.contact
      ? [lead.contact.firstName, lead.contact.lastName].filter(Boolean).join(' ')
      : 'Visitor';

    // 2. Validate project ownership if supplied
    let projectLocation: string | undefined;
    let projectName: string | undefined;
    if (input.projectId) {
      const [proj] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, input.projectId), eq(projects.companyId, companyId)));

      if (!proj) {
        const err = new Error('Project not found');
        Object.assign(err, { statusCode: 404 });
        throw err;
      }
      projectLocation = proj.location;
      projectName = proj.name;
    }

    // 3. Resolve assigned agent (explicit or round-robin)
    let agentId = input.assignedAgentId;
    if (!agentId) {
      agentId = (await availabilityService.findAvailableAgent(companyId, scheduledAt)) || undefined;
    } else {
      const [agent] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, agentId), eq(users.companyId, companyId)));
      if (!agent) {
        const err = new Error('Assigned agent not found');
        Object.assign(err, { statusCode: 404 });
        throw err;
      }
    }

    // 4. Strict Concurrency Check & Double-Booking Prevention using Transaction Lock
    const createdAppointment = await db.transaction(async tx => {
      const slotToleranceMs = 15 * 60 * 1000;
      const slotStart = new Date(scheduledAt.getTime() - slotToleranceMs);
      const slotEnd = new Date(scheduledAt.getTime() + slotToleranceMs);

      const conflictConditions = [
        eq(appointments.companyId, companyId),
        gte(appointments.scheduledAt, slotStart),
        lte(appointments.scheduledAt, slotEnd),
        notInArray(appointments.status, ['cancelled', 'rescheduled']),
      ];

      if (agentId) {
        conflictConditions.push(eq(appointments.assignedAgentId, agentId));
      }

      // Concurrency check lock
      const [conflict] = await tx
        .select({ id: appointments.id })
        .from(appointments)
        .where(and(...conflictConditions))
        .limit(1);

      if (conflict) {
        const err = new Error('The requested time slot is no longer available. Please select another time.');
        Object.assign(err, { statusCode: 409, code: 'SLOT_UNAVAILABLE' });
        throw err;
      }

      const surveyToken = crypto.randomBytes(16).toString('hex');
      const location = input.location || projectLocation || 'Project Site Gallery';
      const durationMinutes = input.durationMinutes || 45;

      // Sync with Google Calendar if connected
      const calendarSync = await calendarSyncService.createEvent(companyId, {
        summary: `Site Visit - ${projectName || 'Property'} - ${leadFullName}`,
        description: `Lead: ${leadFullName}\nPhone: ${lead.contact?.phone || 'N/A'}\nNotes: ${input.notes || 'None'}`,
        location,
        start: scheduledAt,
        end: new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000),
        attendeeEmail: lead.contact?.email || undefined,
        withMeet: input.appointmentType === 'video_call',
      });

      const [inserted] = await tx
        .insert(appointments)
        .values({
          companyId,
          leadId: lead.lead.id,
          projectId: input.projectId || null,
          assignedAgentId: agentId || null,
          scheduledAt,
          durationMinutes,
          status: 'scheduled',
          appointmentType: input.appointmentType || 'site_visit',
          location,
          meetingLink: input.meetingLink || calendarSync.meetingLink || null,
          calendarEventId: calendarSync.calendarEventId || null,
          calendarStatus: calendarSync.calendarStatus,
          notes: input.notes || null,
          surveyToken,
        })
        .returning();

      if (!inserted) {
        throw new Error('Failed to create appointment');
      }

      // 5. Update lead pipeline stage to site_visit_scheduled
      await tx
        .update(leads)
        .set({
          status: 'site_visit_scheduled',
          nextFollowUpAt: scheduledAt,
          updatedAt: new Date(),
        })
        .where(eq(leads.id, lead.lead.id));

      // 6. Log lead activity
      await tx.insert(leadActivities).values({
        companyId,
        leadId: lead.lead.id,
        contactId: lead.lead.contactId,
        activityType: 'stage_changed',
        title: `Site Visit Appointment Booked for ${scheduledAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
        metadata: {
          appointmentId: inserted.id,
          projectId: input.projectId,
          scheduledAt: scheduledAt.toISOString(),
          assignedAgentId: agentId,
        },
      });

      // 7. Emit domain event visit_booked
      await tx.insert(domainEvents).values({
        companyId,
        type: 'visit_booked',
        payload: {
          appointmentId: inserted.id,
          leadId: lead.lead.id,
          projectId: input.projectId,
          scheduledAt: scheduledAt.toISOString(),
          assignedAgentId: agentId,
        },
      });

      return inserted;
    });

    if (!createdAppointment) {
      throw new Error('Failed to create appointment');
    }

    // 8. Intent Score raise (+25 points for booking site visit)
    const [currentLead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, lead.lead.id), eq(leads.companyId, companyId)));

    if (currentLead) {
      const newScore = Math.min(100, (currentLead.intentScore || 0) + 25);
      const newLabel = newScore >= 70 ? 'hot' : newScore >= 35 ? 'warm' : 'cold';
      const history = (currentLead.scoreHistory as ScoreHistoryItem[]) || [];
      history.push({
        score: newScore,
        delta: 25,
        reason: 'Site visit appointment booked (+25)',
        timestamp: new Date().toISOString(),
      });

      await db
        .update(leads)
        .set({
          intentScore: newScore,
          intentLabel: newLabel,
          scoreHistory: history,
          updatedAt: new Date(),
        })
        .where(eq(leads.id, lead.lead.id));
    }

    return this.getAppointmentById(companyId, createdAppointment.id);
  }

  /**
   * Reschedules an appointment.
   */
  async rescheduleAppointment(
    companyId: string,
    id: string,
    input: RescheduleAppointmentInput,
  ): Promise<AppointmentItem> {
    const existing = await this.getAppointmentById(companyId, id);
    const newScheduledAt = new Date(input.scheduledAt);

    if (isNaN(newScheduledAt.getTime())) {
      throw new Error('Invalid scheduledAt timestamp');
    }

    const [lead] = await db
      .select({ contactId: leads.contactId })
      .from(leads)
      .where(eq(leads.id, existing.leadId));

    // Check slot availability for new date/time
    const slotToleranceMs = 15 * 60 * 1000;
    const slotStart = new Date(newScheduledAt.getTime() - slotToleranceMs);
    const slotEnd = new Date(newScheduledAt.getTime() + slotToleranceMs);

    const conflictConditions = [
      eq(appointments.companyId, companyId),
      gte(appointments.scheduledAt, slotStart),
      lte(appointments.scheduledAt, slotEnd),
      notInArray(appointments.status, ['cancelled', 'rescheduled']),
      ne(appointments.id, id),
    ];

    if (existing.assignedAgentId) {
      conflictConditions.push(eq(appointments.assignedAgentId, existing.assignedAgentId));
    }

    const [conflict] = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(and(...conflictConditions))
      .limit(1);

    if (conflict) {
      const err = new Error('The newly requested time slot is not available. Please choose another time.');
      Object.assign(err, { statusCode: 409, code: 'SLOT_UNAVAILABLE' });
      throw err;
    }

    // Update calendar event if synced
    await calendarSyncService.updateEvent(companyId, existing.calendarEventId, {
      summary: `Rescheduled: Site Visit - ${existing.projectName || 'Property'} - ${existing.leadName}`,
      location: existing.location || undefined,
      start: newScheduledAt,
      end: new Date(newScheduledAt.getTime() + existing.durationMinutes * 60 * 1000),
    });

    // Update appointment
    await db
      .update(appointments)
      .set({
        scheduledAt: newScheduledAt,
        status: 'rescheduled',
        reminderSent24h: false,
        reminderSent2h: false,
        notes: input.reason
          ? existing.notes
            ? `${existing.notes}\nReschedule reason: ${input.reason}`
            : `Reschedule reason: ${input.reason}`
          : existing.notes,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, id));

    // Log activity
    if (lead) {
      await db.insert(leadActivities).values({
        companyId,
        leadId: existing.leadId,
        contactId: lead.contactId,
        activityType: 'stage_changed',
        title: `Site Visit Rescheduled to ${newScheduledAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
        metadata: {
          appointmentId: id,
          newScheduledAt: newScheduledAt.toISOString(),
          reason: input.reason,
        },
      });
    }

    // Emit domain event
    await db.insert(domainEvents).values({
      companyId,
      type: 'visit_changed',
      payload: {
        appointmentId: id,
        action: 'rescheduled',
        newScheduledAt: newScheduledAt.toISOString(),
        reason: input.reason,
      },
    });

    return this.getAppointmentById(companyId, id);
  }

  /**
   * Updates appointment status (confirmed, completed, no_show, cancelled).
   */
  async updateAppointmentStatus(
    companyId: string,
    id: string,
    input: UpdateAppointmentStatusInput,
  ): Promise<AppointmentItem> {
    const existing = await this.getAppointmentById(companyId, id);

    if (input.status === 'no_show') {
      await appointmentReminderService.handleNoShow(companyId, id);
      return this.getAppointmentById(companyId, id);
    }

    const [lead] = await db
      .select({
        contactId: leads.contactId,
        assignedAgentId: leads.assignedAgentId,
      })
      .from(leads)
      .where(eq(leads.id, existing.leadId));

    if (input.status === 'cancelled') {
      await calendarSyncService.deleteEvent(companyId, existing.calendarEventId);

      await db
        .update(appointments)
        .set({
          status: 'cancelled',
          cancellationReason: input.cancellationReason || null,
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, id));

      if (lead) {
        await db.insert(leadActivities).values({
          companyId,
          leadId: existing.leadId,
          contactId: lead.contactId,
          activityType: 'stage_changed',
          title: `Site Visit Cancelled: ${input.cancellationReason || 'No reason provided'}`,
          metadata: {
            appointmentId: id,
            cancellationReason: input.cancellationReason,
          },
        });
      }

      await db.insert(domainEvents).values({
        companyId,
        type: 'visit_changed',
        payload: {
          appointmentId: id,
          action: 'cancelled',
          cancellationReason: input.cancellationReason,
        },
      });

      return this.getAppointmentById(companyId, id);
    }

    if (input.status === 'completed') {
      await db
        .update(appointments)
        .set({
          status: 'completed',
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, id));

      // Update lead stage to site_visit_done
      await db
        .update(leads)
        .set({
          status: 'site_visit_done',
          updatedAt: new Date(),
        })
        .where(eq(leads.id, existing.leadId));

      // Create follow-up task on CRM pipeline
      const [taskAssignee] = existing.assignedAgentId
        ? [{ id: existing.assignedAgentId }]
        : lead?.assignedAgentId
          ? [{ id: lead.assignedAgentId }]
          : await db
              .select({ id: users.id })
              .from(users)
              .where(eq(users.companyId, companyId))
              .limit(1);

      if (taskAssignee) {
        await db.insert(tasks).values({
          companyId,
          leadId: existing.leadId,
          assignedUserId: taskAssignee.id,
          type: 'follow_up',
          title: 'Post-Visit Feedback & Unit Shortlist Follow-Up',
          description: 'Customer completed site visit. Reach out for feedback, negotiation interest, and token booking.',
          dueDate: new Date(Date.now() + 48 * 3600 * 1000), // Due in 48h
          priority: 'high',
          status: 'pending',
        });
      }

      if (lead) {
        await db.insert(leadActivities).values({
          companyId,
          leadId: existing.leadId,
          contactId: lead.contactId,
          activityType: 'stage_changed',
          title: 'Site Visit Completed Successfully',
          metadata: { appointmentId: id },
        });
      }

      await db.insert(domainEvents).values({
        companyId,
        type: 'visit_changed',
        payload: { appointmentId: id, action: 'completed' },
      });

      return this.getAppointmentById(companyId, id);
    }

    // Default status update (e.g. confirmed)
    await db
      .update(appointments)
      .set({
        status: input.status,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, id));

    if (lead) {
      await db.insert(leadActivities).values({
        companyId,
        leadId: existing.leadId,
        contactId: lead.contactId,
        activityType: 'stage_changed',
        title: `Site Visit Status Changed to ${input.status}`,
        metadata: { appointmentId: id, status: input.status },
      });
    }

    await db.insert(domainEvents).values({
      companyId,
      type: 'visit_changed',
      payload: { appointmentId: id, status: input.status },
    });

    return this.getAppointmentById(companyId, id);
  }

  /**
   * Public chat booking tool invoked by the web chatbot widget.
   */
  async bookVisitFromChat(
    chatbotId: string,
    input: BookVisitChatInput,
  ): Promise<{
    appointmentId: string;
    scheduledAt: string;
    leadId: string;
    surveyToken: string | null;
    confirmationMessage: string;
  }> {
    // 1. Resolve chatbot & company
    const [bot] = await db
      .select({
        id: chatbots.id,
        companyId: chatbots.companyId,
        name: chatbots.name,
      })
      .from(chatbots)
      .where(eq(chatbots.id, chatbotId));

    if (!bot) {
      const err = new Error('Chatbot not found');
      Object.assign(err, { statusCode: 404 });
      throw err;
    }

    const companyId = bot.companyId;

    // 2. Capture or find lead using existing Lead Service
    const leadCapture = await leadsService.captureOrUpdateLead(companyId, {
      name: input.visitorName,
      phone: input.visitorPhone,
      email: input.visitorEmail || undefined,
      chatbotId,
      conversationId: input.conversationId,
      metadata: { source: 'chat' },
    });

    const leadId = leadCapture.lead.id;

    // 3. Create appointment
    const appointment = await this.createAppointment(companyId, {
      leadId,
      projectId: input.projectId,
      scheduledAt: input.scheduledAt,
      notes: input.notes,
      appointmentType: 'site_visit',
    });

    const formattedDate = new Date(input.scheduledAt).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const confirmationMessage = `Your site visit has been scheduled for ${formattedDate}. Our dedicated property advisor will assist you at the project gallery. A confirmation reminder will be sent prior to the visit.`;

    return {
      appointmentId: appointment.id,
      scheduledAt: appointment.scheduledAt,
      leadId,
      surveyToken: appointment.surveyToken || null,
      confirmationMessage,
    };
  }
}

export const appointmentsService = new AppointmentsService();
