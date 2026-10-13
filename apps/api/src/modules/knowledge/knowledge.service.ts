import { eq, and, desc } from 'drizzle-orm';
import type {
  CreateTextSourceInput,
  CreateCrawlSourceInput,
  CreateQaSourceInput,
  CreateQaOverrideInput,
  KnowledgeSourceResponse,
  KnowledgeSourcesListResponse,
  QaOverrideResponse,
  UnansweredQuestionResponse,
  KnowledgeSourceType,
  KnowledgeSourceStatus,
  KnowledgeSourceConfig,
} from '@propbot/shared';
import { db } from '../../db/index.js';
import {
  knowledgeSources,
  knowledgeChunks,
  knowledgeQaOverrides,
  unansweredQuestions,
} from '../../db/schema/index.js';
import { parserService } from './parser.service.js';
import { crawlerService } from './crawler.service.js';
import { ingestionQueueService } from './queue.service.js';

export class KnowledgeService {
  async listSources(companyId: string, chatbotId: string): Promise<KnowledgeSourcesListResponse> {
    const rows = await db
      .select()
      .from(knowledgeSources)
      .where(and(eq(knowledgeSources.companyId, companyId), eq(knowledgeSources.chatbotId, chatbotId)))
      .orderBy(desc(knowledgeSources.createdAt));

    const formatted: KnowledgeSourceResponse[] = rows.map(r => ({
      id: r.id,
      companyId: r.companyId,
      chatbotId: r.chatbotId,
      title: r.title,
      type: r.type as KnowledgeSourceType,
      sourceUrl: r.sourceUrl,
      filePath: r.filePath,
      status: r.status as KnowledgeSourceStatus,
      errorMessage: r.errorMessage,
      chunkCount: r.chunkCount,
      byteSize: r.byteSize,
      config: (r.config as KnowledgeSourceConfig) || {},
      lastTrainedAt: r.lastTrainedAt ? r.lastTrainedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    return {
      sources: formatted,
      total: formatted.length,
    };
  }

  async getSourceById(companyId: string, chatbotId: string, sourceId: string): Promise<KnowledgeSourceResponse> {
    const [row] = await db
      .select()
      .from(knowledgeSources)
      .where(
        and(
          eq(knowledgeSources.id, sourceId),
          eq(knowledgeSources.companyId, companyId),
          eq(knowledgeSources.chatbotId, chatbotId),
        ),
      );

    if (!row) {
      const err = new Error('Knowledge source not found');
      Object.assign(err, { statusCode: 404 });
      throw err;
    }

    return {
      id: row.id,
      companyId: row.companyId,
      chatbotId: row.chatbotId,
      title: row.title,
      type: row.type as KnowledgeSourceType,
      sourceUrl: row.sourceUrl,
      filePath: row.filePath,
      status: row.status as KnowledgeSourceStatus,
      errorMessage: row.errorMessage,
      chunkCount: row.chunkCount,
      byteSize: row.byteSize,
      config: (row.config as KnowledgeSourceConfig) || {},
      lastTrainedAt: row.lastTrainedAt ? row.lastTrainedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async createTextSource(
    companyId: string,
    chatbotId: string,
    input: CreateTextSourceInput,
  ): Promise<KnowledgeSourceResponse> {
    const byteSize = Buffer.byteLength(input.content, 'utf-8');

    const [created] = await db
      .insert(knowledgeSources)
      .values({
        companyId,
        chatbotId,
        title: input.title,
        type: 'text',
        status: 'queued',
        byteSize,
        config: { rawText: input.content },
        updatedAt: new Date(),
      })
      .returning();

    if (!created) {
      throw new Error('Failed to create knowledge source');
    }

    // Enqueue ingestion
    ingestionQueueService.enqueueIngestion({
      sourceId: created.id,
      companyId,
      chatbotId,
      sourceTitle: input.title,
      rawText: input.content,
    });

    return this.getSourceById(companyId, chatbotId, created.id);
  }

  async createQaSource(
    companyId: string,
    chatbotId: string,
    input: CreateQaSourceInput,
  ): Promise<KnowledgeSourceResponse> {
    const formattedContent = parserService.formatQaPairs(input.pairs);
    const byteSize = Buffer.byteLength(formattedContent, 'utf-8');

    const [created] = await db
      .insert(knowledgeSources)
      .values({
        companyId,
        chatbotId,
        title: input.title,
        type: 'qa',
        status: 'queued',
        byteSize,
        config: { qaPairs: input.pairs, rawText: formattedContent },
        updatedAt: new Date(),
      })
      .returning();

    if (!created) {
      throw new Error('Failed to create Q&A knowledge source');
    }

    ingestionQueueService.enqueueIngestion({
      sourceId: created.id,
      companyId,
      chatbotId,
      sourceTitle: input.title,
      rawText: formattedContent,
    });

    return this.getSourceById(companyId, chatbotId, created.id);
  }

  async createCrawlSource(
    companyId: string,
    chatbotId: string,
    input: CreateCrawlSourceInput,
  ): Promise<KnowledgeSourceResponse> {
    const [created] = await db
      .insert(knowledgeSources)
      .values({
        companyId,
        chatbotId,
        title: input.title,
        type: 'url',
        sourceUrl: input.url,
        status: 'queued',
        config: { crawlConfig: input.config },
        updatedAt: new Date(),
      })
      .returning();

    if (!created) {
      throw new Error('Failed to create crawl knowledge source');
    }

    // Crawl & Ingest asynchronously
    setImmediate(async () => {
      try {
        const pages = await crawlerService.crawlUrl(input.url, input.config);
        const combinedText = pages.map(p => `### Page: ${p.title} (${p.url})\n\n${p.content}`).join('\n\n---\n\n');

        if (combinedText.length === 0) {
          throw new Error('Website crawl returned no readable content or was blocked by robots.txt.');
        }

        await ingestionQueueService.processIngestionJob({
          sourceId: created.id,
          companyId,
          chatbotId,
          sourceTitle: input.title,
          rawText: combinedText,
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Crawl failed';
        await db
          .update(knowledgeSources)
          .set({ status: 'failed', errorMessage, updatedAt: new Date() })
          .where(eq(knowledgeSources.id, created.id));
      }
    });

    return this.getSourceById(companyId, chatbotId, created.id);
  }

  async createFileSource(
    companyId: string,
    chatbotId: string,
    title: string,
    buffer: Buffer,
    fileName: string,
    mimeType?: string,
  ): Promise<KnowledgeSourceResponse> {
    const rawText = parserService.parseFileBuffer(buffer, mimeType, fileName);
    const byteSize = buffer.length;

    const [created] = await db
      .insert(knowledgeSources)
      .values({
        companyId,
        chatbotId,
        title,
        type: 'file',
        status: 'queued',
        byteSize,
        config: {
          originalFileName: fileName,
          mimeType,
          rawText,
        },
        updatedAt: new Date(),
      })
      .returning();

    if (!created) {
      throw new Error('Failed to create file knowledge source');
    }

    ingestionQueueService.enqueueIngestion({
      sourceId: created.id,
      companyId,
      chatbotId,
      sourceTitle: title,
      rawText,
    });

    return this.getSourceById(companyId, chatbotId, created.id);
  }

  async reTrainSource(companyId: string, chatbotId: string, sourceId: string): Promise<KnowledgeSourceResponse> {
    const source = await this.getSourceById(companyId, chatbotId, sourceId);
    const config = (source.config as KnowledgeSourceConfig) || {};

    if (source.type === 'url' && source.sourceUrl) {
      // Re-crawl
      await this.createCrawlSource(companyId, chatbotId, {
        title: source.title,
        url: source.sourceUrl,
        config: config.crawlConfig,
      });
      return this.getSourceById(companyId, chatbotId, sourceId);
    }

    const rawText = config.rawText || '';
    if (!rawText) {
      throw new Error('No cached raw text available to re-train. Please re-upload the document.');
    }

    ingestionQueueService.enqueueIngestion({
      sourceId: source.id,
      companyId,
      chatbotId,
      sourceTitle: source.title,
      rawText,
    });

    return this.getSourceById(companyId, chatbotId, sourceId);
  }

  async deleteSource(companyId: string, chatbotId: string, sourceId: string): Promise<void> {
    const source = await this.getSourceById(companyId, chatbotId, sourceId);

    // Delete chunks and source
    await db.transaction(async tx => {
      await tx.delete(knowledgeChunks).where(eq(knowledgeChunks.sourceId, source.id));
      await tx.delete(knowledgeSources).where(eq(knowledgeSources.id, source.id));
    });
  }

  // ==========================================
  // Q&A Overrides (Fine-Tune Feedback Loop)
  // ==========================================
  async listQaOverrides(companyId: string, chatbotId: string): Promise<QaOverrideResponse[]> {
    const rows = await db
      .select()
      .from(knowledgeQaOverrides)
      .where(and(eq(knowledgeQaOverrides.companyId, companyId), eq(knowledgeQaOverrides.chatbotId, chatbotId)))
      .orderBy(desc(knowledgeQaOverrides.createdAt));

    return rows.map(r => ({
      id: r.id,
      companyId: r.companyId,
      chatbotId: r.chatbotId,
      question: r.question,
      answer: r.answer,
      source: r.source,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async createQaOverride(
    companyId: string,
    chatbotId: string,
    input: CreateQaOverrideInput,
  ): Promise<QaOverrideResponse> {
    const [created] = await db
      .insert(knowledgeQaOverrides)
      .values({
        companyId,
        chatbotId,
        question: input.question,
        answer: input.answer,
        source: input.source || 'correction',
        isActive: true,
        updatedAt: new Date(),
      })
      .returning();

    if (!created) {
      throw new Error('Failed to create Q&A override');
    }

    return {
      id: created.id,
      companyId: created.companyId,
      chatbotId: created.chatbotId,
      question: created.question,
      answer: created.answer,
      source: created.source,
      isActive: created.isActive,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  async deleteQaOverride(companyId: string, chatbotId: string, overrideId: string): Promise<void> {
    await db
      .delete(knowledgeQaOverrides)
      .where(
        and(
          eq(knowledgeQaOverrides.id, overrideId),
          eq(knowledgeQaOverrides.companyId, companyId),
          eq(knowledgeQaOverrides.chatbotId, chatbotId),
        ),
      );
  }

  // ==========================================
  // Unanswered Questions (Inbox)
  // ==========================================
  async listUnanswered(companyId: string, chatbotId: string): Promise<UnansweredQuestionResponse[]> {
    const rows = await db
      .select()
      .from(unansweredQuestions)
      .where(and(eq(unansweredQuestions.companyId, companyId), eq(unansweredQuestions.chatbotId, chatbotId)))
      .orderBy(desc(unansweredQuestions.frequency), desc(unansweredQuestions.updatedAt));

    return rows.map(r => ({
      id: r.id,
      companyId: r.companyId,
      chatbotId: r.chatbotId,
      question: r.question,
      frequency: r.frequency,
      status: r.status as 'pending' | 'resolved' | 'ignored',
      resolvedAnswer: r.resolvedAnswer,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async resolveUnanswered(
    companyId: string,
    chatbotId: string,
    questionId: string,
    answer: string,
  ): Promise<void> {
    const [q] = await db
      .select()
      .from(unansweredQuestions)
      .where(
        and(
          eq(unansweredQuestions.id, questionId),
          eq(unansweredQuestions.companyId, companyId),
          eq(unansweredQuestions.chatbotId, chatbotId),
        ),
      );

    if (!q) {
      const err = new Error('Unanswered question not found');
      Object.assign(err, { statusCode: 404 });
      throw err;
    }

    // 1. Mark as resolved
    await db
      .update(unansweredQuestions)
      .set({
        status: 'resolved',
        resolvedAnswer: answer,
        updatedAt: new Date(),
      })
      .where(eq(unansweredQuestions.id, questionId));

    // 2. Save as verified Q&A Override immediately
    await this.createQaOverride(companyId, chatbotId, {
      question: q.question,
      answer,
      source: 'manual',
    });
  }
}

export const knowledgeService = new KnowledgeService();
