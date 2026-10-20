import { and, desc, eq } from 'drizzle-orm';
import type { KbTestResult } from '@propbot/shared';
import { db } from '../../db/index.js';
import { chatbots, kbTestRuns } from '../../db/schema/index.js';
import { badRequest } from '../../utils/api-error.js';
import { retrievalService } from '../ai/retrieval.service.js';

const GROUNDED_THRESHOLD = 0.7;

class KbTesterService {
  /** Runs retrieval only (no answer generation, no tokens spent) and shows what the bot would see. */
  async run(companyId: string, userId: string | null, chatbotId: string, question: string): Promise<KbTestResult> {
    const [bot] = await db.select({ id: chatbots.id }).from(chatbots).where(and(eq(chatbots.id, chatbotId), eq(chatbots.companyId, companyId)));
    if (!bot) throw badRequest('CHATBOT_INVALID', 'That chatbot does not exist.');
    const res = await retrievalService.query(companyId, chatbotId, { query: question, topK: 5, similarityThreshold: 0.2, streaming: false }, { skipGeneration: true, trace: { channel: 'kb_test', purpose: 'test' } });
    const results = (res.citations ?? []).map(c => ({ sourceTitle: c.sourceTitle, snippet: c.snippet.slice(0, 400), score: Math.round(c.similarityScore * 1000) / 1000 }));
    const bestScore = results[0]?.score ?? 0;
    const [row] = await db.insert(kbTestRuns).values({ companyId, chatbotId, question, results, bestScore: bestScore.toFixed(4), createdBy: userId }).returning();
    return { id: row!.id, question, bestScore, grounded: bestScore >= GROUNDED_THRESHOLD, results, createdAt: row!.createdAt.toISOString() };
  }

  async history(companyId: string, chatbotId?: string): Promise<KbTestResult[]> {
    const rows = await db
      .select()
      .from(kbTestRuns)
      .where(chatbotId ? and(eq(kbTestRuns.companyId, companyId), eq(kbTestRuns.chatbotId, chatbotId)) : eq(kbTestRuns.companyId, companyId))
      .orderBy(desc(kbTestRuns.createdAt))
      .limit(30);
    return rows.map(r => ({ id: r.id, question: r.question, bestScore: Number(r.bestScore ?? 0), grounded: Number(r.bestScore ?? 0) >= GROUNDED_THRESHOLD, results: r.results as KbTestResult['results'], createdAt: r.createdAt.toISOString() }));
  }
}

export const kbTesterService = new KbTesterService();
