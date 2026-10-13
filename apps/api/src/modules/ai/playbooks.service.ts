import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { objectionPlaybooks } from '../../db/schema/index.js';
import type {
  CreateObjectionPlaybookInput,
  UpdateObjectionPlaybookInput,
  ObjectionPlaybook,
  PlaybooksListResponse,
} from '@propbot/shared';

export class PlaybooksService {
  async listPlaybooks(
    companyId: string,
    chatbotId?: string,
  ): Promise<PlaybooksListResponse> {
    const conditions = [eq(objectionPlaybooks.companyId, companyId)];
    if (chatbotId) {
      conditions.push(eq(objectionPlaybooks.chatbotId, chatbotId));
    }

    const rows = await db
      .select()
      .from(objectionPlaybooks)
      .where(and(...conditions))
      .orderBy(desc(objectionPlaybooks.createdAt));

    const playbooks: ObjectionPlaybook[] = rows.map(r => ({
      id: r.id,
      companyId: r.companyId,
      chatbotId: r.chatbotId || undefined,
      category: r.category as ObjectionPlaybook['category'],
      title: r.title,
      triggerKeywords: (r.triggerKeywords as string[]) || [],
      rebuttalText: r.rebuttalText,
      suggestedAction: r.suggestedAction || undefined,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    return {
      playbooks,
      total: playbooks.length,
    };
  }

  async getPlaybookById(
    companyId: string,
    id: string,
  ): Promise<ObjectionPlaybook | null> {
    const [row] = await db
      .select()
      .from(objectionPlaybooks)
      .where(and(eq(objectionPlaybooks.companyId, companyId), eq(objectionPlaybooks.id, id)));

    if (!row) return null;

    return {
      id: row.id,
      companyId: row.companyId,
      chatbotId: row.chatbotId || undefined,
      category: row.category as ObjectionPlaybook['category'],
      title: row.title,
      triggerKeywords: (row.triggerKeywords as string[]) || [],
      rebuttalText: row.rebuttalText,
      suggestedAction: row.suggestedAction || undefined,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async createPlaybook(
    companyId: string,
    input: CreateObjectionPlaybookInput,
  ): Promise<ObjectionPlaybook> {
    const [created] = await db
      .insert(objectionPlaybooks)
      .values({
        companyId,
        chatbotId: input.chatbotId || null,
        category: input.category,
        title: input.title,
        triggerKeywords: input.triggerKeywords,
        rebuttalText: input.rebuttalText,
        suggestedAction: input.suggestedAction || null,
        isActive: input.isActive ?? true,
      })
      .returning();

    if (!created) throw new Error('Failed to create objection playbook');

    return {
      id: created.id,
      companyId: created.companyId,
      chatbotId: created.chatbotId || undefined,
      category: created.category as ObjectionPlaybook['category'],
      title: created.title,
      triggerKeywords: (created.triggerKeywords as string[]) || [],
      rebuttalText: created.rebuttalText,
      suggestedAction: created.suggestedAction || undefined,
      isActive: created.isActive,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  async updatePlaybook(
    companyId: string,
    id: string,
    input: UpdateObjectionPlaybookInput,
  ): Promise<ObjectionPlaybook> {
    const existing = await this.getPlaybookById(companyId, id);
    if (!existing) throw new Error('Playbook not found');

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (input.title !== undefined) updateData['title'] = input.title;
    if (input.category !== undefined) updateData['category'] = input.category;
    if (input.triggerKeywords !== undefined) updateData['triggerKeywords'] = input.triggerKeywords;
    if (input.rebuttalText !== undefined) updateData['rebuttalText'] = input.rebuttalText;
    if (input.suggestedAction !== undefined) updateData['suggestedAction'] = input.suggestedAction;
    if (input.isActive !== undefined) updateData['isActive'] = input.isActive;
    if (input.chatbotId !== undefined) updateData['chatbotId'] = input.chatbotId || null;

    const [updated] = await db
      .update(objectionPlaybooks)
      .set(updateData)
      .where(and(eq(objectionPlaybooks.companyId, companyId), eq(objectionPlaybooks.id, id)))
      .returning();

    if (!updated) throw new Error('Failed to update objection playbook');

    return {
      id: updated.id,
      companyId: updated.companyId,
      chatbotId: updated.chatbotId || undefined,
      category: updated.category as ObjectionPlaybook['category'],
      title: updated.title,
      triggerKeywords: (updated.triggerKeywords as string[]) || [],
      rebuttalText: updated.rebuttalText,
      suggestedAction: updated.suggestedAction || undefined,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deletePlaybook(companyId: string, id: string): Promise<boolean> {
    const result = await db
      .delete(objectionPlaybooks)
      .where(and(eq(objectionPlaybooks.companyId, companyId), eq(objectionPlaybooks.id, id)))
      .returning({ id: objectionPlaybooks.id });

    if (result.length === 0) {
      throw new Error('Playbook not found');
    }

    return true;
  }

  async findMatchingPlaybook(
    companyId: string,
    message: string,
    category?: string,
  ): Promise<ObjectionPlaybook | null> {
    const { playbooks } = await this.listPlaybooks(companyId);
    const msgLower = message.toLowerCase();

    for (const pb of playbooks) {
      if (!pb.isActive) continue;
      if (category && pb.category !== category) continue;

      const matches = pb.triggerKeywords.some(kw =>
        msgLower.includes(kw.toLowerCase()),
      );
      if (matches) {
        return pb;
      }
    }

    return null;
  }
}

export const playbooksService = new PlaybooksService();
