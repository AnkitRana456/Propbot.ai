import { Router } from 'express';
import express from 'express';
import { twilioWhatsAppController } from '../modules/twilio/twilio-whatsapp.controller.js';

export const twilioRouter: Router = Router();

// Twilio sends form-encoded bodies — parse them here before our global JSON parser interferes
twilioRouter.use(express.urlencoded({ extended: false }));

// Public endpoint — Twilio calls this when a WhatsApp message arrives
twilioRouter.post('/whatsapp/webhook', (req, res, next) =>
  twilioWhatsAppController.inbound(req, res, next),
);
