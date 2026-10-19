import 'dotenv/config';
import { pino } from 'pino';

import { appointmentReminderService } from './modules/appointments/appointment-reminder.service.js';
import { outboxProcessorService } from './modules/webhooks/outbox-processor.service.js';
import { outboxDispatcherService } from './modules/events/outbox-dispatcher.service.js';
import { scheduledJobsService } from './jobs/scheduled-jobs.service.js';
import { rollupService } from './modules/analytics/rollup.service.js';
import './modules/crm/next-best-action.service.js';
import { db } from './db/index.js';
import { companies } from './db/schema/index.js';
import { validateEnv } from './config/env.js';

validateEnv();

export const workerLogger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});

workerLogger.info('PropBot Pro background worker process initialized.');

let isRunning = true;

// Outbox dispatcher loop (runs frequently every 5s for fast transactional fan-out)
const outboxInterval = setInterval(async () => {
  if (isRunning) {
    try {
      const { processedCount, errorsCount } = await outboxDispatcherService.processBatch();
      if (processedCount > 0 || errorsCount > 0) {
        workerLogger.info({ processedCount, errorsCount }, 'Processed transactional domain_events outbox batch.');
      }
      const { retriedCount } = await outboxProcessorService.processScheduledRetries();
      if (retriedCount > 0) {
        workerLogger.info({ retriedCount }, 'Dispatched scheduled webhook retries.');
      }
    } catch (err) {
      workerLogger.error({ err }, 'Error during outbox event dispatcher loop.');
    }
  }
}, 5000);

// Appointment reminders sweep loop (runs every 60s)
const reminderInterval = setInterval(async () => {
  if (isRunning) {
    try {
      const { sent24hCount, sent2hCount } = await appointmentReminderService.sweepAndSendReminders();
      if (sent24hCount > 0 || sent2hCount > 0) {
        workerLogger.info({ sent24hCount, sent2hCount }, 'Dispatched scheduled appointment reminders.');
      }
    } catch (err) {
      workerLogger.error({ err }, 'Error during appointment reminder sweep.');
    }
  }
}, 60000);

// Stale T2 approvals expiration loop (runs every 60s)
const approvalExpiryInterval = setInterval(async () => {
  if (isRunning) {
    try {
      const { expiredCount } = await scheduledJobsService.expireStaleApprovals();
      if (expiredCount > 0) {
        workerLogger.info({ expiredCount }, 'Expired stale proposed T2 actions.');
      }
    } catch (err) {
      workerLogger.error({ err }, 'Error during stale approval expiration sweep.');
    }
  }
}, 60000);

// Nightly intent decay & cleanup loop (runs every 30 minutes)
const decayInterval = setInterval(async () => {
  if (isRunning) {
    try {
      const { decayedCount } = await scheduledJobsService.decayIdleLeadScores();
      if (decayedCount > 0) {
        workerLogger.info({ decayedCount }, 'Nightly lead intent score decay executed.');
      }
    } catch (err) {
      workerLogger.error({ err }, 'Error during lead intent score decay job.');
    }
  }
}, 1800000);

// Daily analytics rollups refresh loop (runs every 10 minutes to pre-aggregate stats)
const rollupInterval = setInterval(async () => {
  if (isRunning) {
    try {
      const allCompanies = await db.select({ id: companies.id }).from(companies);
      const todayStr = new Date().toISOString().split('T')[0]!;
      for (const comp of allCompanies) {
        await rollupService.rollupDayForCompany(comp.id, todayStr);
      }
      workerLogger.info({ companiesCount: allCompanies.length }, 'Completed periodic daily analytics rollups.');
    } catch (err) {
      workerLogger.error({ err }, 'Error during daily analytics rollups loop.');
    }
  }
}, 600000);

// Third-party token health check loop (runs hourly to detect expiring credentials)
const tokenHealthInterval = setInterval(async () => {
  if (isRunning) {
    try {
      const { checkedCount, expiringCount } = await scheduledJobsService.checkThirdPartyTokenHealth();
      if (expiringCount > 0) {
        workerLogger.warn({ checkedCount, expiringCount }, 'Found third-party integrations with expiring or stale tokens.');
      }
    } catch (err) {
      workerLogger.error({ err }, 'Error during third-party token health check loop.');
    }
  }
}, 3600000);

const shutdown = (signal: string) => {
  workerLogger.info({ signal }, 'Worker process shutting down gracefully...');
  isRunning = false;
  clearInterval(outboxInterval);
  clearInterval(reminderInterval);
  clearInterval(approvalExpiryInterval);
  clearInterval(decayInterval);
  clearInterval(rollupInterval);
  clearInterval(tokenHealthInterval);
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
