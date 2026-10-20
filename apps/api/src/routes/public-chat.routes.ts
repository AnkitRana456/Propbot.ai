import { Router } from 'express';
import { publicChatController } from '../modules/chat/public-chat.controller.js';
import { otpRateLimiter, publicChatRateLimiter, publicSessionRateLimiter } from '../middlewares/rate-limiter.js';

export const publicChatRouter: Router = Router();

// Public widget configuration
publicChatRouter.get('/config/:publicKey', (req, res, next) => {
  publicChatController.getConfig(req, res, next);
});

// Initialize or resume public chat session
publicChatRouter.post('/session', publicSessionRateLimiter.middleware(), (req, res, next) => {
  publicChatController.createSession(req, res, next);
});

// Send message (supports SSE streaming via stream=true)
publicChatRouter.post('/message', publicChatRateLimiter.middleware(), (req, res, next) => {
  publicChatController.sendMessage(req, res, next);
});

// Lead capture from widget
publicChatRouter.post('/lead', (req, res, next) => {
  publicChatController.captureLead(req, res, next);
});

// SMS OTP verification (rate limited: each send costs money)
publicChatRouter.post('/otp/send', otpRateLimiter.middleware(), (req, res, next) => {
  publicChatController.sendOtp(req, res, next);
});
publicChatRouter.post('/otp/verify', otpRateLimiter.middleware(), (req, res, next) => {
  publicChatController.verifyOtp(req, res, next);
});

// Brochure download (lead-gated when requireLeadCapture is on)
publicChatRouter.post('/brochure', (req, res, next) => {
  publicChatController.downloadBrochure(req, res, next);
});

// Message history for session
publicChatRouter.get('/history', (req, res, next) => {
  publicChatController.getHistory(req, res, next);
});
