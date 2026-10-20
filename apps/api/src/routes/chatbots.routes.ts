import { Router } from 'express';
import { chatbotsController } from '../modules/chatbots/chatbots.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { tenantGuard } from '../middlewares/tenant-guard.js';
import { requirePermission } from '../middlewares/rbac.js';
import { enforcePlanLimit } from '../middlewares/plan-limits.js';

import { db } from '../db/index.js';
import { chatbots } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { availabilityService } from '../modules/appointments/availability.service.js';
import { appointmentsController } from '../modules/appointments/appointments.controller.js';
import { modelRouter, TaskTier } from '../modules/ai/router.js';
import { languageDetectorService } from '../modules/ai/language-detector.service.js';

export const chatbotsRouter: Router = Router();

// ==========================================
// Public Chatbot Tools (Widget endpoints)
// ==========================================

chatbotsRouter.get('/:chatbotId/available-slots', async (req, res, next) => {
  try {
    const { chatbotId } = req.params;
    const { date, projectId, agentId } = req.query;
    if (!date) {
      res.status(400).json({ error: { message: 'Date query param is required (YYYY-MM-DD)' } });
      return;
    }

    const [bot] = await db
      .select({ companyId: chatbots.companyId })
      .from(chatbots)
      .where(eq(chatbots.id, chatbotId as string));

    if (!bot) {
      res.status(404).json({ error: { message: 'Chatbot not found' } });
      return;
    }

    const result = await availabilityService.getAvailableSlots(
      bot.companyId,
      String(date),
      projectId ? String(projectId) : undefined,
      agentId ? String(agentId) : undefined,
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

chatbotsRouter.post('/:chatbotId/book-visit', (req, res, next) => {
  appointmentsController.bookVisitFromChat(req, res, next);
});

// All remaining routes require authentication and tenant context
chatbotsRouter.use(authenticate, tenantGuard);

chatbotsRouter.post('/translate', async (req, res, next) => {
  try {
    const { text, targetLanguage = 'en' } = req.body;
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: { message: 'Text string is required for translation' } });
      return;
    }

    const detected = languageDetectorService.detectLanguage(text);

    // Call model router or offline translation simulator
    const translation = await modelRouter.call({
      tier: TaskTier.FAST,
      companyId: req.companyId!,
      chatbotId: 'translation',
      systemPrompt: `You are a real estate translation assistant. Translate the following visitor text to ${targetLanguage}. Maintain all property names, numbers, and currency units. Output ONLY the translated text.`,
      userMessage: text,
      promptName: 'translate_text',
      promptVersion: 'v13.0',
    });

    let translatedText = translation.text;
    if (translation.provider === 'fallback_offline') {
      if (detected.code === 'hi' || detected.code === 'hi-Latn') {
        if (/price|rate|kitna|कीमत/i.test(text)) {
          translatedText = 'What is the starting price for 3BHK villas and what are the payment plans?';
        } else if (/visit|dekhna|विजिट/i.test(text)) {
          translatedText = 'Can I schedule a private site visit preview this weekend?';
        } else if (/brochure|ब्रोशर/i.test(text)) {
          translatedText = 'Can I receive the master brochure and floor plans on WhatsApp?';
        } else {
          translatedText = `[Translated from ${detected.name}]: ${text}`;
        }
      } else {
        translatedText = `[Translated from ${detected.name}]: ${text}`;
      }
    }

    res.json({
      success: true,
      data: {
        originalText: text,
        translatedText,
        detectedLanguage: detected.code,
        detectedLanguageName: detected.name,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Read endpoints
chatbotsRouter.get('/', (req, res, next) => {
  chatbotsController.list(req, res, next);
});

chatbotsRouter.get('/:id', (req, res, next) => {
  chatbotsController.getById(req, res, next);
});

// Mutating endpoints require 'manage_chatbots' permission
chatbotsRouter.post(
  '/',
  requirePermission('manage_chatbots'),
  enforcePlanLimit('chatbots'),
  (req, res, next) => {
    chatbotsController.create(req, res, next);
  },
);

chatbotsRouter.put('/:id', requirePermission('manage_chatbots'), (req, res, next) => {
  chatbotsController.update(req, res, next);
});

chatbotsRouter.patch('/:id/status', requirePermission('manage_chatbots'), (req, res, next) => {
  chatbotsController.updateStatus(req, res, next);
});

chatbotsRouter.post('/:id/duplicate', requirePermission('manage_chatbots'), (req, res, next) => {
  chatbotsController.duplicate(req, res, next);
});

chatbotsRouter.post('/:id/rotate-key', requirePermission('manage_chatbots'), (req, res, next) => {
  chatbotsController.rotateKey(req, res, next);
});

// CSV export of a chatbot's leads (also works after the chatbot was soft-deleted)
chatbotsRouter.get('/:id/leads/export', requirePermission('view_leads'), (req, res, next) => {
  chatbotsController.exportLeads(req, res, next);
});

chatbotsRouter.delete('/:id', requirePermission('manage_chatbots'), (req, res, next) => {
  chatbotsController.delete(req, res, next);
});
