import type { Request, Response, NextFunction } from 'express';
import {
  createTextSourceSchema,
  createCrawlSourceSchema,
  createQaSourceSchema,
  createQaOverrideSchema,
  resolveUnansweredSchema,
  ragQuerySchema,
} from '@propbot/shared';
import { knowledgeService } from './knowledge.service.js';
import { retrievalService } from '../ai/retrieval.service.js';

export class KnowledgeController {
  async listSources(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const { id: chatbotId } = req.params;
      const result = await knowledgeService.listSources(companyId, chatbotId!);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getSourceById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const { id: chatbotId, sourceId } = req.params;
      const result = await knowledgeService.getSourceById(companyId, chatbotId!, sourceId!);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async createTextSource(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const { id: chatbotId } = req.params;
      const validated = createTextSourceSchema.parse(req.body);
      const result = await knowledgeService.createTextSource(companyId, chatbotId!, validated);
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async createQaSource(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const { id: chatbotId } = req.params;
      const validated = createQaSourceSchema.parse(req.body);
      const result = await knowledgeService.createQaSource(companyId, chatbotId!, validated);
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async createCrawlSource(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const { id: chatbotId } = req.params;
      const validated = createCrawlSourceSchema.parse(req.body);
      const result = await knowledgeService.createCrawlSource(companyId, chatbotId!, validated);
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async uploadFileSource(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const { id: chatbotId } = req.params;
      const { title, fileName, mimeType, fileBase64, content } = req.body;

      if (!title || typeof title !== 'string') {
        res.status(400).json({ error: { message: 'Title is required' } });
        return;
      }

      let buffer: Buffer;
      if (fileBase64 && typeof fileBase64 === 'string') {
        const base64Data = fileBase64.replace(/^data:[^;]+;base64,/, '');
        buffer = Buffer.from(base64Data, 'base64');
      } else if (content && typeof content === 'string') {
        buffer = Buffer.from(content, 'utf-8');
      } else {
        res.status(400).json({ error: { message: 'File content or fileBase64 is required' } });
        return;
      }

      const result = await knowledgeService.createFileSource(
        companyId,
        chatbotId!,
        title,
        buffer,
        fileName || `${title}.txt`,
        mimeType,
      );
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async reTrainSource(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const { id: chatbotId, sourceId } = req.params;
      const result = await knowledgeService.reTrainSource(companyId, chatbotId!, sourceId!);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async deleteSource(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const { id: chatbotId, sourceId } = req.params;
      await knowledgeService.deleteSource(companyId, chatbotId!, sourceId!);
      res.status(200).json({ message: 'Knowledge source deleted successfully' });
    } catch (err) {
      next(err);
    }
  }

  async testQuery(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const { id: chatbotId } = req.params;
      const validated = ragQuerySchema.parse(req.body);
      const result = await retrievalService.query(companyId, chatbotId!, validated);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async listQaOverrides(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const { id: chatbotId } = req.params;
      const result = await knowledgeService.listQaOverrides(companyId, chatbotId!);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async createQaOverride(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const { id: chatbotId } = req.params;
      const validated = createQaOverrideSchema.parse(req.body);
      const result = await knowledgeService.createQaOverride(companyId, chatbotId!, validated);
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async deleteQaOverride(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const { id: chatbotId, overrideId } = req.params;
      await knowledgeService.deleteQaOverride(companyId, chatbotId!, overrideId!);
      res.status(200).json({ message: 'Q&A override deleted successfully' });
    } catch (err) {
      next(err);
    }
  }

  async listUnanswered(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const { id: chatbotId } = req.params;
      const result = await knowledgeService.listUnanswered(companyId, chatbotId!);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async resolveUnanswered(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.tenant!.companyId;
      const { id: chatbotId, questionId } = req.params;
      const { answer } = resolveUnansweredSchema.parse(req.body);
      await knowledgeService.resolveUnanswered(companyId, chatbotId!, questionId!, answer);
      res.status(200).json({ message: 'Unanswered question resolved into verified Q&A override' });
    } catch (err) {
      next(err);
    }
  }
}

export const knowledgeController = new KnowledgeController();
