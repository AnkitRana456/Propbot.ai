import crypto from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { voiceController } from '../modules/voice/voice.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { tenantGuard } from '../middlewares/tenant-guard.js';
import { requirePermission } from '../middlewares/rbac.js';

/**
 * Telephony callbacks must be signed (HMAC-SHA256 of the raw body in `x-voice-signature`) with VOICE_WEBHOOK_SECRET.
 * Without a secret they are only accepted outside production, so a forgotten setting can never expose the endpoint.
 */
function verifyVoiceWebhook(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.VOICE_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      res.status(503).json({ success: false, error: { code: 'VOICE_WEBHOOK_NOT_CONFIGURED', message: 'Voice webhooks are not configured.' } });
      return;
    }
    next();
    return;
  }
  const raw = (req as Request & { rawBody?: Buffer }).rawBody;
  const got = String(req.headers['x-voice-signature'] ?? '');
  const expected = raw ? crypto.createHmac('sha256', secret).update(raw).digest('hex') : '';
  if (!raw || got.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected))) {
    res.status(401).json({ success: false, error: { code: 'VOICE_WEBHOOK_SIGNATURE_INVALID', message: 'Invalid webhook signature.' } });
    return;
  }
  next();
}

export const voiceRouter: Router = Router();

// 1. Inbound telephony webhook (public callback from telephony provider)
voiceRouter.post('/webhooks/status', verifyVoiceWebhook, (req, res, next) => {
  voiceController.handleTelephonyWebhook(req, res, next);
});

// 2. Authenticated endpoints with tenant isolation
voiceRouter.post(
  '/callback',
  authenticate,
  tenantGuard,
  requirePermission('edit_leads'),
  (req, res, next) => {
    voiceController.initiateCallback(req, res, next);
  },
);

voiceRouter.post(
  '/manual-log',
  authenticate,
  tenantGuard,
  requirePermission('edit_leads'),
  (req, res, next) => {
    voiceController.logManualCall(req, res, next);
  },
);

voiceRouter.get(
  '/calls',
  authenticate,
  tenantGuard,
  requirePermission('view_leads'),
  (req, res, next) => {
    voiceController.listCalls(req, res, next);
  },
);
