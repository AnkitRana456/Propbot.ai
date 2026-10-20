import type { Request, Response, NextFunction } from 'express';
import {
  createChatbotSchema,
  updateChatbotSchema,
  updateChatbotStatusSchema,
} from '@propbot/shared';
import { leadsExportService } from './leads-export.service.js';
import { chatbotsService } from './chatbots.service.js';

export class ChatbotsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const { status, type, search } = req.query as {
        status?: string;
        type?: string;
        search?: string;
      };

      const result = await chatbotsService.listChatbots(companyId, { status, type, search });
      res.status(200).json({
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const { id } = req.params;
      const result = await chatbotsService.getChatbotById(companyId, id!);
      res.status(200).json({
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const validated = createChatbotSchema.parse(req.body);
      const result = await chatbotsService.createChatbot(companyId, validated);
      res.status(201).json({
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const { id } = req.params;
      const validated = updateChatbotSchema.parse(req.body);
      const result = await chatbotsService.updateChatbot(companyId, id!, validated);
      res.status(200).json({
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const { id } = req.params;
      const { status } = updateChatbotStatusSchema.parse(req.body);
      const result = await chatbotsService.updateStatus(companyId, id!, status);
      res.status(200).json({
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async duplicate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const { id } = req.params;
      const result = await chatbotsService.duplicateChatbot(companyId, id!);
      res.status(201).json({
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async rotateKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const { id } = req.params;
      const result = await chatbotsService.rotatePublicKey(companyId, id!);
      res.status(200).json({
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async exportLeads(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const result = await leadsExportService.exportChatbotLeadsCsv(companyId, req.params.id!);
      if (!result) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Chatbot not found.' } });
        return;
      }
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.setHeader('X-Lead-Count', String(result.count));
      res.status(200).send(result.csv);
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const { id } = req.params;
      await chatbotsService.deleteChatbot(companyId, id!);
      // Soft delete: the chatbot is hidden and stops serving visitors, but its leads and conversations
      // are kept (never cascaded). The export below stays available for the deleted chatbot.
      res.status(200).json({
        message: 'Chatbot deleted successfully. Its leads and conversations were kept.',
        leadsRetained: true,
        exportUrl: `/api/chatbots/${id}/leads/export`,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const chatbotsController = new ChatbotsController();
