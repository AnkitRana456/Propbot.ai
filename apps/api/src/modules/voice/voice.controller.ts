import type { Request, Response, NextFunction } from 'express';
import { voiceService } from './voice.service.js';
import { manualCallLogSchema, telephonyWebhookPayloadSchema } from '@propbot/shared';
import { z } from 'zod';

const initiateCallbackSchema = z.object({
  leadId: z.string().uuid(),
  customGreeting: z.string().optional(),
  bypassCallingHours: z.boolean().optional(),
});

export class VoiceController {
  /**
   * POST /api/voice/callback
   * Triggers an automated callback to the given lead.
   */
  async initiateCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const parsed = initiateCallbackSchema.parse(req.body);

      const result = await voiceService.initiateCallback(companyId, parsed.leadId, {
        bypassCallingHours: parsed.bypassCallingHours,
        customGreeting: parsed.customGreeting,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/voice/manual-log
   * Manually logs an agent call in CRM with duration and notes.
   */
  async logManualCall(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const userId = req.user?.id;
      const data = manualCallLogSchema.parse(req.body);

      const record = await voiceService.logManualCall(companyId, userId, data);

      res.status(201).json({
        success: true,
        data: record,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/voice/calls
   * Lists call history records under company RLS.
   */
  async listCalls(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const leadId = typeof req.query.leadId === 'string' ? req.query.leadId : undefined;

      const calls = await voiceService.listCalls(companyId, leadId);

      res.status(200).json({
        success: true,
        data: calls,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/voice/webhooks/status
   * Telephony provider webhook callback for call status, recording, and transcripts.
   */
  async handleTelephonyWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = telephonyWebhookPayloadSchema.parse(req.body);
      const result = await voiceService.handleTelephonyWebhook(payload);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const voiceController = new VoiceController();
