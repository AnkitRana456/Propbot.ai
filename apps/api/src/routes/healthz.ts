import { Router, type Request, type Response } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';

export const healthzRouter: Router = Router();

// Liveness probe (cheap memory and uptime check)
healthzRouter.get('/', (_req: Request, res: Response) => {
  const memoryUsage = process.memoryUsage();

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    service: 'propbot-api',
    version: '1.0.0',
    environment: process.env.NODE_ENV ?? 'development',
    memory: {
      rssMb: Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100,
      heapUsedMb: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
      heapTotalMb: Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100,
    },
  });
});

// Readiness probe (verifies database and downstream services)
healthzRouter.get('/ready', async (_req: Request, res: Response) => {
  try {
    // Check PostgreSQL connection
    await db.execute(sql`SELECT 1`);

    res.status(200).json({
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: err instanceof Error ? err.message : 'Database check failed',
      timestamp: new Date().toISOString(),
    });
  }
});
