import type { Request, Response, NextFunction } from 'express';
import { publicChatService } from './public-chat.service.js';

export class PublicChatController {
  async getConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { publicKey } = req.params;
      if (!publicKey) {
        res.status(400).json({ error: { message: 'Public key is required' } });
        return;
      }
      const config = await publicChatService.getPublicConfig(publicKey);
      res.status(200).json({ success: true, data: config });
    } catch (err) {
      next(err);
    }
  }

  async createSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { publicKey, visitorId, pageUrl, referrer, utmParams, device } = req.body;
      if (!publicKey) {
        res.status(400).json({ error: { message: 'publicKey is required to initiate chat session' } });
        return;
      }

      const origin = req.headers.origin || req.headers.referer;

      const session = await publicChatService.createSession({
        publicKey,
        visitorId,
        pageUrl,
        referrer,
        utmParams,
        device,
        origin,
      });

      res.status(200).json({ success: true, data: session });
    } catch (err) {
      next(err);
    }
  }

  async sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7)
        : (req.body.token as string | undefined);

      const { conversationId, message, stream } = req.body;

      if (!token || !conversationId || !message) {
        res.status(400).json({
          error: { message: 'token, conversationId, and message are required' },
        });
        return;
      }

      const wantsStream =
        stream === true ||
        stream === 'true' ||
        req.headers.accept?.includes('text/event-stream');

      if (wantsStream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders?.();

        const result = await publicChatService.sendMessage({
          token,
          conversationId,
          message,
          onChunk: (chunk: string) => {
            res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
          },
        });

        res.write(`data: ${JSON.stringify({ done: true, reply: result.reply, aiOffline: result.aiOffline })}\n\n`);
        res.end();
        return;
      }

      const result = await publicChatService.sendMessage({
        token,
        conversationId,
        message,
      });

      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async captureLead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7)
        : (req.body.token as string | undefined);

      const { conversationId, fullName, phone, email, preferences } = req.body;

      if (!token || !conversationId || !fullName || !phone) {
        res.status(400).json({
          error: { message: 'token, conversationId, fullName, and phone are required' },
        });
        return;
      }

      const result = await publicChatService.captureLead({
        token,
        conversationId,
        fullName,
        phone,
        email,
        preferences,
      });

      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7)
        : (req.query.token as string | undefined);

      const conversationId = (req.query.conversationId as string) || (req.params.conversationId as string);

      if (!token || !conversationId) {
        res.status(400).json({ error: { message: 'token and conversationId query params are required' } });
        return;
      }

      const history = await publicChatService.getHistory(token, conversationId);
      res.status(200).json({ success: true, data: history });
    } catch (err) {
      next(err);
    }
  }
}

export const publicChatController = new PublicChatController();
