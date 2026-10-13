import { Router } from 'express';
import { whatsappController } from '../modules/whatsapp/whatsapp.controller.js';
import { webhooksController } from '../modules/webhooks/webhooks.controller.js';

export const webhooksRouter: Router = Router();

// Public Meta WhatsApp Cloud API Webhook handshake
webhooksRouter.get('/meta', (req, res, next) => {
  whatsappController.verifyWebhook(req, res, next);
});

// Public Meta WhatsApp Cloud API Webhook event receiver
webhooksRouter.post('/meta', (req, res, next) => {
  whatsappController.processWebhook(req, res, next);
});

// Public / API-key Portal Inbound Lead Ingestion (99acres, MagicBricks, Housing, Meta Ads, Google Ads)
webhooksRouter.post('/inbound/leads', (req, res, next) => {
  webhooksController.inboundLead(req, res, next);
});

