import { eq, and, gte, lte, inArray } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  appointments,
  leads,
  users,
  tasks,
  leadActivities,
  domainEvents,
} from '../../db/schema/index.js';
import type { AppointmentSurveyInput, ScoreHistoryItem } from '@propbot/shared';

export class AppointmentReminderService {

  /**
   * Periodic sweep executing 24h and 2h reminder dispatches.
   */
  async sweepAndSendReminders(): Promise<{ sent24hCount: number; sent2hCount: number }> {
    const now = new Date();

    // 24-hour reminder window: between now + 23 hours and now + 25 hours
    const start24h = new Date(now.getTime() + 23 * 3600 * 1000);
    const end24h = new Date(now.getTime() + 25 * 3600 * 1000);

    const pending24h = await db
      .select({
        appointment: appointments,
        lead: leads,
      })
      .from(appointments)
      .leftJoin(leads, eq(appointments.leadId, leads.id))
      .where(
        and(
          inArray(appointments.status, ['scheduled', 'confirmed']),
          gte(appointments.scheduledAt, start24h),
          lte(appointments.scheduledAt, end24h),
          eq(appointments.reminderSent24h, false),
        ),
      );

    let sent24hCount = 0;
    for (const item of pending24h) {
      await db
        .update(appointments)
        .set({
          reminderSent24h: true,
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, item.appointment.id));

      if (item.lead) {
        await db.insert(leadActivities).values({
          companyId: item.appointment.companyId,
          leadId: item.lead.id,
          contactId: item.lead.contactId,
          activityType: 'task_created',
          title: '24h Appointment Reminder Dispatched',
          metadata: {
            appointmentId: item.appointment.id,
            scheduledAt: item.appointment.scheduledAt.toISOString(),
          },
        });
      }

      await db.insert(domainEvents).values({
        companyId: item.appointment.companyId,
        type: 'reminder_sent',
        payload: {
          window: '24h',
          appointmentId: item.appointment.id,
          scheduledAt: item.appointment.scheduledAt.toISOString(),
        },
      });

      sent24hCount++;
    }

    // 2-hour reminder window: between now + 1 hour 45 min and now + 2 hours 15 min
    const start2h = new Date(now.getTime() + (1 * 3600 + 45 * 60) * 1000);
    const end2h = new Date(now.getTime() + (2 * 3600 + 15 * 60) * 1000);

    const pending2h = await db
      .select({
        appointment: appointments,
        lead: leads,
      })
      .from(appointments)
      .leftJoin(leads, eq(appointments.leadId, leads.id))
      .where(
        and(
          inArray(appointments.status, ['scheduled', 'confirmed']),
          gte(appointments.scheduledAt, start2h),
          lte(appointments.scheduledAt, end2h),
          eq(appointments.reminderSent2h, false),
        ),
      );

    let sent2hCount = 0;
    for (const item of pending2h) {
      await db
        .update(appointments)
        .set({
          reminderSent2h: true,
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, item.appointment.id));

      if (item.lead) {
        await db.insert(leadActivities).values({
          companyId: item.appointment.companyId,
          leadId: item.lead.id,
          contactId: item.lead.contactId,
          activityType: 'task_created',
          title: '2h Appointment Reminder Dispatched (Day-of "On My Way")',
          metadata: {
            appointmentId: item.appointment.id,
            scheduledAt: item.appointment.scheduledAt.toISOString(),
            location: item.appointment.location,
          },
        });
      }

      await db.insert(domainEvents).values({
        companyId: item.appointment.companyId,
        type: 'reminder_sent',
        payload: {
          window: '2h',
          appointmentId: item.appointment.id,
          scheduledAt: item.appointment.scheduledAt.toISOString(),
        },
      });

      sent2hCount++;
    }

    return { sent24hCount, sent2hCount };
  }

  /**
   * Handles no-show recovery: marks appointment no-show and auto-schedules rebooking follow-up task.
   */
  async handleNoShow(companyId: string, appointmentId: string): Promise<void> {
    const [appointment] = await db
      .select()
      .from(appointments)
      .where(and(eq(appointments.id, appointmentId), eq(appointments.companyId, companyId)));

    if (!appointment) return;

    const [lead] = await db
      .select({ contactId: leads.contactId })
      .from(leads)
      .where(eq(leads.id, appointment.leadId));

    // 1. Update appointment status
    await db
      .update(appointments)
      .set({
        status: 'no_show',
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, appointment.id));

    // 2. Log activity
    if (lead) {
      await db.insert(leadActivities).values({
        companyId,
        leadId: appointment.leadId,
        contactId: lead.contactId,
        activityType: 'stage_changed',
        title: 'Site Visit Missed (No-Show)',
        metadata: {
          appointmentId: appointment.id,
          scheduledAt: appointment.scheduledAt.toISOString(),
        },
      });
    }

    // 3. Create follow-up task on CRM pipeline
    const [assignedUser] = appointment.assignedAgentId
      ? [{ id: appointment.assignedAgentId }]
      : await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.companyId, companyId))
          .limit(1);

    if (assignedUser) {
      await db.insert(tasks).values({
        companyId,
        leadId: appointment.leadId,
        assignedUserId: assignedUser.id,
        type: 'call',
        title: 'Follow Up on Missed Site Visit (Rebook)',
        description: 'Visitor did not attend scheduled viewing. Call to understand delay and offer rebooking slot.',
        dueDate: new Date(Date.now() + 24 * 3600 * 1000), // Due in 24h
        priority: 'high',
        status: 'pending',
      });
    }

    // 4. Emit domain event
    await db.insert(domainEvents).values({
      companyId,
      type: 'visit_changed',
      payload: {
        appointmentId: appointment.id,
        status: 'no_show',
        leadId: appointment.leadId,
      },
    });
  }

  /**
   * Submits post-visit survey and elevates lead intent score.
   */
  async submitSurvey(
    surveyToken: string,
    input: AppointmentSurveyInput,
  ): Promise<{ success: boolean; leadId: string }> {
    const [appointment] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.surveyToken, surveyToken));

    if (!appointment) {
      const err = new Error('Invalid or expired survey link');
      Object.assign(err, { statusCode: 404 });
      throw err;
    }

    const [lead] = await db
      .select({ contactId: leads.contactId })
      .from(leads)
      .where(eq(leads.id, appointment.leadId));

    // Update appointment survey fields
    await db
      .update(appointments)
      .set({
        surveyRating: input.rating,
        surveyFeedback: input.feedback || null,
        surveyInterestedInBooking: input.interestedInBooking,
        surveyCompletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, appointment.id));

    // Log survey activity on visitor timeline
    if (lead) {
      await db.insert(leadActivities).values({
        companyId: appointment.companyId,
        leadId: appointment.leadId,
        contactId: lead.contactId,
        activityType: 'chat_message',
        title: `Post-Visit Survey Completed (${input.rating}/5 Stars)`,
        metadata: {
          rating: input.rating,
          feedback: input.feedback,
          interestedInBooking: input.interestedInBooking,
          appointmentId: appointment.id,
        },
      });
    }

    // Emit domain event
    await db.insert(domainEvents).values({
      companyId: appointment.companyId,
      type: 'visit_changed',
      payload: {
        appointmentId: appointment.id,
        surveyRating: input.rating,
        interestedInBooking: input.interestedInBooking,
      },
    });

    // Intent Score boost: +15 if interested in booking, +5 otherwise
    const points = input.interestedInBooking === 'yes' ? 15 : 5;
    const [currentLead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, appointment.leadId), eq(leads.companyId, appointment.companyId)));

    if (currentLead) {
      const newScore = Math.min(100, (currentLead.intentScore || 0) + points);
      const newLabel = newScore >= 70 ? 'hot' : newScore >= 35 ? 'warm' : 'cold';
      const history = (currentLead.scoreHistory as ScoreHistoryItem[]) || [];
      history.push({
        score: newScore,
        delta: points,
        reason: 'Post-visit survey completed',
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
        .where(eq(leads.id, appointment.leadId));
    }

    // If interested in booking === 'yes', suggest or move lead to negotiation stage
    if (input.interestedInBooking === 'yes') {
      await db
        .update(leads)
        .set({
          status: 'negotiation',
          updatedAt: new Date(),
        })
        .where(eq(leads.id, appointment.leadId));
    }

    return { success: true, leadId: appointment.leadId };
  }
}

export const appointmentReminderService = new AppointmentReminderService();
