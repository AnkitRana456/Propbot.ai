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
import { mcpRouter } from './routes/mcp.routes.js';
import { enterpriseRouter, statusRouter } from './routes/enterprise.routes.js';
import { authRateLimiter } from './middlewares/rate-limiter.js';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});

export function createApp(): Express {
  const app = express();

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

  app.use(
    express.json({
      limit: '1mb',
      verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: true }));

  // Routes
  app.use('/healthz', healthzRouter);
  app.use('/api/auth', authRateLimiter.middleware(), authRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/chatbots/playbooks', playbooksRouter);
  app.use('/api/chatbots/:id/playbooks', playbooksRouter);
  app.use('/api/chatbots/:id/knowledge', knowledgeRouter);
  app.use('/api/chatbots', chatbotsRouter);
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
