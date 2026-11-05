import { and, eq, inArray, sql } from 'drizzle-orm';
import { pino } from 'pino';
import { db } from '../../db/index.js';
import { deliveryJobs, users, chatbots } from '../../db/schema/index.js';
import { sendMail, isSmtpConfigured, escapeHtml } from './mailer.js';
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

interface BatchedLead {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  source: string;
  createdAt: Date;
  reminderLabel: string;
  reminderKey: string;
}

function buildBatchedReminderMail(leads: BatchedLead[], recipients: string[]): MailMessage {
  const count = leads.length;
  const subject = `⏰ ${count} lead${count > 1 ? 's' : ''} need follow-up`;

  const rows = leads.map(l => {
    const daysSince = Math.floor((Date.now() - l.createdAt.getTime()) / 86_400_000);
    return `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;font-weight:600">${escapeHtml(l.name)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6"><a href="tel:${escapeHtml(l.phone)}" style="color:#2563eb">${escapeHtml(l.phone)}</a></td>
      <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;color:#6b7280">${escapeHtml(l.reminderLabel)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;text-align:right;color:#6b7280">${daysSince}d</td>
    </tr>`;
  }).join('');

  const textLines = leads.map(l => {
    const daysSince = Math.floor((Date.now() - l.createdAt.getTime()) / 86_400_000);
    return `• ${l.name} (${l.phone}) — ${l.reminderLabel} — ${daysSince} day(s)`;
  });

  const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#f59e0b;padding:12px 20px;border-radius:8px 8px 0 0">
    <h2 style="margin:0;color:#fff;font-size:16px">⏰ ${count} Lead${count > 1 ? 's' : ''} Need Follow-up</h2>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;padding:20px;border-radius:0 0 8px 8px">
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="background:#f9fafb">
          <th style="padding:8px 10px;text-align:left;color:#6b7280;font-weight:500">Name</th>
          <th style="padding:8px 10px;text-align:left;color:#6b7280;font-weight:500">Phone</th>
          <th style="padding:8px 10px;text-align:left;color:#6b7280;font-weight:500">Reminder</th>
          <th style="padding:8px 10px;text-align:right;color:#6b7280;font-weight:500">Age</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:#9ca3af">Sent by PropBot Pro • Follow-up Automation</p>
  </div>
</div>`;

  const text = [`${count} lead(s) need follow-up:`, '', ...textLines].join('\n');
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
   * Sweeps all companies' leads and sends ONE batched email per company listing all
   * leads due for day-1, day-3, or day-7 follow-up. Unique DB index prevents re-sends.
   */
  async sweep(): Promise<{ enqueued: number; sent: number }> {
    if (!isSmtpConfigured()) return { enqueued: 0, sent: 0 };

    // Collect all due leads across all reminder intervals
    type DueRow = {
      id: string; company_id: string; name: string; phone: string;
      email: string | null; source: string; created_at: string;
      chatbot_id: string | null; reminder_key: string; reminder_label: string;
    };

    const allDue: DueRow[] = [];

    for (const reminder of REMINDER_DAYS) {
      const windowStart = new Date(Date.now() - (reminder.days * 86_400_000) - 7_200_000);
      const windowEnd   = new Date(Date.now() - (reminder.days * 86_400_000) + 7_200_000);

      const result = await db.execute(sql`
        SELECT l.id, l.company_id, l.source, l.created_at,
               l.chatbot_id,
               c.first_name || ' ' || COALESCE(c.last_name, '') AS name,
               c.phone, c.email,
               ${reminder.key}  AS reminder_key,
               ${reminder.label} AS reminder_label
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

      const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as DueRow[];
      allDue.push(...rows);
    }

    if (allDue.length === 0) return { enqueued: 0, sent: 0 };

    // Group by company
    const byCompany = new Map<string, DueRow[]>();
    for (const row of allDue) {
      const list = byCompany.get(row.company_id) ?? [];
      list.push(row);
      byCompany.set(row.company_id, list);
    }

    let enqueued = 0;
    let sent = 0;

    for (const [companyId, rows] of byCompany) {
      try {
        const recipients = await getRecipients(companyId, rows[0]!.chatbot_id);
        if (recipients.length === 0) continue;

        const batchedLeads: BatchedLead[] = rows.map(r => ({
          id: r.id,
          name: r.name,
          phone: r.phone,
          email: r.email,
          source: r.source,
          createdAt: new Date(r.created_at),
          reminderLabel: r.reminder_label,
          reminderKey: r.reminder_key,
        }));

        // Insert delivery_jobs for each lead (dedup guard)
        for (const lead of batchedLeads) {
          await db.insert(deliveryJobs).values({
            companyId,
            leadId: lead.id,
            kind: 'lead_followup_reminder',
            provider: lead.reminderKey,
            payload: { lead, recipients, reminderKey: lead.reminderKey, reminderLabel: lead.reminderLabel },
            status: 'pending',
            maxAttempts: 2,
          }).onConflictDoNothing();
        }

        const mail = buildBatchedReminderMail(batchedLeads, recipients);
        const result = await sendMail(mail);

        if (result.sent) {
          const leadIds = batchedLeads.map(l => l.id);
          await db.execute(sql`
            UPDATE delivery_jobs SET status = 'success', attempts = 1, updated_at = now()
            WHERE lead_id = ANY(${leadIds}::uuid[]) AND kind = 'lead_followup_reminder'
          `);
          sent++;
          log.info({ companyId, leadCount: leadIds.length, recipients }, 'Batched follow-up reminder email sent.');
        }

        // WhatsApp: send per-lead (best-effort)
        for (const lead of batchedLeads) {
          const daysSince = Math.floor((Date.now() - lead.createdAt.getTime()) / 86_400_000);
          await sendWhatsAppReminder(lead.phone, lead.name, lead.reminderLabel, daysSince);
        }

        enqueued += batchedLeads.length;
      } catch (err) {
        log.error({ err, companyId }, 'Failed to send batched follow-up reminder.');
      }
    }

    return { enqueued, sent };
  }
}

export const leadFollowupReminderService = new LeadFollowupReminderService();
