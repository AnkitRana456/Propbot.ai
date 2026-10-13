import type { Request, Response, NextFunction } from 'express';
import {
  updateWhatsappConfigSchema,
  whatsappConversationFilterSchema,
  sendInboxMessageSchema,
  broadcastCampaignSchema,
} from '@propbot/shared';
import { whatsappService } from './whatsapp.service.js';

export class WhatsAppController {
  /**
   * GET /api/whatsapp/config
   */
  async getConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const data = await whatsappService.getConfig(companyId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/whatsapp/config
   */
  async updateConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const validated = updateWhatsappConfigSchema.parse(req.body);
      const data = await whatsappService.updateConfig(companyId, validated);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/whatsapp/config/generate-token
   */
  async generateVerifyToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const data = await whatsappService.generateVerifyToken(companyId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/whatsapp/overview
   */
  async getOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const data = await whatsappService.getOverviewKpi(companyId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/whatsapp/conversations
   */
  async listConversations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const filters = whatsappConversationFilterSchema.parse(req.query);
      const currentUserId = req.tenant!.userId;
      const data = await whatsappService.listConversations(companyId, filters, currentUserId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/whatsapp/conversations/:id
   */
  async getConversationDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const conversationId = req.params.id as string;
      const data = await whatsappService.getConversationDetail(companyId, conversationId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/whatsapp/conversations/:id/messages
   */
  async sendAgentMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const conversationId = req.params.id as string;
      const agentId = req.tenant!.userId;
      const validated = sendInboxMessageSchema.parse(req.body);
      const data = await whatsappService.sendAgentMessage(companyId, conversationId, agentId, validated);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/whatsapp/conversations/:id/takeover
   */
  async takeover(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const conversationId = req.params.id as string;
      const agentId = req.tenant!.userId;
      const data = await whatsappService.takeoverConversation(companyId, conversationId, agentId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/whatsapp/conversations/:id/resume-ai
   */
  async resumeAi(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const conversationId = req.params.id as string;
      const data = await whatsappService.resumeAi(companyId, conversationId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/whatsapp/conversations/:id/assign
   */
  async assign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const conversationId = req.params.id as string;
      const { agentId } = req.body as { agentId: string };
      if (!agentId) {
        res.status(400).json({ error: { message: 'agentId is required' } });
        return;
      }
      const data = await whatsappService.assignConversation(companyId, conversationId, agentId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/whatsapp/conversations/:id/close
   */
  async close(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const conversationId = req.params.id as string;
      const data = await whatsappService.closeConversation(companyId, conversationId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/whatsapp/campaigns/broadcast
   */
  async broadcastCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const validated = broadcastCampaignSchema.parse(req.body);
      const data = await whatsappService.broadcastCampaign(companyId, validated);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/webhooks/meta (Public Webhook verification)
   */
  async verifyWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const challenge = await whatsappService.verifyWebhook(req.query as Record<string, unknown>);
      if (challenge) {
        res.status(200).send(challenge);
      } else {
        res.status(403).send('Forbidden: Invalid webhook verify token');
      }
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/webhooks/meta (Public Webhook receiver)
   */
  async processWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const signature = (req.headers['x-hub-signature-256'] as string) || '';
      // Support rawBody buffer if attached by express verify, else fall back to JSON string
      const rawBody = (req as Request & { rawBody?: Buffer | string }).rawBody || JSON.stringify(req.body);

      // Fast 200 acknowledgment according to Meta protocol specification
      const result = await whatsappService.processWebhook(req.body, rawBody, signature);
      res.status(200).json({ success: true, processedCount: result.processedCount });
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number })?.statusCode || 500;
      if (statusCode === 401 || statusCode === 404) {
        res.status(statusCode).json({ error: { message: (err as Error).message } });
        return;
      }
      next(err);
    }
  }

  /**
   * POST /api/whatsapp/config/quick-connect
   */
  async quickConnect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const data = await whatsappService.quickConnectSandbox(companyId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/whatsapp/simulate-inbound
   */
  async simulateInbound(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const { phone, name, text, isVoiceNote } = req.body;
      if (!phone || !text) {
        res.status(400).json({ error: { message: 'Phone and text are required for inbound simulation' } });
        return;
      }
      const data = await whatsappService.simulateInboundMessage(companyId, {
        phone: String(phone),
        name: name ? String(name) : undefined,
        text: String(text),
        isVoiceNote: Boolean(isVoiceNote),
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

export const whatsappController = new WhatsAppController();
