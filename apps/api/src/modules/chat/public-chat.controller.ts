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

        res.write(
          `data: ${JSON.stringify({ done: true, reply: result.reply, aiOffline: result.aiOffline, media: result.media })}\n\n`,
        );
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

      if (!token) {
        res.status(401).json({
          error: { message: 'Session token is required to capture lead' },
        });
        return;
      }

      const session = publicChatService.verifySessionToken(token);
      const conversationId = (req.body.conversationId as string) || session.conversationId;
      const fullName = (req.body.fullName as string) || (req.body.name as string);
      const phone = req.body.phone as string;
      const email = req.body.email as string | undefined;
      const preferences = req.body.preferences as Record<string, unknown> | undefined;

      if (!fullName || !phone) {
        res.status(400).json({
          error: { message: 'fullName (or name) and phone are required' },
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
        utmParams: req.body.utmParams as Record<string, unknown> | undefined,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  private bearerOrBody(req: Request): string | undefined {
    const authHeader = req.headers.authorization;
    return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : (req.body.token as string | undefined);
  }

  private conversationIdFor(req: Request, token: string): string {
    return (req.body.conversationId as string) || publicChatService.verifySessionToken(token).conversationId;
  }

  async sendOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = this.bearerOrBody(req);
      if (!token || !req.body.phone) {
        res.status(400).json({ error: { message: 'token and phone are required' } });
        return;
      }
      const result = await publicChatService.sendOtp({
        token,
        conversationId: this.conversationIdFor(req, token),
        phone: req.body.phone as string,
      });
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = this.bearerOrBody(req);
      if (!token || !req.body.phone || !req.body.code) {
        res.status(400).json({ error: { message: 'token, phone and code are required' } });
        return;
      }
      const result = await publicChatService.verifyOtp({
        token,
        conversationId: this.conversationIdFor(req, token),
        phone: req.body.phone as string,
        code: String(req.body.code),
      });
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async downloadBrochure(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = this.bearerOrBody(req);
      if (!token || !req.body.brochureId) {
        res.status(400).json({ error: { message: 'token and brochureId are required' } });
        return;
      }
      const result = await publicChatService.downloadBrochure({
        token,
        conversationId: this.conversationIdFor(req, token),
        brochureId: req.body.brochureId as string,
        fullName: (req.body.fullName as string) || (req.body.name as string),
        phone: req.body.phone as string | undefined,
        email: req.body.email as string | undefined,
        utmParams: req.body.utmParams as Record<string, unknown> | undefined,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
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
