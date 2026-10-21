import { relations } from 'drizzle-orm';
import { companies, companyAiSettings, apiKeys } from './companies.js';
import { users, userInvitations } from './users.js';
import { organizations } from './organizations.js';
import { contacts } from './contacts.js';
import { chatbots } from './chatbots.js';
import { knowledgeSources, knowledgeChunks } from './knowledge.js';
import { conversations, messages } from './conversations.js';
import { leads, leadActivities, notes, tasks } from './leads.js';
import { projects, units, brochures, shortlistRooms, shortlistItems } from './properties.js';
import { appointments } from './appointments.js';
import { webhookEndpoints, webhookLogs, integrations } from './webhooks.js';
import { subscriptions, subscriptionInvoices, leadCreditTransactions } from './subscriptions.js';
import { auditLogs, notifications } from './audit.js';
import { domainEvents } from './events.js';
import { agentActions } from './actions.js';
import { whatsappConfigs, whatsappInboundEvents, whatsappCampaigns } from './whatsapp.js';

// Table Exports
export * from './companies.js';
export * from './users.js';
export * from './organizations.js';
export * from './contacts.js';
export * from './chatbots.js';
export * from './knowledge.js';
export * from './conversations.js';
export * from './leads.js';
export * from './properties.js';
export * from './appointments.js';
export * from './webhooks.js';
export * from './subscriptions.js';
export * from './audit.js';
export * from './events.js';
export * from './delivery-jobs.js';
export * from './agents.js';
export * from './actions.js';
export * from './auth-tokens.js';
export * from './whatsapp.js';
export * from './analytics.js';
export * from './playbooks.js';
export * from './re-engagement.js';
export * from './checkpoints.js';
export * from './workflows.js';
export * from './growth.js';
export * from './voice.js';
export * from './enterprise.js';

// ==========================================
// Relations Definitions
// ==========================================

export const companiesRelations = relations(companies, ({ one, many }) => ({
  aiSettings: one(companyAiSettings, {
    fields: [companies.id],
    references: [companyAiSettings.companyId],
  }),
  subscription: one(subscriptions, {
    fields: [companies.id],
    references: [subscriptions.companyId],
  }),
  users: many(users),
  organizations: many(organizations),
  contacts: many(contacts),
  chatbots: many(chatbots),
  leads: many(leads),
  projects: many(projects),
  domainEvents: many(domainEvents),
  agentActions: many(agentActions),
}));

export const companyAiSettingsRelations = relations(companyAiSettings, ({ one }) => ({
  company: one(companies, {
    fields: [companyAiSettings.companyId],
    references: [companies.id],
  }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id],
  }),
  assignedLeads: many(leads),
  assignedTasks: many(tasks),
  notes: many(notes),
  approvedActions: many(agentActions),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  company: one(companies, {
    fields: [contacts.companyId],
    references: [companies.id],
  }),
  organization: one(organizations, {
    fields: [contacts.organizationId],
    references: [organizations.id],
  }),
  leads: many(leads),
  conversations: many(conversations),
  activities: many(leadActivities),
}));

export const chatbotsRelations = relations(chatbots, ({ one, many }) => ({
  company: one(companies, {
    fields: [chatbots.companyId],
    references: [companies.id],
  }),
  knowledgeSources: many(knowledgeSources),
  conversations: many(conversations),
  leads: many(leads),
}));

export const knowledgeSourcesRelations = relations(knowledgeSources, ({ one, many }) => ({
  company: one(companies, {
    fields: [knowledgeSources.companyId],
    references: [companies.id],
  }),
  chatbot: one(chatbots, {
    fields: [knowledgeSources.chatbotId],
    references: [chatbots.id],
  }),
  chunks: many(knowledgeChunks),
}));

export const knowledgeChunksRelations = relations(knowledgeChunks, ({ one }) => ({
  source: one(knowledgeSources, {
    fields: [knowledgeChunks.sourceId],
    references: [knowledgeSources.id],
  }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  company: one(companies, {
    fields: [conversations.companyId],
    references: [companies.id],
  }),
  chatbot: one(chatbots, {
    fields: [conversations.chatbotId],
    references: [chatbots.id],
  }),
  contact: one(contacts, {
    fields: [conversations.contactId],
    references: [contacts.id],
  }),
  lead: one(leads, {
    fields: [conversations.leadId],
    references: [leads.id],
  }),
  assignedAgent: one(users, {
    fields: [conversations.assignedAgentId],
    references: [users.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  company: one(companies, {
    fields: [leads.companyId],
    references: [companies.id],
  }),
  contact: one(contacts, {
    fields: [leads.contactId],
    references: [contacts.id],
  }),
  chatbot: one(chatbots, {
    fields: [leads.chatbotId],
    references: [chatbots.id],
  }),
  assignedAgent: one(users, {
    fields: [leads.assignedAgentId],
    references: [users.id],
  }),
  conversations: many(conversations),
  activities: many(leadActivities),
  notes: many(notes),
  tasks: many(tasks),
  appointments: many(appointments),
  shortlistRooms: many(shortlistRooms),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  company: one(companies, {
    fields: [projects.companyId],
    references: [companies.id],
  }),
  units: many(units),
  brochures: many(brochures),
  appointments: many(appointments),
  shortlistItems: many(shortlistItems),
}));

export const unitsRelations = relations(units, ({ one }) => ({
  project: one(projects, {
    fields: [units.projectId],
    references: [projects.id],
  }),
}));

export const brochuresRelations = relations(brochures, ({ one }) => ({
  project: one(projects, {
    fields: [brochures.projectId],
    references: [projects.id],
  }),
}));

export const shortlistRoomsRelations = relations(shortlistRooms, ({ one, many }) => ({
  company: one(companies, {
    fields: [shortlistRooms.companyId],
    references: [companies.id],
  }),
  lead: one(leads, {
    fields: [shortlistRooms.leadId],
    references: [leads.id],
  }),
  favoriteProject: one(projects, {
    fields: [shortlistRooms.favoriteProjectId],
    references: [projects.id],
  }),
  items: many(shortlistItems),
}));

export const shortlistItemsRelations = relations(shortlistItems, ({ one }) => ({
  room: one(shortlistRooms, {
    fields: [shortlistItems.shortlistId],
    references: [shortlistRooms.id],
  }),
  project: one(projects, {
    fields: [shortlistItems.projectId],
    references: [projects.id],
  }),
  unit: one(units, {
    fields: [shortlistItems.unitId],
    references: [units.id],
  }),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  company: one(companies, {
    fields: [appointments.companyId],
    references: [companies.id],
  }),
  lead: one(leads, {
    fields: [appointments.leadId],
    references: [leads.id],
  }),
  project: one(projects, {
    fields: [appointments.projectId],
    references: [projects.id],
  }),
  assignedAgent: one(users, {
    fields: [appointments.assignedAgentId],
    references: [users.id],
  }),
}));

export const webhookEndpointsRelations = relations(webhookEndpoints, ({ one, many }) => ({
  company: one(companies, {
    fields: [webhookEndpoints.companyId],
    references: [companies.id],
  }),
  chatbot: one(chatbots, {
    fields: [webhookEndpoints.chatbotId],
    references: [chatbots.id],
  }),
  logs: many(webhookLogs),
}));

export const webhookLogsRelations = relations(webhookLogs, ({ one }) => ({
  endpoint: one(webhookEndpoints, {
    fields: [webhookLogs.endpointId],
    references: [webhookEndpoints.id],
  }),
}));

export const agentActionsRelations = relations(agentActions, ({ one }) => ({
  company: one(companies, {
    fields: [agentActions.companyId],
    references: [companies.id],
  }),
  approver: one(users, {
    fields: [agentActions.approvedBy],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  company: one(companies, {
    fields: [auditLogs.companyId],
    references: [companies.id],
  }),
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  company: one(companies, {
    fields: [notifications.companyId],
    references: [companies.id],
  }),
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const whatsappConfigsRelations = relations(whatsappConfigs, ({ one }) => ({
  company: one(companies, {
    fields: [whatsappConfigs.companyId],
    references: [companies.id],
  }),
  chatbot: one(chatbots, {
    fields: [whatsappConfigs.chatbotId],
    references: [chatbots.id],
  }),
}));

export const whatsappInboundEventsRelations = relations(whatsappInboundEvents, ({ one }) => ({
  company: one(companies, {
    fields: [whatsappInboundEvents.companyId],
    references: [companies.id],
  }),
}));

export const whatsappCampaignsRelations = relations(whatsappCampaigns, ({ one }) => ({
  company: one(companies, {
    fields: [whatsappCampaigns.companyId],
    references: [companies.id],
  }),
}));

export const integrationsRelations = relations(integrations, ({ one }) => ({
  company: one(companies, {
    fields: [integrations.companyId],
    references: [companies.id],
  }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  company: one(companies, {
    fields: [apiKeys.companyId],
    references: [companies.id],
  }),
}));

export const userInvitationsRelations = relations(userInvitations, ({ one }) => ({
  company: one(companies, {
    fields: [userInvitations.companyId],
    references: [companies.id],
  }),
  inviter: one(users, {
    fields: [userInvitations.invitedBy],
    references: [users.id],
  }),
}));

export const subscriptionInvoicesRelations = relations(subscriptionInvoices, ({ one }) => ({
  company: one(companies, {
    fields: [subscriptionInvoices.companyId],
    references: [companies.id],
  }),
  subscription: one(subscriptions, {
    fields: [subscriptionInvoices.subscriptionId],
    references: [subscriptions.id],
  }),
}));

export const leadCreditTransactionsRelations = relations(leadCreditTransactions, ({ one }) => ({
  company: one(companies, {
    fields: [leadCreditTransactions.companyId],
    references: [companies.id],
  }),
}));


export * from './tools.js';
export * from './flows.js';
export * from './omnichannel.js';
export * from './voice-studio.js';
export * from './intelligence.js';
export * from './controls.js';
export * from './payments.js';
export * from './demo-requests.js';
