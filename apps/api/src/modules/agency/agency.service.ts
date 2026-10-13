import { eq, and, desc, isNull } from 'drizzle-orm';
import type {
  CreateClientCompanyInput,
  UpdateClientDeliveryRulesInput,
  AssignChatbotClientInput,
  ClientDeliveryRules,
} from '@propbot/shared';
import { db } from '../../db/index.js';
import {
  companies,
  chatbots,
  leads,
  appointments,
  companyAiSettings,
  subscriptions,
} from '../../db/schema/index.js';
import { billingService } from '../billing/billing.service.js';
import { auditService } from '../audit/audit.service.js';

export class AgencyService {
  async getClients(agencyCompanyId: string) {
    const clientList = await db.query.companies.findMany({
      where: eq(companies.parentCompanyId, agencyCompanyId),
      orderBy: [desc(companies.createdAt)],
      with: {
        chatbots: {
          where: isNull(chatbots.deletedAt),
          columns: {
            id: true,
            name: true,
            status: true,
            deliveryRules: true,
          },
        },
        subscription: {
          columns: {
            plan: true,
            leadCreditsBalance: true,
          },
        },
      },
    });

    return clientList;
  }

  async createClient(agencyCompanyId: string, input: CreateClientCompanyInput, actorId?: string) {
    const existingSlug = await db.query.companies.findFirst({
      where: eq(companies.slug, input.slug),
    });
    if (existingSlug) {
      throw new Error('A company with this slug already exists.');
    }

    const [clientCompany] = await db
      .insert(companies)
      .values({
        parentCompanyId: agencyCompanyId,
        isAgency: false,
        name: input.name,
        slug: input.slug,
        plan: 'starter',
        status: 'active',
        settings: {
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          deliveryRules: input.deliveryRules ?? {
            workingHoursEnabled: false,
            roundRobinMemberIds: [],
            duplicateWindowHours: 24,
            emailDelivery: true,
            whatsappDelivery: true,
            webhookDelivery: false,
          },
        },
      })
      .returning();

    if (!clientCompany) {
      throw new Error('Failed to create client company record.');
    }

    // Default AI settings & starter subscription
    await db.insert(companyAiSettings).values({
      companyId: clientCompany.id,
      killSwitch: false,
      allowedTiers: ['T0', 'T1'],
      dailyActionCap: 100,
    });

    await db.insert(subscriptions).values({
      companyId: clientCompany.id,
      plan: 'starter',
      status: 'active',
      leadCreditsBalance: 50, // Initial reseller starter credits
    });

    await auditService.log({
      companyId: agencyCompanyId,
      userId: actorId,
      action: 'client_company_created',
      resourceType: 'client_company',
      resourceId: clientCompany.id,
      details: { clientName: input.name, slug: input.slug },
    });

    return clientCompany;
  }

  async updateClientDeliveryRules(
    agencyCompanyId: string,
    clientId: string,
    input: UpdateClientDeliveryRulesInput,
    actorId?: string,
  ) {
    const client = await db.query.companies.findFirst({
      where: and(eq(companies.id, clientId), eq(companies.parentCompanyId, agencyCompanyId)),
    });
    if (!client) throw new Error('Client company not found.');

    const currentSettings = (client.settings as Record<string, unknown>) || {};
    const updatedSettings = {
      ...currentSettings,
      deliveryRules: input.deliveryRules,
    };

    const [updated] = await db
      .update(companies)
      .set({ settings: updatedSettings, updatedAt: new Date() })
      .where(eq(companies.id, clientId))
      .returning();

    await auditService.log({
      companyId: agencyCompanyId,
      userId: actorId,
      action: 'client_delivery_rules_updated',
      resourceType: 'client_company',
      resourceId: clientId,
      details: { deliveryRules: input.deliveryRules },
    });

    return updated;
  }

  async assignChatbotClient(
    agencyCompanyId: string,
    chatbotId: string,
    input: AssignChatbotClientInput,
    actorId?: string,
  ) {
    const bot = await db.query.chatbots.findFirst({
      where: and(eq(chatbots.id, chatbotId), eq(chatbots.companyId, agencyCompanyId)),
    });
    if (!bot) throw new Error('Chatbot not found in your agency account.');

    if (input.clientId) {
      const client = await db.query.companies.findFirst({
        where: and(
          eq(companies.id, input.clientId),
          eq(companies.parentCompanyId, agencyCompanyId),
        ),
      });
      if (!client) throw new Error('Target client company does not belong to your agency.');
    }

    const [updatedBot] = await db
      .update(chatbots)
      .set({
        clientId: input.clientId,
        deliveryRules: (input.deliveryRules as ClientDeliveryRules) ?? (bot.deliveryRules as ClientDeliveryRules),
        updatedAt: new Date(),
      })
      .where(eq(chatbots.id, chatbotId))
      .returning();

    await auditService.log({
      companyId: agencyCompanyId,
      userId: actorId,
      action: input.clientId ? 'chatbot_assigned_to_client' : 'chatbot_unassigned_from_client',
      resourceType: 'chatbot',
      resourceId: chatbotId,
      details: { clientId: input.clientId },
    });

    return updatedBot;
  }

  async deliverLeadToClient(leadId: string, chatbotId: string) {
    const bot = await db.query.chatbots.findFirst({
      where: eq(chatbots.id, chatbotId),
    });
    if (!bot || !bot.clientId) {
      return { delivered: false, reason: 'Chatbot has no client assigned' };
    }

    const client = await db.query.companies.findFirst({
      where: eq(companies.id, bot.clientId),
    });
    if (!client) {
      return { delivered: false, reason: 'Client company not found' };
    }

    const lead = await db.query.leads.findFirst({
      where: eq(leads.id, leadId),
    });
    if (!lead) return { delivered: false, reason: 'Lead record not found' };

    const rules = (bot.deliveryRules as ClientDeliveryRules) || {};

    // 1. Deduct lead credit if credit balance is active
    const creditResult = await billingService.deductLeadCredit(
      client.id,
      leadId,
      1,
      `Delivered lead ${leadId} via chatbot ${bot.name}`,
    );

    // 2. Round robin agent assignment if configured
    if (rules.roundRobinMemberIds && rules.roundRobinMemberIds.length > 0) {
      const assignedId = rules.roundRobinMemberIds[0];
      await db
        .update(leads)
        .set({ assignedAgentId: assignedId, updatedAt: new Date() })
        .where(eq(leads.id, leadId));
    }

    // 3. Multi-channel dispatch stub: dashboard + email + WhatsApp + webhook
    console.info(`[LEAD DELIVERY] Delivered lead ${leadId} to client ${client.name}`, {
      emailDelivery: rules.emailDelivery,
      whatsappDelivery: rules.whatsappDelivery,
      webhookDelivery: rules.webhookDelivery,
      creditConsumed: creditResult.success,
    });

    return {
      delivered: true,
      clientId: client.id,
      clientName: client.name,
      creditResult,
    };
  }

  async getClientPortalData(clientCompanyId: string) {
    const clientLeads = await db.query.leads.findMany({
      where: eq(leads.companyId, clientCompanyId),
      orderBy: [desc(leads.createdAt)],
      limit: 50,
      with: {
        contact: true,
      },
    });

    const clientAppointments = await db.query.appointments.findMany({
      where: eq(appointments.companyId, clientCompanyId),
      orderBy: [desc(appointments.scheduledAt)],
      limit: 50,
    });

    const clientChatbots = await db.query.chatbots.findMany({
      where: eq(chatbots.clientId, clientCompanyId),
    });

    return {
      leads: clientLeads,
      appointments: clientAppointments,
      chatbots: clientChatbots,
    };
  }
}

export const agencyService = new AgencyService();
