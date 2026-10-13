/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { knowledgeService } from '../../src/modules/knowledge/knowledge.service.js';
import { retrievalService } from '../../src/modules/ai/retrieval.service.js';

describe('Knowledge & RAG API Routes', () => {
  const app = createApp();

  const companyAId = '11111111-1111-1111-1111-111111111111';
  const companyBId = '22222222-2222-2222-2222-222222222222';
  const chatbotAId = '33333333-3333-3333-3333-333333333333';

  const adminTokenCompanyA = signAccessToken({
    sub: '00000000-0000-0000-0000-000000000001',
    companyId: companyAId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@company-a.com',
    name: 'Admin Company A',
  });

  const agentTokenCompanyA = signAccessToken({
    sub: '00000000-0000-0000-0000-000000000002',
    companyId: companyAId,
    role: 'agent',
    status: 'active',
    email: 'agent@company-a.com',
    name: 'Agent Company A',
  });

  const _adminTokenCompanyB = signAccessToken({
    sub: '00000000-0000-0000-0000-000000000003',
    companyId: companyBId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@company-b.com',
    name: 'Admin Company B',
  });

  const sampleSource = {
    id: '44444444-4444-4444-4444-444444444444',
    chatbotId: chatbotAId,
    type: 'text' as const,
    title: 'Amenities & Master Plan',
    content: 'The master plan includes a 45,000 sq ft clubhouse, Olympic pool, and 4-tier security.',
    status: 'ready' as const,
    chunkCount: 2,
    errorMessage: null,
    config: {},
    lastTrainedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  describe('POST /api/chatbots/:id/knowledge/sources/text', () => {
    it('creates a text knowledge source for authorized admin', async () => {
      vi.spyOn(knowledgeService, 'createTextSource').mockResolvedValueOnce(sampleSource as any);

      const res = await request(app)
        .post(`/api/chatbots/${chatbotAId}/knowledge/sources/text`)
        .set('Authorization', `Bearer ${adminTokenCompanyA}`)
        .send({
          title: 'Amenities & Master Plan',
          content: 'The master plan includes a 45,000 sq ft clubhouse, Olympic pool, and 4-tier security.',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe(sampleSource.id);
      expect(res.body.data.type).toBe('text');
    });

    it('rejects text source creation without required fields', async () => {
      const res = await request(app)
        .post(`/api/chatbots/${chatbotAId}/knowledge/sources/text`)
        .set('Authorization', `Bearer ${adminTokenCompanyA}`)
        .send({
          title: 'Too short',
          content: 'tiny',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('denies agent role without train_chatbots permission', async () => {
      const res = await request(app)
        .post(`/api/chatbots/${chatbotAId}/knowledge/sources/text`)
        .set('Authorization', `Bearer ${agentTokenCompanyA}`)
        .send({
          title: 'Amenities & Master Plan',
          content: 'The master plan includes a 45,000 sq ft clubhouse, Olympic pool, and 4-tier security.',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_PERMISSION');
    });
  });

  describe('POST /api/chatbots/:id/knowledge/sources/qa', () => {
    it('creates a structured Q&A knowledge source', async () => {
      const qaSource = {
        ...sampleSource,
        type: 'qa' as const,
        title: 'Project Pricing FAQ',
      };
      vi.spyOn(knowledgeService, 'createQaSource').mockResolvedValueOnce(qaSource as any);

      const res = await request(app)
        .post(`/api/chatbots/${chatbotAId}/knowledge/sources/qa`)
        .set('Authorization', `Bearer ${adminTokenCompanyA}`)
        .send({
          title: 'Project Pricing FAQ',
          pairs: [
            {
              question: 'What is the starting price for 3BHK?',
              answer: '3BHK residences start at ₹3.25 Cr.',
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.type).toBe('qa');
    });
  });

  describe('POST /api/chatbots/:id/knowledge/sources/crawl', () => {
    it('creates a website crawl knowledge source with maxPages and maxDepth', async () => {
      const crawlSource = {
        ...sampleSource,
        type: 'crawl' as const,
        title: 'https://example.com/project',
      };
      vi.spyOn(knowledgeService, 'createCrawlSource').mockResolvedValueOnce(crawlSource as any);

      const res = await request(app)
        .post(`/api/chatbots/${chatbotAId}/knowledge/sources/crawl`)
        .set('Authorization', `Bearer ${adminTokenCompanyA}`)
        .send({
          title: 'Project Official Website',
          url: 'https://example.com/project',
          config: {
            maxPages: 10,
            maxDepth: 2,
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.data.type).toBe('crawl');
    });
  });

  describe('GET /api/chatbots/:id/knowledge/sources', () => {
    it('lists knowledge sources for chatbot', async () => {
      vi.spyOn(knowledgeService, 'listSources').mockResolvedValueOnce({
        sources: [sampleSource as any],
        total: 1,
      });

      const res = await request(app)
        .get(`/api/chatbots/${chatbotAId}/knowledge/sources`)
        .set('Authorization', `Bearer ${adminTokenCompanyA}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.sources)).toBe(true);
      expect(res.body.data.sources.length).toBe(1);
    });
  });

  describe('DELETE /api/chatbots/:id/knowledge/sources/:sourceId', () => {
    it('deletes knowledge source', async () => {
      vi.spyOn(knowledgeService, 'deleteSource').mockResolvedValueOnce(undefined);

      const res = await request(app)
        .delete(`/api/chatbots/${chatbotAId}/knowledge/sources/${sampleSource.id}`)
        .set('Authorization', `Bearer ${adminTokenCompanyA}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Knowledge source deleted successfully');
    });
  });

  describe('POST /api/chatbots/:id/knowledge/sources/:sourceId/retrain', () => {
    it('triggers retraining of knowledge source', async () => {
      vi.spyOn(knowledgeService, 'reTrainSource').mockResolvedValueOnce({
        ...sampleSource,
        status: 'queued',
      } as any);

      const res = await request(app)
        .post(`/api/chatbots/${chatbotAId}/knowledge/sources/${sampleSource.id}/retrain`)
        .set('Authorization', `Bearer ${adminTokenCompanyA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('queued');
    });
  });

  describe('Q&A Priority Overrides API', () => {
    const sampleOverride = {
      id: '55555555-5555-5555-5555-555555555555',
      companyId: companyAId,
      chatbotId: chatbotAId,
      question: 'What is the price of 4BHK?',
      answer: '4BHK villas start at ₹5.50 Cr with private plunge pools.',
      source: 'manual',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('creates a Q&A override', async () => {
      vi.spyOn(knowledgeService, 'createQaOverride').mockResolvedValueOnce(sampleOverride as any);

      const res = await request(app)
        .post(`/api/chatbots/${chatbotAId}/knowledge/overrides`)
        .set('Authorization', `Bearer ${adminTokenCompanyA}`)
        .send({
          question: 'What is the price of 4BHK?',
          answer: '4BHK villas start at ₹5.50 Cr with private plunge pools.',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.question).toBe(sampleOverride.question);
    });

    it('lists Q&A overrides for chatbot', async () => {
      vi.spyOn(knowledgeService, 'listQaOverrides').mockResolvedValueOnce([sampleOverride as any]);

      const res = await request(app)
        .get(`/api/chatbots/${chatbotAId}/knowledge/overrides`)
        .set('Authorization', `Bearer ${adminTokenCompanyA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
    });

    it('deletes a Q&A override', async () => {
      vi.spyOn(knowledgeService, 'deleteQaOverride').mockResolvedValueOnce(undefined);

      const res = await request(app)
        .delete(`/api/chatbots/${chatbotAId}/knowledge/overrides/${sampleOverride.id}`)
        .set('Authorization', `Bearer ${adminTokenCompanyA}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Q&A override deleted successfully');
    });
  });

  describe('Unanswered Questions API', () => {
    const sampleUnanswered = {
      id: '66666666-6666-6666-6666-666666666666',
      companyId: companyAId,
      chatbotId: chatbotAId,
      question: 'Do you have duplex penthouses facing the lake?',
      frequency: 3,
      status: 'pending' as const,
      resolvedAnswer: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('lists unanswered questions', async () => {
      vi.spyOn(knowledgeService, 'listUnanswered').mockResolvedValueOnce([
        sampleUnanswered as any,
      ]);

      const res = await request(app)
        .get(`/api/chatbots/${chatbotAId}/knowledge/unanswered`)
        .set('Authorization', `Bearer ${adminTokenCompanyA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].question).toContain('duplex');
    });

    it('resolves an unanswered question and creates an override', async () => {
      vi.spyOn(knowledgeService, 'resolveUnanswered').mockResolvedValueOnce({
        ...sampleUnanswered,
        status: 'resolved',
        resolvedAnswer: 'Yes, select duplex penthouses overlook the private lake reserve.',
      } as any);

      const res = await request(app)
        .post(`/api/chatbots/${chatbotAId}/knowledge/unanswered/${sampleUnanswered.id}/resolve`)
        .set('Authorization', `Bearer ${adminTokenCompanyA}`)
        .send({
          answer: 'Yes, select duplex penthouses overlook the private lake reserve.',
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('resolved');
    });
  });

  describe('POST /api/chatbots/:id/knowledge/query (Interactive Test RAG Query)', () => {
    it('executes hybrid retrieval and returns answer with citations and confidence score', async () => {
      vi.spyOn(retrievalService, 'query').mockResolvedValueOnce({
        answer: 'Residences start from ₹3.25 Cr for 3BHK and ₹5.50 Cr for 4BHK presidential villas.',
        citations: [
          {
            sourceId: '11111111-2222-3333-4444-555555555555',
            sourceTitle: 'Prestige Sanctuary Master Brochure 2026',
            sourceType: 'file',
            sectionHeader: 'Pricing & Investment',
            snippet: 'Residences start from ₹3.25 Cr onwards...',
            similarityScore: 0.94,
          },
        ],
        confidence: 0.94,
        isGrounded: true,
        isFallback: false,
        overrideApplied: false,
        tokensUsed: { prompt: 100, completion: 45, total: 145 },
        latencyMs: 120,
      });

      const res = await request(app)
        .post(`/api/chatbots/${chatbotAId}/knowledge/query`)
        .set('Authorization', `Bearer ${adminTokenCompanyA}`)
        .send({
          query: 'What are the starting prices for 3BHK and 4BHK villas?',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.confidence).toBe(0.94);
      expect(res.body.data.citations.length).toBe(1);
      expect(res.body.data.overrideApplied).toBe(false);
      expect(res.body.data.citations[0].sourceTitle).toBe('Prestige Sanctuary Master Brochure 2026');
    });

    it('returns immediate confidence 1.0 when a priority Q&A override matches', async () => {
      vi.spyOn(retrievalService, 'query').mockResolvedValueOnce({
        answer: 'All 4BHK villas come with private plunge pools.',
        citations: [],
        confidence: 1.0,
        isGrounded: true,
        isFallback: false,
        overrideApplied: true,
        tokensUsed: { prompt: 0, completion: 0, total: 0 },
        latencyMs: 5,
      });

      const res = await request(app)
        .post(`/api/chatbots/${chatbotAId}/knowledge/query`)
        .set('Authorization', `Bearer ${adminTokenCompanyA}`)
        .send({
          query: 'What is the price of 4BHK?',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.confidence).toBe(1.0);
      expect(res.body.data.overrideApplied).toBe(true);
      expect(res.body.data.answer).toBe('All 4BHK villas come with private plunge pools.');
    });
  });
});
