import { eq, and, sql, asc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { tasks, users, leads, contacts, leadActivities } from '../../db/schema/index.js';
import type {
  CreateTaskInput,
  UpdateTaskInput,
  TaskItem,
  TasksListResponse,
  TaskType,
  TaskStatus,
  LeadPriority,
} from '@propbot/shared';

export class TasksService {
  /**
   * Recalculates the nearest upcoming pending task due date for a lead.
   */
  async recalculateLeadNextFollowUp(companyId: string, leadId: string): Promise<void> {
    const nextTask = await db.query.tasks.findFirst({
      where: and(
        eq(tasks.companyId, companyId),
        eq(tasks.leadId, leadId),
        eq(tasks.status, 'pending'),
      ),
      orderBy: asc(tasks.dueDate),
    });

    await db
      .update(leads)
      .set({
        nextFollowUpAt: nextTask ? nextTask.dueDate : null,
        updatedAt: new Date(),
      })
      .where(and(eq(leads.id, leadId), eq(leads.companyId, companyId)));
  }

  /**
   * Lists tasks with rich filters ("My Day", overdue, status, leadId, assignedUser).
   */
  async listTasks(
    companyId: string,
    options: {
      leadId?: string;
      assignedUserId?: string;
      status?: string;
      myDay?: boolean;
      overdue?: boolean;
    } = {},
  ): Promise<TasksListResponse> {
    const now = new Date();
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const conditions = [eq(tasks.companyId, companyId)];

    if (options.leadId) {
      conditions.push(eq(tasks.leadId, options.leadId));
    }
    if (options.assignedUserId) {
      conditions.push(eq(tasks.assignedUserId, options.assignedUserId));
    }
    if (options.status && options.status !== 'all') {
      conditions.push(eq(tasks.status, options.status));
    }
    if (options.myDay) {
      conditions.push(eq(tasks.status, 'pending'));
      conditions.push(sql`${tasks.dueDate} <= ${endOfToday}`);
    }
    if (options.overdue) {
      conditions.push(eq(tasks.status, 'pending'));
      conditions.push(sql`${tasks.dueDate} < ${now}`);
    }

    const rows = await db
      .select({
        task: tasks,
        assignee: users,
        lead: leads,
        contact: contacts,
      })
      .from(tasks)
      .leftJoin(users, eq(tasks.assignedUserId, users.id))
      .leftJoin(leads, eq(tasks.leadId, leads.id))
      .leftJoin(contacts, eq(leads.contactId, contacts.id))
      .where(and(...conditions))
      .orderBy(asc(tasks.dueDate));

    let pendingCount = 0;
    let overdueCount = 0;
    let todayCount = 0;

    const items: TaskItem[] = rows.map(({ task, assignee, contact }) => {
      const isPending = task.status === 'pending';
      const isOverdue = isPending && task.dueDate < now;
      const isDueToday = isPending && task.dueDate <= endOfToday && task.dueDate >= new Date(new Date().setHours(0, 0, 0, 0));

      if (isPending) pendingCount++;
      if (isOverdue) overdueCount++;
      if (isDueToday) todayCount++;

      const leadName = contact
        ? `${contact.firstName} ${contact.lastName || ''}`.trim()
        : 'Prospect';

      return {
        id: task.id,
        companyId: task.companyId,
        leadId: task.leadId,
        leadName,
        leadPhone: contact?.phone,
        assignedUserId: task.assignedUserId,
        assignedUserName: assignee?.name || 'Agent',
        title: task.title,
        type: task.type as TaskType,
        dueDate: task.dueDate.toISOString(),
        status: task.status as TaskStatus,
        priority: task.priority as LeadPriority,
        description: task.description,
        completedAt: task.completedAt ? task.completedAt.toISOString() : null,
        isOverdue,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      };
    });

    return {
      items,
      total: items.length,
      pendingCount,
      overdueCount,
      todayCount,
    };
  }

  /**
   * Creates a new task and logs activity.
   */
  async createTask(companyId: string, input: CreateTaskInput, createdBy?: string): Promise<TaskItem> {
    const lead = await db.query.leads.findFirst({
      where: and(eq(leads.id, input.leadId), eq(leads.companyId, companyId)),
    });

    if (!lead) {
      throw new Error('Lead not found');
    }

    const assignedUserId = input.assignedUserId || lead.assignedAgentId || createdBy;
    if (!assignedUserId) {
      throw new Error('Assigned user must be specified');
    }

    const [newTask] = await db
      .insert(tasks)
      .values({
        companyId,
        leadId: input.leadId,
        assignedUserId,
        title: input.title,
        type: input.type,
        dueDate: new Date(input.dueDate),
        priority: input.priority,
        description: input.description,
        status: 'pending',
      })
      .returning();

    if (!newTask) {
      throw new Error('Failed to create task');
    }

    // Recalculate lead's next follow-up date
    await this.recalculateLeadNextFollowUp(companyId, input.leadId);

    // Record activity
    await db.insert(leadActivities).values({
      companyId,
      leadId: input.leadId,
      contactId: lead.contactId,
      activityType: 'task_created',
      title: `Task Scheduled: ${newTask.title}`,
      description: `Due on ${new Date(input.dueDate).toLocaleString()} (${newTask.type})`,
      metadata: { taskId: newTask.id, assignedUserId, type: newTask.type },
    });

    const assignee = await db.query.users.findFirst({
      where: eq(users.id, assignedUserId),
    });

    const contact = await db.query.contacts.findFirst({
      where: eq(contacts.id, lead.contactId),
    });

    const leadName = contact
      ? `${contact.firstName} ${contact.lastName || ''}`.trim()
      : 'Prospect';

    return {
      id: newTask.id,
      companyId: newTask.companyId,
      leadId: newTask.leadId,
      leadName,
      leadPhone: contact?.phone,
      assignedUserId: newTask.assignedUserId,
      assignedUserName: assignee?.name || 'Agent',
      title: newTask.title,
      type: newTask.type as TaskType,
      dueDate: newTask.dueDate.toISOString(),
      status: newTask.status as TaskStatus,
      priority: newTask.priority as LeadPriority,
      description: newTask.description,
      completedAt: null,
      isOverdue: false,
      createdAt: newTask.createdAt.toISOString(),
      updatedAt: newTask.updatedAt.toISOString(),
    };
  }

  /**
   * Updates an existing task (or marks complete).
   */
  async updateTask(
    companyId: string,
    taskId: string,
    input: UpdateTaskInput,
    userId?: string,
  ): Promise<TaskItem> {
    const existing = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, taskId), eq(tasks.companyId, companyId)),
    });

    if (!existing) {
      const err = new Error('Task not found');
      Object.assign(err, { statusCode: 400 });
      throw err;
    }

    const completedAt = input.status === 'completed' && existing.status !== 'completed'
      ? new Date()
      : input.status && input.status !== 'completed'
        ? null
        : existing.completedAt;

    await db
      .update(tasks)
      .set({
        title: input.title ?? existing.title,
        type: input.type ?? existing.type,
        dueDate: input.dueDate ? new Date(input.dueDate) : existing.dueDate,
        status: input.status ?? existing.status,
        priority: input.priority ?? existing.priority,
        description: input.description ?? existing.description,
        assignedUserId: input.assignedUserId ?? existing.assignedUserId,
        completedAt,
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.id, taskId), eq(tasks.companyId, companyId)));

    // Recalculate lead follow-up date
    await this.recalculateLeadNextFollowUp(companyId, existing.leadId);

    // If marked completed, log activity
    if (input.status === 'completed' && existing.status !== 'completed') {
      const lead = await db.query.leads.findFirst({
        where: eq(leads.id, existing.leadId),
      });

      if (lead) {
        await db.insert(leadActivities).values({
          companyId,
          leadId: existing.leadId,
          contactId: lead.contactId,
          activityType: 'task_completed',
          title: `Task Completed: ${existing.title}`,
          description: `Marked completed by agent`,
          metadata: { taskId, completedBy: userId },
        });
      }
    }

    const updated = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    });

    if (!updated) {
      throw new Error('Task not found after update');
    }

    const assignee = await db.query.users.findFirst({
      where: eq(users.id, updated.assignedUserId),
    });

    const lead = await db.query.leads.findFirst({
      where: eq(leads.id, updated.leadId),
    });

    const contact = lead
      ? await db.query.contacts.findFirst({ where: eq(contacts.id, lead.contactId) })
      : null;

    const leadName = contact
      ? `${contact.firstName} ${contact.lastName || ''}`.trim()
      : 'Prospect';

    return {
      id: updated.id,
      companyId: updated.companyId,
      leadId: updated.leadId,
      leadName,
      leadPhone: contact?.phone,
      assignedUserId: updated.assignedUserId,
      assignedUserName: assignee?.name || 'Agent',
      title: updated.title,
      type: updated.type as TaskType,
      dueDate: updated.dueDate.toISOString(),
      status: updated.status as TaskStatus,
      priority: updated.priority as LeadPriority,
      description: updated.description,
      completedAt: updated.completedAt ? updated.completedAt.toISOString() : null,
      isOverdue: updated.status === 'pending' && updated.dueDate < new Date(),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Deletes a task.
   */
  async deleteTask(companyId: string, taskId: string): Promise<{ success: boolean }> {
    const existing = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, taskId), eq(tasks.companyId, companyId)),
    });

    if (!existing) {
      const err = new Error('Task not found');
      Object.assign(err, { statusCode: 400 });
      throw err;
    }

    await db.delete(tasks).where(and(eq(tasks.id, taskId), eq(tasks.companyId, companyId)));

    await this.recalculateLeadNextFollowUp(companyId, existing.leadId);

    return { success: true };
  }
}

export const tasksService = new TasksService();
