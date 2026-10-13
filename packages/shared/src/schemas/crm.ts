import { z } from 'zod';
import { leadStatusEnum, leadPriorityEnum, intentLabelEnum, leadItemResponseSchema } from './leads.js';

// Task Enums
export const taskTypeEnum = z.enum([
  'follow_up',
  'call',
  'whatsapp',
  'site_visit',
  'email',
  'document',
]);
export type TaskType = z.infer<typeof taskTypeEnum>;

export const taskStatusEnum = z.enum(['pending', 'completed', 'cancelled']);
export type TaskStatus = z.infer<typeof taskStatusEnum>;

// Assignment Schemas
export const assignLeadInputSchema = z.object({
  agentId: z.string().uuid(),
  reason: z.string().optional(),
});
export type AssignLeadInput = z.infer<typeof assignLeadInputSchema>;

export const bulkAssignInputSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1, 'At least one lead must be selected'),
  agentId: z.string().uuid(),
});
export type BulkAssignInput = z.infer<typeof bulkAssignInputSchema>;

export const bulkStatusInputSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1, 'At least one lead must be selected'),
  status: leadStatusEnum,
  lostReason: z.string().optional(),
});
export type BulkStatusInput = z.infer<typeof bulkStatusInputSchema>;

export const bulkTagInputSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1, 'At least one lead must be selected'),
  tags: z.array(z.string()).min(1, 'At least one tag must be specified'),
});
export type BulkTagInput = z.infer<typeof bulkTagInputSchema>;

// Notes Schemas
export const createNoteInputSchema = z.object({
  content: z.string().min(1, 'Note content cannot be empty').max(5000),
});
export type CreateNoteInput = z.infer<typeof createNoteInputSchema>;

export const noteItemSchema = z.object({
  id: z.string().uuid(),
  leadId: z.string().uuid(),
  userId: z.string().uuid(),
  userName: z.string(),
  userRole: z.string(),
  content: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type NoteItem = z.infer<typeof noteItemSchema>;

// Tasks Schemas
export const createTaskInputSchema = z.object({
  leadId: z.string().uuid(),
  assignedUserId: z.string().uuid().optional(),
  title: z.string().min(1, 'Task title is required').max(255),
  type: taskTypeEnum.default('follow_up'),
  dueDate: z.string().datetime({ offset: true }),
  priority: leadPriorityEnum.default('medium'),
  description: z.string().max(2000).optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;

export const updateTaskInputSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  type: taskTypeEnum.optional(),
  dueDate: z.string().datetime({ offset: true }).optional(),
  status: taskStatusEnum.optional(),
  priority: leadPriorityEnum.optional(),
  description: z.string().max(2000).optional(),
  assignedUserId: z.string().uuid().optional(),
});
export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>;

export const taskItemSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  leadId: z.string().uuid(),
  leadName: z.string().optional(),
  leadPhone: z.string().optional(),
  assignedUserId: z.string().uuid(),
  assignedUserName: z.string().optional(),
  title: z.string(),
  type: taskTypeEnum,
  dueDate: z.string(),
  status: taskStatusEnum,
  priority: leadPriorityEnum,
  description: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  isOverdue: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TaskItem = z.infer<typeof taskItemSchema>;

export const tasksListResponseSchema = z.object({
  items: z.array(taskItemSchema),
  total: z.number(),
  pendingCount: z.number(),
  overdueCount: z.number(),
  todayCount: z.number(),
});
export type TasksListResponse = z.infer<typeof tasksListResponseSchema>;

// Visitor Timeline Schemas
export const timelineActivityTypeEnum = z.enum([
  'page_view',
  'chat_message',
  'lead_captured',
  'status_changed',
  'intent_changed',
  'lead_assigned',
  'note_added',
  'task_created',
  'task_completed',
  'call_logged',
  'brochure_opened',
  'shortlist_room_viewed',
  'lead_merged',
]);
export type TimelineActivityType = z.infer<typeof timelineActivityTypeEnum>;

export const visitorTimelineItemSchema = z.object({
  id: z.string().uuid(),
  activityType: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.string(),
});
export type VisitorTimelineItem = z.infer<typeof visitorTimelineItemSchema>;

export const visitorTimelineResponseSchema = z.object({
  items: z.array(visitorTimelineItemSchema),
  total: z.number(),
});
export type VisitorTimelineResponse = z.infer<typeof visitorTimelineResponseSchema>;

// Kanban Pipeline Schemas
export const kanbanColumnSchema = z.object({
  id: leadStatusEnum,
  title: z.string(),
  leads: z.array(leadItemResponseSchema),
  count: z.number(),
});
export type KanbanColumn = z.infer<typeof kanbanColumnSchema>;

export const kanbanBoardResponseSchema = z.object({
  columns: z.array(kanbanColumnSchema),
  totalLeads: z.number(),
});
export type KanbanBoardResponse = z.infer<typeof kanbanBoardResponseSchema>;

// Contacts & Organizations Schemas
export const contactItemSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  organizationId: z.string().uuid().nullable().optional(),
  organizationName: z.string().nullable().optional(),
  firstName: z.string(),
  lastName: z.string().nullable().optional(),
  name: z.string(),
  email: z.string().nullable().optional(),
  phone: z.string(),
  altPhone: z.string().nullable().optional(),
  lifecycleStage: z.string(),
  leadCount: z.number().default(0),
  lastActiveAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ContactItem = z.infer<typeof contactItemSchema>;

export const contactsListResponseSchema = z.object({
  items: z.array(contactItemSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});
export type ContactsListResponse = z.infer<typeof contactsListResponseSchema>;

export const createContactInputSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().max(100).optional(),
  phone: z.string().min(7, 'Phone number is required').max(50),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  altPhone: z.string().max(50).optional(),
  organizationId: z.string().uuid().optional(),
});
export type CreateContactInput = z.infer<typeof createContactInputSchema>;

export const mergeContactsInputSchema = z.object({
  sourceContactId: z.string().uuid(),
  targetContactId: z.string().uuid(),
});
export type MergeContactsInput = z.infer<typeof mergeContactsInputSchema>;

export const organizationItemSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  name: z.string(),
  industry: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  contactsCount: z.number().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type OrganizationItem = z.infer<typeof organizationItemSchema>;

export const organizationsListResponseSchema = z.object({
  items: z.array(organizationItemSchema),
  total: z.number(),
});
export type OrganizationsListResponse = z.infer<typeof organizationsListResponseSchema>;

export const createOrganizationInputSchema = z.object({
  name: z.string().min(1, 'Organization name is required').max(255),
  industry: z.string().max(100).optional(),
  website: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  address: z.string().optional(),
});
export type CreateOrganizationInput = z.infer<typeof createOrganizationInputSchema>;

// Export Leads Schema
export const exportLeadsInputSchema = z.object({
  format: z.enum(['csv', 'xlsx']).default('csv'),
  columns: z
    .array(z.string())
    .default(['name', 'phone', 'email', 'status', 'intentScore', 'priority', 'source', 'createdAt']),
  status: z.string().optional(),
  priority: z.string().optional(),
  intentLabel: intentLabelEnum.optional(),
  search: z.string().optional(),
  leadIds: z.array(z.string().uuid()).optional(),
});
export type ExportLeadsInput = z.infer<typeof exportLeadsInputSchema>;

// CRM Reporting Schema
export const agentLeaderboardItemSchema = z.object({
  agentId: z.string().uuid(),
  agentName: z.string(),
  agentEmail: z.string(),
  leadsAssigned: z.number(),
  leadsContacted: z.number(),
  leadsQualified: z.number(),
  leadsConverted: z.number(),
  conversionRate: z.number(),
  avgResponseTimeMinutes: z.number(),
});
export type AgentLeaderboardItem = z.infer<typeof agentLeaderboardItemSchema>;

export const crmReportsResponseSchema = z.object({
  totalLeads: z.number(),
  newLeads: z.number(),
  qualifiedLeads: z.number(),
  convertedLeads: z.number(),
  overallConversionRate: z.number(),
  avgResponseTimeMinutes: z.number(),
  leaderboard: z.array(agentLeaderboardItemSchema),
  conversionBySource: z.record(z.object({ total: z.number(), converted: z.number(), rate: z.number() })),
  lostReasons: z.array(z.object({ reason: z.string(), count: z.number(), percentage: z.number() })),
});
export type CrmReportsResponse = z.infer<typeof crmReportsResponseSchema>;
