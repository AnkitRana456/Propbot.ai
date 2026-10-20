import { Router } from 'express';
import { knowledgeController } from '../modules/knowledge/knowledge.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { tenantGuard } from '../middlewares/tenant-guard.js';
import { requirePermission } from '../middlewares/rbac.js';
import { uploadRateLimiter } from '../middlewares/rate-limiter.js';

export const knowledgeRouter: Router = Router({ mergeParams: true });

// All routes require authentication & company tenant isolation
knowledgeRouter.use(authenticate, tenantGuard);

// 1. Source CRUD endpoints
knowledgeRouter.get(['/', '/sources'], (req, res, next) => {
  knowledgeController.listSources(req, res, next);
});

knowledgeRouter.get('/sources/:sourceId', (req, res, next) => {
  knowledgeController.getSourceById(req, res, next);
});

knowledgeRouter.post(['/text', '/sources/text'], requirePermission('train_chatbots'), (req, res, next) => {
  knowledgeController.createTextSource(req, res, next);
});

knowledgeRouter.post(['/qa', '/sources/qa'], requirePermission('train_chatbots'), (req, res, next) => {
  knowledgeController.createQaSource(req, res, next);
});

knowledgeRouter.post(['/crawl', '/sources/crawl'], requirePermission('train_chatbots'), (req, res, next) => {
  knowledgeController.createCrawlSource(req, res, next);
});

knowledgeRouter.post(['/upload', '/sources/upload'], requirePermission('train_chatbots'), uploadRateLimiter.middleware(), (req, res, next) => {
  knowledgeController.uploadFileSource(req, res, next);
});

knowledgeRouter.post(
  ['/sources/:sourceId/re-train', '/sources/:sourceId/retrain'],
  requirePermission('train_chatbots'),
  (req, res, next) => {
    knowledgeController.reTrainSource(req, res, next);
  },
);

knowledgeRouter.delete('/sources/:sourceId', requirePermission('train_chatbots'), (req, res, next) => {
  knowledgeController.deleteSource(req, res, next);
});

// 2. Split-screen RAG Test Query
knowledgeRouter.post(['/test-query', '/query'], (req, res, next) => {
  knowledgeController.testQuery(req, res, next);
});

// 3. Fine-Tune Loop: Q&A Overrides (beats vector retrieval)
knowledgeRouter.get('/overrides', (req, res, next) => {
  knowledgeController.listQaOverrides(req, res, next);
});

knowledgeRouter.post('/overrides', requirePermission('train_chatbots'), (req, res, next) => {
  knowledgeController.createQaOverride(req, res, next);
});

knowledgeRouter.delete('/overrides/:overrideId', requirePermission('train_chatbots'), (req, res, next) => {
  knowledgeController.deleteQaOverride(req, res, next);
});

// 4. Fine-Tune Loop: Unanswered Questions Inbox
knowledgeRouter.get('/unanswered', (req, res, next) => {
  knowledgeController.listUnanswered(req, res, next);
});

knowledgeRouter.post(
  ['/unanswered/:questionId/answer', '/unanswered/:questionId/resolve'],
  requirePermission('train_chatbots'),
  (req, res, next) => {
    knowledgeController.resolveUnanswered(req, res, next);
  },
);
