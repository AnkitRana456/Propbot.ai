import { Router } from 'express';
import { publicChatController } from '../modules/chat/public-chat.controller.js';

export const publicChatRouter: Router = Router();

// Public widget configuration
publicChatRouter.get('/config/:publicKey', (req, res, next) => {
  publicChatController.getConfig(req, res, next);
});

// Initialize or resume public chat session
publicChatRouter.post('/session', (req, res, next) => {
  publicChatController.createSession(req, res, next);
});

// Send message (supports SSE streaming via stream=true)
publicChatRouter.post('/message', (req, res, next) => {
  publicChatController.sendMessage(req, res, next);
});

// Lead capture from widget
publicChatRouter.post('/lead', (req, res, next) => {
  publicChatController.captureLead(req, res, next);
});

// Message history for session
publicChatRouter.get('/history', (req, res, next) => {
  publicChatController.getHistory(req, res, next);
});
