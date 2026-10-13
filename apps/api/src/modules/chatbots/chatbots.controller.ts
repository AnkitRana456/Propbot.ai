import type { Request, Response, NextFunction } from 'express';
import {
  createChatbotSchema,
  updateChatbotSchema,
  updateChatbotStatusSchema,
} from '@propbot/shared';
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

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const { id } = req.params;
      await chatbotsService.deleteChatbot(companyId, id!);
      res.status(200).json({
        message: 'Chatbot deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  }
}

export const chatbotsController = new ChatbotsController();
