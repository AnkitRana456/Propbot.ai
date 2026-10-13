import { eq, and, sql, notInArray, gte, lte } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  appointments,
  availabilitySettings,
  users,
} from '../../db/schema/index.js';
import type {
  AvailableSlot,
  AvailableSlotsResponse,
  AvailabilitySettings,
} from '@propbot/shared';

const DEFAULT_SETTINGS: AvailabilitySettings = {
  workingDays: [1, 2, 3, 4, 5, 6], // Mon-Sat
  startTime: '09:00',
  endTime: '18:00',
  slotDurationMinutes: 45,
  bufferMinutes: 15,
  maxVisitsPerSlot: 1,
  blackoutDates: [],
};

export class AvailabilityService {
  /**
   * Retrieves availability settings for a company (with project/agent fallback).
   */
  async getAvailabilitySettings(
    companyId: string,
    agentId?: string,
    projectId?: string,
  ): Promise<AvailabilitySettings> {
    const conditions = [eq(availabilitySettings.companyId, companyId)];
    if (agentId) conditions.push(eq(availabilitySettings.agentId, agentId));
    if (projectId) conditions.push(eq(availabilitySettings.projectId, projectId));

    const [existing] = await db
      .select()
      .from(availabilitySettings)
      .where(and(...conditions))
      .limit(1);

    if (!existing) {
      return DEFAULT_SETTINGS;
    }

    return {
      workingDays: (existing.workingDays as number[]) || DEFAULT_SETTINGS.workingDays,
      startTime: existing.startTime || DEFAULT_SETTINGS.startTime,
      endTime: existing.endTime || DEFAULT_SETTINGS.endTime,
      slotDurationMinutes: existing.slotDurationMinutes || DEFAULT_SETTINGS.slotDurationMinutes,
      bufferMinutes: existing.bufferMinutes ?? DEFAULT_SETTINGS.bufferMinutes,
      maxVisitsPerSlot: existing.maxVisitsPerSlot || DEFAULT_SETTINGS.maxVisitsPerSlot,
      blackoutDates: (existing.blackoutDates as string[]) || DEFAULT_SETTINGS.blackoutDates,
    };
  }

  /**
   * Updates or inserts availability settings.
   */
  async updateAvailabilitySettings(
    companyId: string,
    input: Partial<AvailabilitySettings>,
    agentId?: string,
    projectId?: string,
  ): Promise<AvailabilitySettings> {
    const current = await this.getAvailabilitySettings(companyId, agentId, projectId);
    const updated: AvailabilitySettings = {
      ...current,
      ...input,
    };

    const conditions = [eq(availabilitySettings.companyId, companyId)];
    if (agentId) conditions.push(eq(availabilitySettings.agentId, agentId));
    if (projectId) conditions.push(eq(availabilitySettings.projectId, projectId));

    const [existing] = await db
      .select()
      .from(availabilitySettings)
      .where(and(...conditions))
      .limit(1);

    if (existing) {
      await db
        .update(availabilitySettings)
        .set({
          workingDays: updated.workingDays,
          startTime: updated.startTime,
          endTime: updated.endTime,
          slotDurationMinutes: updated.slotDurationMinutes,
          bufferMinutes: updated.bufferMinutes,
          maxVisitsPerSlot: updated.maxVisitsPerSlot,
          blackoutDates: updated.blackoutDates,
          updatedAt: new Date(),
        })
        .where(eq(availabilitySettings.id, existing.id));
    } else {
      await db.insert(availabilitySettings).values({
        companyId,
        agentId: agentId || null,
        projectId: projectId || null,
        workingDays: updated.workingDays,
        startTime: updated.startTime,
        endTime: updated.endTime,
        slotDurationMinutes: updated.slotDurationMinutes,
        bufferMinutes: updated.bufferMinutes,
        maxVisitsPerSlot: updated.maxVisitsPerSlot,
        blackoutDates: updated.blackoutDates,
      });
    }

    return updated;
  }

  /**
   * Generates open/booked slots for a specific date (YYYY-MM-DD).
   */
  async getAvailableSlots(
    companyId: string,
    dateStr: string,
    projectId?: string,
    agentId?: string,
  ): Promise<AvailableSlotsResponse> {
    const settings = await this.getAvailabilitySettings(companyId, agentId, projectId);

    // Validate date format
    const targetDate = new Date(`${dateStr}T00:00:00.000Z`);
    if (isNaN(targetDate.getTime())) {
      throw new Error('Invalid date format. Expected YYYY-MM-DD');
    }

    // Check blackout dates
    if (settings.blackoutDates.includes(dateStr)) {
      return { date: dateStr, slots: [] };
    }

    // Check working days (0 = Sunday, 1 = Monday ... 6 = Saturday)
    const dayOfWeek = targetDate.getUTCDay();
    if (!settings.workingDays.includes(dayOfWeek)) {
      return { date: dateStr, slots: [] };
    }

    // Parse start and end times
    const [startH = 9, startM = 0] = (settings.startTime || '09:00').split(':').map(Number);
    const [endH = 18, endM = 0] = (settings.endTime || '18:00').split(':').map(Number);

    const stepMinutes = settings.slotDurationMinutes + settings.bufferMinutes;

    // Fetch existing appointments for that entire day
    const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
    const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);

    const existingAppointments = await db
      .select({
        id: appointments.id,
        scheduledAt: appointments.scheduledAt,
        status: appointments.status,
        assignedAgentId: appointments.assignedAgentId,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.companyId, companyId),
          gte(appointments.scheduledAt, dayStart),
          lte(appointments.scheduledAt, dayEnd),
          notInArray(appointments.status, ['cancelled', 'rescheduled']),
        ),
      );

    const slots: AvailableSlot[] = [];
    let currentTotalMinutes = startH * 60 + startM;
    const endTotalMinutes = endH * 60 + endM;

    while (currentTotalMinutes + settings.slotDurationMinutes <= endTotalMinutes) {
      const h = Math.floor(currentTotalMinutes / 60);
      const m = currentTotalMinutes % 60;
      const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const slotDatetime = new Date(`${dateStr}T${timeStr}:00.000Z`);

      // Count booked appointments matching this exact slot
      const overlapping = existingAppointments.filter(app => {
        const diffMs = Math.abs(app.scheduledAt.getTime() - slotDatetime.getTime());
        // Slot matches if within 5 minutes tolerance
        if (diffMs < 5 * 60 * 1000) {
          if (agentId) {
            return app.assignedAgentId === agentId;
          }
          return true;
        }
        return false;
      });

      const isAvailable = overlapping.length < settings.maxVisitsPerSlot;

      slots.push({
        time: timeStr,
        datetime: slotDatetime.toISOString(),
        available: isAvailable,
        agentId: agentId || undefined,
      });

      currentTotalMinutes += stepMinutes;
    }

    return { date: dateStr, slots };
  }

  /**
   * Finds an available agent using round-robin allocation among eligible agents.
   */
  async findAvailableAgent(companyId: string, scheduledAt: Date): Promise<string | null> {
    // 1. Get all active agents in this company
    const activeAgents = await db
      .select({
        id: users.id,
        name: users.name,
      })
      .from(users)
      .where(
        and(
          eq(users.companyId, companyId),
          eq(users.status, 'active'),
          notInArray(users.role, ['viewer']),
        ),
      );

    if (activeAgents.length === 0) {
      return null;
    }

    // 2. Filter out agents with overlapping appointments at that exact time
    const slotStart = new Date(scheduledAt.getTime() - 30 * 60 * 1000);
    const slotEnd = new Date(scheduledAt.getTime() + 30 * 60 * 1000);

    const busyAppointments = await db
      .select({
        assignedAgentId: appointments.assignedAgentId,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.companyId, companyId),
          gte(appointments.scheduledAt, slotStart),
          lte(appointments.scheduledAt, slotEnd),
          notInArray(appointments.status, ['cancelled', 'rescheduled']),
        ),
      );

    const busyAgentIds = new Set(
      busyAppointments.map(b => b.assignedAgentId).filter((id): id is string => Boolean(id)),
    );

    const freeAgents = activeAgents.filter(agent => !busyAgentIds.has(agent.id));
    if (freeAgents.length === 0) {
      // If all are busy, return the first active agent as fallback
      return activeAgents[0]?.id || null;
    }

    // 3. Round-robin: pick the free agent with the lowest number of scheduled appointments
    const agentWorkloads = await db
      .select({
        agentId: appointments.assignedAgentId,
        count: sql<number>`count(*)::int`,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.companyId, companyId),
          notInArray(appointments.status, ['cancelled', 'completed', 'no_show']),
        ),
      )
      .groupBy(appointments.assignedAgentId);

    const workloadMap = new Map<string, number>();
    for (const w of agentWorkloads) {
      if (w.agentId) workloadMap.set(w.agentId, Number(w.count));
    }

    freeAgents.sort((a, b) => (workloadMap.get(a.id) || 0) - (workloadMap.get(b.id) || 0));

    return freeAgents[0]?.id || null;
  }
}

export const availabilityService = new AvailabilityService();
