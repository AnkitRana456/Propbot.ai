import { eq, and, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { knowledgeSources, knowledgeChunks } from '../../db/schema/index.js';
import { chunkingService } from './chunking.service.js';
import { embeddingsService } from '../ai/embeddings.service.js';

export interface IngestionJobPayload {
  sourceId: string;
  companyId: string;
  chatbotId: string;
  sourceTitle: string;
  rawText: string;
}

export class IngestionQueueService {
  /**
   * Processes a document / text source ingestion job end-to-end:
   * Chunks -> Embeds -> Saves to knowledge_chunks with tsvector -> Updates source status.
   */
  async processIngestionJob(payload: IngestionJobPayload): Promise<void> {
    const { sourceId, companyId, chatbotId, sourceTitle, rawText } = payload;

    try {
      // 1. Mark status as 'processing'
      await db
        .update(knowledgeSources)
        .set({
          status: 'processing',
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(knowledgeSources.id, sourceId),
            eq(knowledgeSources.companyId, companyId),
            eq(knowledgeSources.chatbotId, chatbotId),
          ),
        );

      // 2. Chunk text into ~500 token segments with 50-token overlap
      const rawChunks = chunkingService.chunkText(rawText, {
        targetTokens: 500,
        overlapTokens: 50,
        sourceTitle,
      });

      if (rawChunks.length === 0) {
        throw new Error('Document contained no readable text or content was empty.');
      }

      // 3. Generate embeddings
      const chunkTexts = rawChunks.map(c => c.content);
      const embeddings = await embeddingsService.generateBatchEmbeddings(chunkTexts);

      // 4. Atomic Database Transaction: Clean old chunks, insert new chunks, mark source ready
      await db.transaction(async tx => {
        // Delete previous chunks if re-training
        await tx.delete(knowledgeChunks).where(eq(knowledgeChunks.sourceId, sourceId));

        // Insert new chunks
        for (let i = 0; i < rawChunks.length; i++) {
          const chunk = rawChunks[i]!;
          const embedding = embeddings[i]!;

          await tx.insert(knowledgeChunks).values({
            companyId,
            chatbotId,
            sourceId,
            content: chunk.content,
            embedding,
            tsv: sql`to_tsvector('english', ${chunk.content})`,
            metadata: chunk.metadata,
          });
        }

        // Mark source ready
        await tx
          .update(knowledgeSources)
          .set({
            status: 'ready',
            chunkCount: rawChunks.length,
            byteSize: Buffer.byteLength(rawText, 'utf-8'),
            lastTrainedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(knowledgeSources.id, sourceId));
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown ingestion error';

      await db
        .update(knowledgeSources)
        .set({
          status: 'failed',
          errorMessage,
          updatedAt: new Date(),
        })
        .where(eq(knowledgeSources.id, sourceId));
    }
  }

  /**
   * Enqueues an ingestion job. Executes asynchronously without blocking the client request.
   */
  enqueueIngestion(payload: IngestionJobPayload): void {
    // Run asynchronously
    setImmediate(() => {
      this.processIngestionJob(payload).catch(err => {
        console.error('[IngestionQueue] Unhandled job failure:', err);
      });
    });
  }
}

export const ingestionQueueService = new IngestionQueueService();
