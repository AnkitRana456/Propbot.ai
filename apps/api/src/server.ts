import 'dotenv/config';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pino } from 'pino';
import { healthzRouter } from './routes/healthz.js';
import { authRouter } from './routes/auth.routes.js';
import { dashboardRouter } from './routes/dashboard.routes.js';
import { chatbotsRouter } from './routes/chatbots.routes.js';
import { knowledgeRouter } from './routes/knowledge.routes.js';
import { playbooksRouter } from './routes/playbooks.routes.js';
import { leadsRouter } from './routes/leads.routes.js';
import { crmRouter } from './routes/crm.routes.js';
import { copilotRouter } from './routes/copilot.routes.js';
import { propertiesRouter } from './routes/properties.routes.js';
import { shortlistRoomRouter } from './routes/shortlist-room.routes.js';
import { appointmentsRouter } from './routes/appointments.routes.js';
import { whatsappRouter } from './routes/whatsapp.routes.js';
import { webhooksRouter } from './routes/webhooks.routes.js';
import { webhooksManageRouter } from './routes/webhooks-manage.routes.js';
import { integrationsRouter } from './routes/integrations.routes.js';
import { analyticsRouter } from './routes/analytics.routes.js';
import { usersRouter } from './routes/users.routes.js';
import { agencyRouter } from './routes/agency.routes.js';
import { subscriptionRouter } from './routes/subscription.routes.js';
import { settingsRouter } from './routes/settings.routes.js';
import { docsRouter } from './routes/docs.routes.js';
import { approvalsRouter } from './routes/approvals.routes.js';
import { eventsRouter } from './routes/events.routes.js';
import { workflowsRouter } from './routes/workflows.routes.js';
import { growthRouter } from './routes/growth.routes.js';
import { voiceRouter } from './routes/voice.routes.js';
import { voiceStudioRouter } from './routes/voice-studio.routes.js';
import { mcpRouter } from './routes/mcp.routes.js';
import { enterpriseRouter, statusRouter } from './routes/enterprise.routes.js';
import { publicChatRouter } from './routes/public-chat.routes.js';
import { authRateLimiter, generalApiRateLimiter, tenantApiRateLimiter } from './middlewares/rate-limiter.js';
import { cronRouter } from './routes/cron.routes.js';
import { paymentsRouter } from './routes/payments.routes.js';
import { controlsRouter, publicControlsRouter } from './routes/controls.routes.js';
import { tagsRouter, groupsRouter, customer360Router, surveysRouter, dashboardsRouter, boardsRouter, kbTesterRouter } from './routes/intelligence.routes.js';
import { inboxRouter, leadSourcesRouter, channelsRouter, omnichannelPublicRouter } from './routes/omnichannel.routes.js';
import { flowsRouter, executionsRouter } from './routes/flows.routes.js';
import { toolsRouter, actionsRouter } from './routes/tools.routes.js';
import { agentsRouter, formsRouter, knowledgeReferencesRouter } from './routes/agents.routes.js';
import { cronOrAdmin } from './middlewares/cron-auth.js';
import { leadsController } from './modules/leads/leads.controller.js';
import { validateEnv, getMaskedConfigSummary } from './config/env.js';

// Validate environment variables at startup
validateEnv();

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});

if (process.env.NODE_ENV !== 'test') {
  logger.info({ config: getMaskedConfigSummary() }, 'PropBot Pro environment configuration validated');
}

export function createApp(): Express {
  const app = express();

  // Behind a reverse proxy set TRUSTED_PROXY_HOPS (e.g. 1) so req.ip reflects the client,
  // otherwise rate limits would key on the proxy address (or be spoofable via X-Forwarded-For).
  const proxyHops = Number(process.env.TRUSTED_PROXY_HOPS);
  if (Number.isInteger(proxyHops) && proxyHops > 0) app.set('trust proxy', proxyHops);

  // Request correlation header
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    res.setHeader('X-Request-Id', requestId);
    next();
  });

  // Security headers & CORS
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
      credentials: true,
    }),
  );

  // JSON bodies: 1 MB everywhere, except authenticated knowledge-file uploads. Those carry the file as
  // base64 (10 MB file ~ 13.4 MB of text), so they get a larger parser, but only when an Authorization
  // header is present, so anonymous callers can never make the server buffer a big body.
  const rawBodyCapture = (req: Request & { rawBody?: Buffer }, _res: Response, buf: Buffer) => {
    req.rawBody = buf;
  };
  const smallJson = express.json({ limit: '1mb', verify: rawBodyCapture });
  const uploadJson = express.json({ limit: '14mb', verify: rawBodyCapture });
  const isKnowledgeUpload = (req: Request) =>
    req.method === 'POST' &&
    /^\/api\/chatbots\/[^/]+\/knowledge\/(sources\/)?upload\/?$/.test(req.path) &&
    Boolean(req.headers.authorization);
  app.use((req: Request, res: Response, next: NextFunction) =>
    (isKnowledgeUpload(req) ? uploadJson : smallJson)(req, res, next),
  );
  app.use(express.urlencoded({ extended: true }));

  // General API rate limit (spec: 60 req / min). Skipped for endpoints that have their own limiter or
  // that third parties must always be able to reach (payment / Meta webhooks, health checks).
  const generalAnon = generalApiRateLimiter.middleware();
  const generalAuthed = tenantApiRateLimiter.middleware();
  const generalExempt = /^\/(healthz|auth|public|webhooks|subscription\/webhook|status|cron)(\/|$)/;
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    if (generalExempt.test(req.path)) {
      next();
      return;
    }
    (req.headers.authorization ? generalAuthed : generalAnon)(req, res, next);
  });

  // Routes
  app.use('/healthz', healthzRouter);
  app.use('/api/public/chat', publicChatRouter);
  app.use('/public', publicChatRouter);
  app.use('/api/public/omni', omnichannelPublicRouter);
  // Strict limiter (5 / 15 min) only on credential-guessing endpoints; refresh/me stay unthrottled.
  const strictAuth = authRateLimiter.middleware();
  for (const path of ['/login', '/register', '/forgot-password', '/reset-password']) {
    app.use(`/api/auth${path}`, strictAuth);
  }
  app.use('/api/auth', authRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/chatbots/playbooks', playbooksRouter);
  app.use('/api/chatbots/:id/playbooks', playbooksRouter);
  app.use('/api/chatbots/:id/knowledge', knowledgeRouter);
  app.use('/api/chatbots', chatbotsRouter);
  // Maintenance: CRON_SECRET (scheduler) or ps-owner / company admin only. Registered before the
  // authenticated /api/leads router so a cron call is not rejected by its blanket auth.
  app.post('/api/leads/cleanup-invalid', cronOrAdmin, (req, res, next) =>
    leadsController.cleanupInvalid(req, res, next),
  );
  app.use('/api/cron', cronRouter);
  app.use('/api/agents', agentsRouter);
  app.use('/api/forms', formsRouter);
  app.use('/api/tools', toolsRouter);
  app.use('/api/flows', flowsRouter);
  app.use('/api/inbox', inboxRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/controls', controlsRouter);
  app.use('/api/public/controls', publicControlsRouter);
  app.use('/api/tags', tagsRouter);
  app.use('/api/groups', groupsRouter);
  app.use('/api/customer360', customer360Router);
  app.use('/api/surveys', surveysRouter);
  app.use('/api/dashboards', dashboardsRouter);
  app.use('/api/boards', boardsRouter);
  app.use('/api/kb-tester', kbTesterRouter);
  app.use('/api/lead-sources', leadSourcesRouter);
  app.use('/api/channels', channelsRouter);
  app.use('/api/executions', executionsRouter);
  app.use('/api/actions', actionsRouter);
  app.use('/api/knowledge-references', knowledgeReferencesRouter);
  app.use('/api/leads', leadsRouter);
  app.use('/api/crm', crmRouter);
  app.use('/api/crm', copilotRouter);
  app.use('/api/properties', propertiesRouter);
  app.use('/api/shortlist-room', shortlistRoomRouter);
  app.use('/api/appointments', appointmentsRouter);
  app.use('/api/whatsapp', whatsappRouter);
  app.use('/api/webhooks', webhooksRouter);
  app.use('/api/webhooks', webhooksManageRouter);
  app.use('/api/integrations', integrationsRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/agency', agencyRouter);
  app.use('/api/subscription', subscriptionRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/docs', docsRouter);
  app.use('/api/approvals', approvalsRouter);
  app.use('/api/events', eventsRouter);
  app.use('/api/workflows', workflowsRouter);
  app.use('/api/growth', growthRouter);
  app.use('/api/voice/studio', voiceStudioRouter);
  app.use('/api/voice', voiceRouter);
  app.use('/api/mcp', mcpRouter);
  app.use('/api/enterprise', enterpriseRouter);
  app.use('/api/status', statusRouter);

  // Fallback 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found.',
      },
    });
  });

  // Centralized error handler
  app.use(
    (
      err: Error & { statusCode?: number; code?: string },
      _req: Request,
      res: Response,
      _next: NextFunction,
    ) => {
      const errWithIssues = err as Error & { statusCode?: number; code?: string; issues?: unknown };
      if (err.name === 'ZodError' || errWithIssues.issues) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errWithIssues.issues,
          },
        });
        return;
      }

      const statusCode = err.statusCode ?? 500;
      const code = err.code ?? 'INTERNAL_SERVER_ERROR';
      if (statusCode >= 500) {
        logger.error({ err }, 'Unhandled API error');
      }
      res.status(statusCode).json({
        error: {
          code,
          message: err.message || 'An internal server error occurred.',
        },
      });
    },
  );

  return app;
}

export const app = createApp();

const port = Number(process.env.PORT ?? 3000);

if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(port, () => {
    logger.info({ port }, `PropBot API server running on port ${port}`);
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Graceful shutdown initiated');
    server.close(() => {
      logger.info('HTTP server closed. Exiting process.');
      process.exit(0);
    });

    // Force close after 10s if stuck
    setTimeout(() => {
      logger.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
