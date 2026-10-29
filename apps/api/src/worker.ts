import 'dotenv/config';
import { pino } from 'pino';

import { appointmentReminderService } from './modules/appointments/appointment-reminder.service.js';
import { leadFollowupReminderService } from './modules/delivery/lead-followup-reminder.service.js';
import { digestReportService } from './modules/delivery/digest-report.service.js';
import { outboxProcessorService } from './modules/webhooks/outbox-processor.service.js';
import { outboxDispatcherService } from './modules/events/outbox-dispatcher.service.js';
import { scheduledJobsService } from './jobs/scheduled-jobs.service.js';
import { deliveryJobsService } from './modules/delivery/delivery-jobs.service.js';
import { paymentsService } from './modules/payments/payments.service.js';
import { callCampaignsService } from './modules/voice/call-campaigns.service.js';
import { flowEngine } from './modules/flows/flow-engine.js';
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
    } catch (err) {
      workerLogger.error({ err }, 'Error during outbox event dispatcher loop.');
    }
  }
}, 5000);

// Webhook delivery loop (every 1s): sends queued webhooks and the 1s/2s/4s retries.
// Kept separate from the outbox loop so slow endpoints (up to 30s) never delay event fan-out.
let webhookLoopBusy = false;
const webhookDeliveryInterval = setInterval(async () => {
  if (!isRunning || webhookLoopBusy) return;
  webhookLoopBusy = true;
  try {
    const { retriedCount } = await outboxProcessorService.processScheduledRetries();
    if (retriedCount > 0) {
      workerLogger.info({ retriedCount }, 'Delivered queued webhook attempts.');
    }
  } catch (err) {
    workerLogger.error({ err }, 'Error during webhook delivery loop.');
  } finally {
    webhookLoopBusy = false;
  }
}, 1000);

// Lead e-mail alerts + CRM sync delivery loop (every 1s, same 1s/2s/4s retry schedule as webhooks)
let deliveryLoopBusy = false;
const deliveryJobsInterval = setInterval(async () => {
  if (!isRunning || deliveryLoopBusy) return;
  deliveryLoopBusy = true;
  try {
    const { processed, succeeded } = await deliveryJobsService.processDue();
    if (processed > 0) {
      workerLogger.info({ processed, succeeded }, 'Processed lead delivery jobs (e-mail / CRM).');
    }
  } catch (err) {
    workerLogger.error({ err }, 'Error during delivery jobs loop.');
  } finally {
    deliveryLoopBusy = false;
  }
}, 1000);

// 30-day chat retention: checked hourly, idempotent (also exposed to external schedulers at /api/cron/archive-chats)
const chatRetentionInterval = setInterval(async () => {
  if (!isRunning) return;
  try {
    const { archived, deleted } = await scheduledJobsService.archiveOldChats();
    if (archived > 0 || deleted > 0) {
      workerLogger.info({ archived, deleted }, 'Chat retention run finished.');
    }
  } catch (err) {
    workerLogger.error({ err }, 'Error during chat retention run.');
  }
}, 60 * 60 * 1000);

// Flow builder: resume waiting executions and fire due schedule triggers (every 15s)
let flowLoopBusy = false;
const flowInterval = setInterval(async () => {
  if (!isRunning || flowLoopBusy) return;
  flowLoopBusy = true;
  try {
    const resumed = await flowEngine.resumeDue();
    const scheduled = await flowEngine.runDueSchedules();
    const expired = await paymentsService.expireStale();
    if (expired > 0) workerLogger.info({ expired }, 'Expired unpaid payment links.');
    const downgraded = await paymentsService.dunningSweep();
    if (downgraded > 0) workerLogger.info({ downgraded }, 'Moved unpaid subscriptions to the trial plan.');
    const calls = await callCampaignsService.tick();
    if (calls > 0) workerLogger.info({ calls }, 'Placed outbound campaign calls.');
    if (resumed > 0 || scheduled > 0) workerLogger.info({ resumed, scheduled }, 'Flow builder sweep finished.');
  } catch (err) {
    workerLogger.error({ err }, 'Error during flow builder sweep.');
  } finally {
    flowLoopBusy = false;
  }
}, 15000);

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
      const { purgedCount } = await scheduledJobsService.purgeExpiredOtps();
      if (purgedCount > 0) {
        workerLogger.info({ purgedCount }, 'Purged expired OTP challenges.');
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

// Lead follow-up reminder sweep (runs hourly: day 1 / day 3 / day 7 after lead creation)
// Also runs once immediately on worker start so restarts don't miss a sweep window.
(async () => {
  try {
    const { enqueued, sent } = await leadFollowupReminderService.sweep();
    if (sent > 0) workerLogger.info({ enqueued, sent }, 'Lead follow-up reminder emails sent (startup sweep).');
  } catch (err) {
    workerLogger.error({ err }, 'Error during startup follow-up reminder sweep.');
  }
})();

let followupBusy = false;
const followupReminderInterval = setInterval(async () => {
  if (!isRunning || followupBusy) return;
  followupBusy = true;
  try {
    const { enqueued, sent } = await leadFollowupReminderService.sweep();
    if (sent > 0) {
      workerLogger.info({ enqueued, sent }, 'Lead follow-up reminder emails sent.');
    }
  } catch (err) {
    workerLogger.error({ err }, 'Error during lead follow-up reminder sweep.');
  } finally {
    followupBusy = false;
  }
}, 60 * 60 * 1000); // hourly

// Weekly/monthly digest report (runs daily at startup check — sends only on Monday or 1st of month)
const digestReportInterval = setInterval(async () => {
  if (isRunning) {
    try {
      const { sent } = await digestReportService.sendDueDigests();
      if (sent > 0) workerLogger.info({ sent }, 'Digest reports sent.');
    } catch (err) {
      workerLogger.error({ err }, 'Error during digest report sweep.');
    }
  }
}, 60 * 60 * 1000); // hourly check, sends only on the right day

// Also run once on startup
(async () => {
  try {
    const { sent } = await digestReportService.sendDueDigests();
    if (sent > 0) workerLogger.info({ sent }, 'Digest reports sent (startup).');
  } catch (err) {
    workerLogger.error({ err }, 'Error during startup digest report sweep.');
  }
})();

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
  clearInterval(webhookDeliveryInterval);
  clearInterval(deliveryJobsInterval);
  clearInterval(flowInterval);
  clearInterval(chatRetentionInterval);
  clearInterval(reminderInterval);
  clearInterval(approvalExpiryInterval);
  clearInterval(decayInterval);
  clearInterval(rollupInterval);
  clearInterval(followupReminderInterval);
  clearInterval(digestReportInterval);
  clearInterval(tokenHealthInterval);
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
