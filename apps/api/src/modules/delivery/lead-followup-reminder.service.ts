import { and, eq, inArray, sql } from 'drizzle-orm';
import { pino } from 'pino';
import { db } from '../../db/index.js';
import { deliveryJobs, users, chatbots } from '../../db/schema/index.js';
import { sendMail, isSmtpConfigured, escapeHtml, singleLine } from './mailer.js';
import type { MailMessage } from './mailer.js';

const log = pino({ name: 'lead-followup-reminder', level: process.env.LOG_LEVEL ?? 'info' });

async function sendWhatsAppReminder(
  leadPhone: string,
  leadName: string,
  reminderLabel: string,
  daysSince: number,
): Promise<boolean> {
  // Skip messenger/non-phone leads
  if (!leadPhone || leadPhone.startsWith('messenger:') || leadPhone.startsWith('instagram:')) return false;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
  if (!sid || !token) return false;
  // Format phone to E.164 whatsapp: format
  const digits = leadPhone.replace(/\D/g, '');
  const to = `whatsapp:+${digits.startsWith('91') ? digits : '91' + digits}`;
  try {
    const body = `⏰ *Follow-up Reminder — ${reminderLabel}*\n\nHi, this is an automated reminder from PropBot Pro.\n\n*Lead:* ${leadName}\n*Phone:* ${leadPhone}\n*Lead age:* ${daysSince} day(s)\n\nThis lead has not been contacted yet. Please reach out as soon as possible.`;
    const params = new URLSearchParams({ From: from, To: to, Body: body });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    if (!res.ok) {
      const txt = await res.text();
      log.warn({ status: res.status, txt, to }, 'WhatsApp reminder send failed (non-fatal).');
      return false;
    }
    return true;
  } catch (err) {
    log.warn({ err, to }, 'WhatsApp reminder send failed (non-fatal).');
    return false;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Day intervals at which we send follow-up reminders. */
const REMINDER_DAYS: Array<{ key: string; days: number; label: string }> = [
  { key: 'day_1', days: 1, label: '24-hour follow-up' },
  { key: 'day_3', days: 3, label: '3-day follow-up' },
  { key: 'day_7', days: 7, label: '7-day follow-up' },
];

function buildReminderMail(
  lead: { name: string; phone: string; email: string | null; source: string; createdAt: Date },
  reminderLabel: string,
  recipients: string[],
): MailMessage {
  const daysSince = Math.floor((Date.now() - lead.createdAt.getTime()) / 86_400_000);
  const subject = `⏰ Follow-up reminder: ${singleLine(lead.name)} (${singleLine(lead.phone)})`;
  const text = [
    `Follow-up reminder: ${reminderLabel}`,
    '',
    `Name    : ${lead.name}`,
    `Phone   : ${lead.phone}`,
    `Email   : ${lead.email || '-'}`,
    `Source  : ${lead.source}`,
    `Lead age: ${daysSince} day(s)`,
    '',
    'This lead has not been contacted yet. Please reach out as soon as possible.',
  ].join('\n');

  const html = `
<div style="font-family:sans-serif;max-width:540px;margin:0 auto">
  <div style="background:#f59e0b;padding:12px 20px;border-radius:8px 8px 0 0">
    <h2 style="margin:0;color:#fff;font-size:16px">⏰ Follow-up Reminder — ${escapeHtml(reminderLabel)}</h2>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;padding:20px;border-radius:0 0 8px 8px">
    <p style="color:#374151;margin:0 0 16px">This lead has been waiting for <strong>${daysSince} day(s)</strong> without a follow-up. Please reach out now.</p>
    <table cellpadding="8" style="border-collapse:collapse;width:100%;font-size:13px">
      <tr style="background:#f9fafb"><td style="color:#6b7280;width:120px">Name</td><td style="font-weight:600">${escapeHtml(lead.name)}</td></tr>
      <tr><td style="color:#6b7280">Phone</td><td><a href="tel:${escapeHtml(lead.phone)}" style="color:#2563eb">${escapeHtml(lead.phone)}</a></td></tr>
      <tr style="background:#f9fafb"><td style="color:#6b7280">Email</td><td>${escapeHtml(lead.email || '-')}</td></tr>
      <tr><td style="color:#6b7280">Source</td><td>${escapeHtml(lead.source)}</td></tr>
      <tr style="background:#f9fafb"><td style="color:#6b7280">Lead age</td><td>${daysSince} day(s)</td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:#9ca3af">Sent by PropBot Pro • Follow-up Automation</p>
  </div>
</div>`;

  return { to: recipients, subject, text, html };
}

/** Fetch alert recipients for a lead (chatbot config → env → admin users). */
async function getRecipients(companyId: string, chatbotId: string | null): Promise<string[]> {
  if (chatbotId) {
    const [bot] = await db.select({ config: chatbots.config }).from(chatbots).where(eq(chatbots.id, chatbotId));
    const configured = ((bot?.config as Record<string, unknown> | undefined)?.leadCapture as
      | { alertEmails?: unknown }
      | undefined)?.alertEmails;
    if (Array.isArray(configured)) {
      const valid = configured.filter((e): e is string => typeof e === 'string' && EMAIL_RE.test(e)).slice(0, 10);
      if (valid.length > 0) return valid;
    }
  }
  const envAlert = process.env.LEAD_ALERT_EMAIL;
  if (envAlert && EMAIL_RE.test(envAlert)) return [envAlert];
  const admins = await db
    .select({ email: users.email })
    .from(users)
    .where(
      and(
        eq(users.companyId, companyId),
        eq(users.status, 'active'),
        inArray(users.role, ['company_admin', 'ps-owner']),
        sql`${users.deletedAt} IS NULL`,
      ),
    )
    .limit(10);
  return admins.map(a => a.email).filter(e => EMAIL_RE.test(e));
}

export class LeadFollowupReminderService {
  /**
   * Sweeps all companies' leads and enqueues reminder emails for day 1, 3, 7.
   * Runs hourly in the worker. The unique DB index prevents duplicate sends.
   */
  async sweep(): Promise<{ enqueued: number; sent: number }> {
    if (!isSmtpConfigured()) return { enqueued: 0, sent: 0 };

    let enqueued = 0;
    let sent = 0;

    for (const reminder of REMINDER_DAYS) {
      const windowStart = new Date(Date.now() - (reminder.days * 86_400_000) - 7_200_000); // day X ± 2h window
      const windowEnd   = new Date(Date.now() - (reminder.days * 86_400_000) + 7_200_000);

      // Find leads created in this time window that are still 'new' or 'contacted'
      // and don't already have a reminder job for this day key
      const dueleads = await db.execute(sql`
        SELECT l.id, l.company_id, l.source, l.created_at,
               l.chatbot_id, l.assigned_agent_id,
               c.first_name || ' ' || COALESCE(c.last_name, '') AS name,
               c.phone, c.email
        FROM leads l
        JOIN contacts c ON c.id = l.contact_id
        WHERE l.created_at >= ${windowStart.toISOString()}
          AND l.created_at <  ${windowEnd.toISOString()}
          AND l.status IN ('new', 'contacted')
          AND l.deleted_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM delivery_jobs dj
            WHERE dj.lead_id = l.id
              AND dj.kind = 'lead_followup_reminder'
              AND dj.provider = ${reminder.key}
          )
        LIMIT 100
      `);

      const rows = (Array.isArray(dueleads) ? dueleads : (dueleads as { rows?: unknown[] }).rows || []) as Array<{
        id: string; company_id: string; name: string; phone: string;
        email: string | null; source: string; created_at: string;
        chatbot_id: string | null; assigned_agent_id: string | null;
      }>;

      for (const row of rows) {
        try {
          const recipients = await getRecipients(row.company_id, row.chatbot_id);
          if (recipients.length === 0) continue;

          const leadData = {
            name: row.name,
            phone: row.phone,
            email: row.email,
            source: row.source,
            createdAt: new Date(row.created_at),
          };
          const mail = buildReminderMail(leadData, reminder.label, recipients);

          // Insert job row (unique index silently ignores duplicates)
          await db.insert(deliveryJobs).values({
            companyId: row.company_id,
            leadId: row.id,
            kind: 'lead_followup_reminder',
            provider: reminder.key,
            payload: { lead: leadData, recipients, reminderKey: reminder.key, reminderLabel: reminder.label },
            status: 'pending',
            maxAttempts: 2,
          }).onConflictDoNothing();

          // Send email
          const result = await sendMail(mail);
          if (result.sent) {
            // Mark success
            await db.execute(sql`
              UPDATE delivery_jobs SET status = 'success', attempts = 1, updated_at = now()
              WHERE lead_id = ${row.id} AND kind = 'lead_followup_reminder' AND provider = ${reminder.key}
            `);
            sent++;
            log.info({ leadId: row.id, reminderKey: reminder.key, recipients }, 'Follow-up reminder email sent.');
          }

          // Also send WhatsApp to lead's phone (non-blocking, best-effort)
          const daysSince = Math.floor((Date.now() - new Date(row.created_at).getTime()) / 86_400_000);
          const whatsAppSent = await sendWhatsAppReminder(row.phone, leadData.name, reminder.label, daysSince);
          if (whatsAppSent) {
            log.info({ leadId: row.id, phone: row.phone, reminderKey: reminder.key }, 'Follow-up reminder WhatsApp sent.');
          }

          enqueued++;
        } catch (err) {
          log.error({ err, leadId: row.id, reminderKey: reminder.key }, 'Failed to send follow-up reminder.');
        }
      }
    }

    return { enqueued, sent };
  }
}

export const leadFollowupReminderService = new LeadFollowupReminderService();
