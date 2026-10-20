import crypto from 'node:crypto';
import { eq, and, sql, desc, isNull, ilike } from 'drizzle-orm';
import type {
  CreateChatbotInput,
  UpdateChatbotInput,
  ChatbotResponse,
  ChatbotsListResponse,
  ChatbotStatus,
  ChatbotConfig,
} from '@propbot/shared';
import { chatbotConfigSchema } from '@propbot/shared';
import { db } from '../../db/index.js';
import { chatbots, leads, conversations } from '../../db/schema/index.js';

export class ChatbotsService {
  private generatePublicKey(): string {
    const randomHex = crypto.randomBytes(24).toString('hex');
    return `pb_live_${randomHex}`;
  }

  async listChatbots(
    companyId: string,
    filters?: { status?: string; type?: string; search?: string },
  ): Promise<ChatbotsListResponse> {
    const conditions = [eq(chatbots.companyId, companyId), isNull(chatbots.deletedAt)];

    if (filters?.status && ['draft', 'active', 'paused'].includes(filters.status)) {
      conditions.push(eq(chatbots.status, filters.status));
    }

    if (filters?.type && ['web', 'whatsapp'].includes(filters.type)) {
      conditions.push(eq(chatbots.type, filters.type));
    }

    if (filters?.search && filters.search.trim().length > 0) {
      conditions.push(ilike(chatbots.name, `%${filters.search.trim()}%`));
    }

    const rows = await db
      .select({
        id: chatbots.id,
        companyId: chatbots.companyId,
        name: chatbots.name,
        type: chatbots.type,
        status: chatbots.status,
        publicKey: chatbots.publicKey,
        config: chatbots.config,
        allowedDomains: chatbots.allowedDomains,
        createdAt: chatbots.createdAt,
        updatedAt: chatbots.updatedAt,
        deletedAt: chatbots.deletedAt,
        agentId: chatbots.agentId,
        leadsCount: sql<number>`coalesce((select count(*)::int from ${leads} where ${leads.chatbotId} = ${chatbots.id} and ${leads.deletedAt} is null), 0)`,
        conversationsCount: sql<number>`coalesce((select count(*)::int from ${conversations} where ${conversations.chatbotId} = ${chatbots.id}), 0)`,
      })
      .from(chatbots)
      .where(and(...conditions))
      .orderBy(desc(chatbots.createdAt));

    const formatted: ChatbotResponse[] = rows.map(r => {
      const parsedConfig = chatbotConfigSchema.parse(r.config ?? {});
      return {
        id: r.id,
        companyId: r.companyId,
        name: r.name,
        type: r.type as 'web' | 'whatsapp',
        status: r.status as 'draft' | 'active' | 'paused',
        publicKey: r.publicKey,
        config: parsedConfig,
        allowedDomains: r.allowedDomains ?? [],
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
      agentId: r.agentId ?? null,
        leadsCount: Number(r.leadsCount),
        conversationsCount: Number(r.conversationsCount),
      };
    });

    return {
      chatbots: formatted,
      total: formatted.length,
    };
  }

  async getChatbotById(companyId: string, id: string): Promise<ChatbotResponse> {
    const [row] = await db
      .select({
        id: chatbots.id,
        companyId: chatbots.companyId,
        name: chatbots.name,
        type: chatbots.type,
        status: chatbots.status,
        publicKey: chatbots.publicKey,
        config: chatbots.config,
        allowedDomains: chatbots.allowedDomains,
        createdAt: chatbots.createdAt,
        updatedAt: chatbots.updatedAt,
        deletedAt: chatbots.deletedAt,
        agentId: chatbots.agentId,
        leadsCount: sql<number>`coalesce((select count(*)::int from ${leads} where ${leads.chatbotId} = ${chatbots.id} and ${leads.deletedAt} is null), 0)`,
        conversationsCount: sql<number>`coalesce((select count(*)::int from ${conversations} where ${conversations.chatbotId} = ${chatbots.id}), 0)`,
      })
      .from(chatbots)
      .where(
        and(eq(chatbots.id, id), eq(chatbots.companyId, companyId), isNull(chatbots.deletedAt)),
      );

    if (!row) {
      const err = new Error('Chatbot not found');
      Object.assign(err, { statusCode: 404 });
      throw err;
    }

    const parsedConfig = chatbotConfigSchema.parse(row.config ?? {});

    return {
      id: row.id,
      companyId: row.companyId,
      name: row.name,
      type: row.type as 'web' | 'whatsapp',
      status: row.status as 'draft' | 'active' | 'paused',
      publicKey: row.publicKey,
      config: parsedConfig,
      allowedDomains: row.allowedDomains ?? [],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
      agentId: row.agentId ?? null,
      leadsCount: Number(row.leadsCount),
      conversationsCount: Number(row.conversationsCount),
    };
  }

  async createChatbot(companyId: string, input: CreateChatbotInput): Promise<ChatbotResponse> {
    const publicKey = this.generatePublicKey();
    const parsedConfig = chatbotConfigSchema.parse(input.config ?? {});

    const [created] = await db
      .insert(chatbots)
      .values({
        companyId,
        name: input.name,
        type: input.type,
        status: input.status,
        publicKey,
        config: parsedConfig,
        allowedDomains: input.allowedDomains ?? [],
        updatedAt: new Date(),
      })
      .returning();

    if (!created) {
      throw new Error('Failed to create chatbot');
    }

    return {
      id: created.id,
      companyId: created.companyId,
      name: created.name,
      type: created.type as 'web' | 'whatsapp',
      status: created.status as 'draft' | 'active' | 'paused',
      publicKey: created.publicKey,
      config: chatbotConfigSchema.parse(created.config ?? {}),
      allowedDomains: created.allowedDomains ?? [],
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
      deletedAt: null,
      leadsCount: 0,
      conversationsCount: 0,
    };
  }

  async updateChatbot(
    companyId: string,
    id: string,
    input: UpdateChatbotInput,
  ): Promise<ChatbotResponse> {
    const existing = await this.getChatbotById(companyId, id);

    let mergedConfig: ChatbotConfig = existing.config;
    if (input.config) {
      mergedConfig = chatbotConfigSchema.parse({
        ...existing.config,
        ...input.config,
        appearance: {
          ...existing.config.appearance,
          ...(input.config.appearance || {}),
        },
        behavior: {
          ...existing.config.behavior,
          ...(input.config.behavior || {}),
        },
        leadCapture: {
          ...existing.config.leadCapture,
          ...(input.config.leadCapture || {}),
        },
        businessHours: {
          ...existing.config.businessHours,
          ...(input.config.businessHours || {}),
        },
        wizardDraft: {
          ...existing.config.wizardDraft,
          ...(input.config.wizardDraft || {}),
        },
      });
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.type !== undefined) updateData.type = input.type;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.allowedDomains !== undefined) updateData.allowedDomains = input.allowedDomains;
    if (input.config !== undefined) updateData.config = mergedConfig;

    const [updated] = await db
      .update(chatbots)
      .set(updateData)
      .where(
        and(eq(chatbots.id, id), eq(chatbots.companyId, companyId), isNull(chatbots.deletedAt)),
      )
      .returning();

    if (!updated) {
      const err = new Error('Chatbot not found');
      Object.assign(err, { statusCode: 404 });
      throw err;
    }

    return {
      id: updated.id,
      companyId: updated.companyId,
      name: updated.name,
      type: updated.type as 'web' | 'whatsapp',
      status: updated.status as 'draft' | 'active' | 'paused',
      publicKey: updated.publicKey,
      config: chatbotConfigSchema.parse(updated.config ?? {}),
      allowedDomains: updated.allowedDomains ?? [],
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      deletedAt: null,
      agentId: updated.agentId ?? null,
      leadsCount: existing.leadsCount,
      conversationsCount: existing.conversationsCount,
    };
  }

  async updateStatus(
    companyId: string,
    id: string,
    status: ChatbotStatus,
  ): Promise<ChatbotResponse> {
    return this.updateChatbot(companyId, id, { status });
  }

  async duplicateChatbot(companyId: string, id: string): Promise<ChatbotResponse> {
    const source = await this.getChatbotById(companyId, id);
    const newName = `Copy of ${source.name}`;

    return this.createChatbot(companyId, {
      name: newName,
      type: source.type,
      status: 'draft',
      allowedDomains: [...source.allowedDomains],
      config: {
        ...source.config,
        wizardDraft: {
          currentStep: 8,
          isCompleted: false,
        },
      },
    });
  }

  async rotatePublicKey(companyId: string, id: string): Promise<{ publicKey: string }> {
    const existing = await this.getChatbotById(companyId, id);
    const newPublicKey = this.generatePublicKey();

    await db
      .update(chatbots)
      .set({
        publicKey: newPublicKey,
        updatedAt: new Date(),
      })
      .where(and(eq(chatbots.id, existing.id), eq(chatbots.companyId, companyId)));

    return { publicKey: newPublicKey };
  }

  async deleteChatbot(companyId: string, id: string): Promise<void> {
    const existing = await this.getChatbotById(companyId, id);

    await db
      .update(chatbots)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(chatbots.id, existing.id), eq(chatbots.companyId, companyId)));
  }
}

export const chatbotsService = new ChatbotsService();
