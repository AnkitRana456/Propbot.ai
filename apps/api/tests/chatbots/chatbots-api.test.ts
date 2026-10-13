import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { chatbotsService } from '../../src/modules/chatbots/chatbots.service.js';

describe('Chatbots API Routes', () => {
  const app = createApp();

  const companyAId = '11111111-1111-1111-1111-111111111111';
  const companyBId = '22222222-2222-2222-2222-222222222222';

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

  const adminTokenCompanyB = signAccessToken({
    sub: '00000000-0000-0000-0000-000000000003',
    companyId: companyBId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@company-b.com',
    name: 'Admin Company B',
  });

  const sampleChatbot = {
    id: '33333333-3333-3333-3333-333333333333',
    companyId: companyAId,
    name: 'Luxury Villa Assistant',
    type: 'web' as const,
    status: 'active' as const,
    publicKey: 'pb_live_abcdef1234567890abcdef1234567890abcdef12345678',
    allowedDomains: ['https://example.com'],
    config: {
      description: 'AI sales assistant for high-end villas',
      appearance: {
        primaryColor: '#059669',
        textColor: '#ffffff',
        backgroundColor: '#ffffff',
        headerColor: '#0f172a',
        borderRadius: 16,
        position: 'bottom-right' as const,
        botName: 'Villa Concierge',
        botAvatarUrl: '',
        companyLogoUrl: '',
        themeMode: 'light' as const,
      },
      behavior: {
        systemPrompt: 'Assist clients with luxury villas',
        tone: 'luxury' as const,
        defaultLanguage: 'en',
        supportedLanguages: ['en', 'fr'],
        temperature: 0.7,
        greetingMessage: 'Welcome to Villa Residences!',
        quickQuestions: ['Explore 4BHK Villas', 'Pricing'],
      },
      leadCapture: {
        enabled: true,
        triggerAfterMessages: 2,
        title: 'Book a VIP Tour',
        subtitle: 'Leave your contact details',
        fields: [{ id: '1', name: 'name', label: 'Name', type: 'text' as const, required: true }],
      },
      businessHours: {
        enabled: false,
        timezone: 'Asia/Kolkata',
        schedule: [],
        offlineMessage: 'We are offline',
      },
      brochures: [],
      wizardDraft: { currentStep: 8, isCompleted: true },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    leadsCount: 12,
    conversationsCount: 45,
  };

  describe('Authentication & RBAC', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/chatbots');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects mutation requests from role "agent" with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .post('/api/chatbots')
        .set('Authorization', `Bearer ${agentTokenCompanyA}`)
        .send({ name: 'Unauthorized Bot' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_PERMISSION');
    });

    it('allows agent to read chatbot list (company context)', async () => {
      vi.spyOn(chatbotsService, 'listChatbots').mockResolvedValueOnce({
        chatbots: [sampleChatbot],
        total: 1,
      });

      const res = await request(app)
        .get('/api/chatbots')
        .set('Authorization', `Bearer ${agentTokenCompanyA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
    });
  });

  describe('CRUD Operations', () => {
    it('lists chatbots for company', async () => {
      vi.spyOn(chatbotsService, 'listChatbots').mockResolvedValueOnce({
        chatbots: [sampleChatbot],
        total: 1,
      });

      const res = await request(app)
        .get('/api/chatbots?status=active')
        .set('Authorization', `Bearer ${adminTokenCompanyA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.chatbots).toHaveLength(1);
      expect(res.body.data.chatbots[0].name).toBe('Luxury Villa Assistant');
    });

    it('creates a new chatbot with default values', async () => {
      vi.spyOn(chatbotsService, 'createChatbot').mockResolvedValueOnce(sampleChatbot);

      const res = await request(app)
        .post('/api/chatbots')
        .set('Authorization', `Bearer ${adminTokenCompanyA}`)
        .send({
          name: 'Luxury Villa Assistant',
          type: 'web',
          config: {
            appearance: { botName: 'Villa Concierge' },
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe(sampleChatbot.id);
      expect(res.body.data.publicKey).toMatch(/^pb_live_/);
    });

    it('validates chatbot creation payload schema', async () => {
      const res = await request(app)
        .post('/api/chatbots')
        .set('Authorization', `Bearer ${adminTokenCompanyA}`)
        .send({ name: 'A' }); // less than 2 chars

      expect(res.status).toBe(400); // Zod throws validation error caught by centralized handler
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('gets a single chatbot by ID', async () => {
      vi.spyOn(chatbotsService, 'getChatbotById').mockResolvedValueOnce(sampleChatbot);

      const res = await request(app)
        .get(`/api/chatbots/${sampleChatbot.id}`)
        .set('Authorization', `Bearer ${adminTokenCompanyA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(sampleChatbot.id);
    });

    it('updates chatbot settings and merges config', async () => {
      const updatedBot = { ...sampleChatbot, name: 'Updated Assistant' };
      vi.spyOn(chatbotsService, 'updateChatbot').mockResolvedValueOnce(updatedBot);

      const res = await request(app)
        .put(`/api/chatbots/${sampleChatbot.id}`)
        .set('Authorization', `Bearer ${adminTokenCompanyA}`)
        .send({ name: 'Updated Assistant' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Assistant');
    });

    it('updates status (toggle active/paused)', async () => {
      const pausedBot = { ...sampleChatbot, status: 'paused' as const };
      vi.spyOn(chatbotsService, 'updateStatus').mockResolvedValueOnce(pausedBot);

      const res = await request(app)
        .patch(`/api/chatbots/${sampleChatbot.id}/status`)
        .set('Authorization', `Bearer ${adminTokenCompanyA}`)
        .send({ status: 'paused' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('paused');
    });

    it('duplicates chatbot', async () => {
      const duplicatedBot = {
        ...sampleChatbot,
        id: '44444444-4444-4444-4444-444444444444',
        name: 'Copy of Luxury Villa Assistant',
        status: 'draft' as const,
      };
      vi.spyOn(chatbotsService, 'duplicateChatbot').mockResolvedValueOnce(duplicatedBot);

      const res = await request(app)
        .post(`/api/chatbots/${sampleChatbot.id}/duplicate`)
        .set('Authorization', `Bearer ${adminTokenCompanyA}`);

      expect(res.status).toBe(201);
      expect(res.body.data.name).toContain('Copy of');
      expect(res.body.data.status).toBe('draft');
    });

    it('rotates public key', async () => {
      vi.spyOn(chatbotsService, 'rotatePublicKey').mockResolvedValueOnce({
        publicKey: 'pb_live_newlygeneratedkey987654321098765432109876',
      });

      const res = await request(app)
        .post(`/api/chatbots/${sampleChatbot.id}/rotate-key`)
        .set('Authorization', `Bearer ${adminTokenCompanyA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.publicKey).toMatch(/^pb_live_/);
    });

    it('deletes chatbot', async () => {
      vi.spyOn(chatbotsService, 'deleteChatbot').mockResolvedValueOnce();

      const res = await request(app)
        .delete(`/api/chatbots/${sampleChatbot.id}`)
        .set('Authorization', `Bearer ${adminTokenCompanyA}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('deleted');
    });
  });

  describe('Tenant Isolation', () => {
    it('prevents Company B user from reading Company A chatbot', async () => {
      vi.spyOn(chatbotsService, 'getChatbotById').mockImplementationOnce(async (companyId, _id) => {
        if (companyId !== sampleChatbot.companyId) {
          const err = new Error('Chatbot not found');
          Object.assign(err, { statusCode: 404 });
          throw err;
        }
        return sampleChatbot;
      });

      const res = await request(app)
        .get(`/api/chatbots/${sampleChatbot.id}`)
        .set('Authorization', `Bearer ${adminTokenCompanyB}`);

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('not found');
    });

    it('prevents Company B user from mutating Company A chatbot', async () => {
      vi.spyOn(chatbotsService, 'updateChatbot').mockImplementationOnce(async (companyId, _id) => {
        if (companyId !== sampleChatbot.companyId) {
          const err = new Error('Chatbot not found');
          Object.assign(err, { statusCode: 404 });
          throw err;
        }
        return sampleChatbot;
      });

      const res = await request(app)
        .put(`/api/chatbots/${sampleChatbot.id}`)
        .set('Authorization', `Bearer ${adminTokenCompanyB}`)
        .send({ name: 'Hacked Bot Name' });

      expect(res.status).toBe(404);
    });
  });
});
