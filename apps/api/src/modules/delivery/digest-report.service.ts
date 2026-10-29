import { and, eq, sql } from 'drizzle-orm';
import { pino } from 'pino';
import { db } from '../../db/index.js';
import { companies, users } from '../../db/schema/index.js';
import { sendMail, isSmtpConfigured, escapeHtml } from './mailer.js';

const log = pino({ name: 'digest-report', level: process.env.LOG_LEVEL ?? 'info' });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface DigestStats {
  totalLeads: number;
  newLeads: number;
  contacted: number;
  qualified: number;
  booked: number;
  lost: number;
  sourceBreakdown: Array<{ source: string; count: number }>;
  topAgents: Array<{ name: string; count: number }>;
}

async function getStatsForPeriod(companyId: string, from: Date, to: Date): Promise<DigestStats> {
  const [totals] = await db.execute(sql`
    SELECT
      COUNT(*)::int AS total_leads,
      COUNT(*) FILTER (WHERE l.created_at >= ${from.toISOString()} AND l.created_at < ${to.toISOString()})::int AS new_leads,
      COUNT(*) FILTER (WHERE l.status = 'contacted')::int AS contacted,
      COUNT(*) FILTER (WHERE l.status IN ('qualified','site_visit_scheduled','site_visit_done','negotiation'))::int AS qualified,
      COUNT(*) FILTER (WHERE l.status = 'booked')::int AS booked,
      COUNT(*) FILTER (WHERE l.status = 'lost')::int AS lost
    FROM leads l
    WHERE l.company_id = ${companyId} AND l.deleted_at IS NULL
  `) as unknown as [{ total_leads: number; new_leads: number; contacted: number; qualified: number; booked: number; lost: number }];

  const sourcesRaw = await db.execute(sql`
    SELECT COALESCE(l.source, 'direct') AS source, COUNT(*)::int AS count
    FROM leads l
    WHERE l.company_id = ${companyId}
      AND l.created_at >= ${from.toISOString()} AND l.created_at < ${to.toISOString()}
      AND l.deleted_at IS NULL
    GROUP BY source ORDER BY count DESC LIMIT 6
  `) as unknown as Array<{ source: string; count: number }>;

  const agentsRaw = await db.execute(sql`
    SELECT COALESCE(u.name, u.email) AS name, COUNT(l.id)::int AS count
    FROM leads l
    JOIN users u ON u.id = l.assigned_agent_id
    WHERE l.company_id = ${companyId}
      AND l.created_at >= ${from.toISOString()} AND l.created_at < ${to.toISOString()}
      AND l.deleted_at IS NULL AND l.assigned_agent_id IS NOT NULL
    GROUP BY u.id, u.name, u.email ORDER BY count DESC LIMIT 5
  `) as unknown as Array<{ name: string; count: number }>;

  const r = totals ?? { total_leads: 0, new_leads: 0, contacted: 0, qualified: 0, booked: 0, lost: 0 };
  return {
    totalLeads: r.total_leads,
    newLeads: r.new_leads,
    contacted: r.contacted,
    qualified: r.qualified,
    booked: r.booked,
    lost: r.lost,
    sourceBreakdown: Array.isArray(sourcesRaw) ? sourcesRaw : (sourcesRaw as { rows?: unknown[] }).rows as typeof sourcesRaw ?? [],
    topAgents: Array.isArray(agentsRaw) ? agentsRaw : (agentsRaw as { rows?: unknown[] }).rows as typeof agentsRaw ?? [],
  };
}

function sourceLabel(s: string): string {
  const l = s.toLowerCase();
  if (l.includes('whatsapp')) return 'WhatsApp';
  if (l.includes('messenger')) return 'Messenger';
  if (l.includes('instagram')) return 'Instagram';
  if (l.includes('csv') || l.includes('import')) return 'CSV Import';
  if (l.includes('form')) return 'Form';
  if (l.includes('chat') || l.includes('widget') || l.includes('web')) return 'Web Chatbot';
  return s.replace(/[_-]/g, ' ');
}

function buildDigestHtml(companyName: string, period: string, stats: DigestStats): string {
  const stat = (label: string, value: number, color = '#374151') =>
    `<td style="text-align:center;padding:12px 8px;border:1px solid #e5e7eb;background:#f9fafb">
      <div style="font-size:22px;font-weight:700;color:${color}">${value}</div>
      <div style="font-size:11px;color:#6b7280;margin-top:2px">${escapeHtml(label)}</div>
    </td>`;

  const sourceRows = stats.sourceBreakdown.map(s =>
    `<tr><td style="padding:6px 12px;border-bottom:1px solid #f3f4f6">${escapeHtml(sourceLabel(s.source))}</td><td style="padding:6px 12px;text-align:right;font-weight:600;border-bottom:1px solid #f3f4f6">${s.count}</td></tr>`
  ).join('');

  const agentRows = stats.topAgents.map(a =>
    `<tr><td style="padding:6px 12px;border-bottom:1px solid #f3f4f6">${escapeHtml(a.name)}</td><td style="padding:6px 12px;text-align:right;font-weight:600;border-bottom:1px solid #f3f4f6">${a.count}</td></tr>`
  ).join('');

  return `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#7c3aed;padding:16px 24px;border-radius:8px 8px 0 0">
    <h1 style="margin:0;color:#fff;font-size:18px">📊 ${escapeHtml(period)} Lead Report</h1>
    <p style="margin:4px 0 0;color:#ddd8fe;font-size:13px">${escapeHtml(companyName)}</p>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">

    <h2 style="margin:0 0 12px;font-size:14px;color:#374151">NEW LEADS THIS PERIOD</h2>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">
      <tr>
        ${stat('New Leads', stats.newLeads, '#7c3aed')}
        ${stat('Contacted', stats.contacted)}
        ${stat('Qualified', stats.qualified, '#059669')}
        ${stat('Booked', stats.booked, '#d97706')}
        ${stat('Lost', stats.lost, '#dc2626')}
      </tr>
    </table>

    ${stats.sourceBreakdown.length > 0 ? `
    <h2 style="margin:20px 0 8px;font-size:14px;color:#374151">LEAD SOURCES</h2>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
      ${sourceRows}
    </table>` : ''}

    ${stats.topAgents.length > 0 ? `
    <h2 style="margin:20px 0 8px;font-size:14px;color:#374151">TOP AGENTS BY LEADS ASSIGNED</h2>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
      ${agentRows}
    </table>` : ''}

    <p style="margin:20px 0 0;font-size:11px;color:#9ca3af">Total active leads in CRM: ${stats.totalLeads} • Sent by PropBot Pro</p>
  </div>
</div>`;
}

export class DigestReportService {
  /**
   * Sends weekly digest (every Monday) or monthly digest (1st of month) to admin users.
   * Called from worker; idempotent per company per period.
   */
  async sendDueDigests(): Promise<{ sent: number }> {
    if (!isSmtpConfigured()) return { sent: 0 };

    const now = new Date();
    const isMonday = now.getDay() === 1;
    const isFirstOfMonth = now.getDate() === 1;

    // Nothing to send today
    if (!isMonday && !isFirstOfMonth) return { sent: 0 };

    let sent = 0;

    const allCompanies = await db
      .select({ id: companies.id, name: companies.name })
      .from(companies);

    for (const company of allCompanies) {
      try {
        // Get admin recipients
        const admins = await db
          .select({ email: users.email })
          .from(users)
          .where(
            and(
              eq(users.companyId, company.id),
              eq(users.status, 'active'),
              sql`${users.deletedAt} IS NULL`,
            ),
          )
          .limit(10);

        const recipients = admins.map(a => a.email).filter(e => EMAIL_RE.test(e));
        if (recipients.length === 0) continue;

        // Weekly: last 7 days; Monthly: last 30 days (on 1st)
        const isMonthly = isFirstOfMonth;
        const days = isMonthly ? 30 : 7;
        const from = new Date(now.getTime() - days * 86_400_000);
        const to = now;

        const stats = await getStatsForPeriod(company.id, from, to);
        if (stats.newLeads === 0 && stats.totalLeads === 0) continue; // skip empty companies

        const periodLabel = isMonthly ? 'Monthly' : 'Weekly';
        const dateRange = `${from.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${to.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
        const period = `${periodLabel} (${dateRange})`;

        const html = buildDigestHtml(company.name ?? 'Your Company', period, stats);
        const text = `${periodLabel} Lead Report for ${company.name}\n\nNew leads: ${stats.newLeads} | Contacted: ${stats.contacted} | Qualified: ${stats.qualified} | Booked: ${stats.booked} | Lost: ${stats.lost}\n\nTotal CRM leads: ${stats.totalLeads}`;

        const result = await sendMail({
          to: recipients,
          subject: `📊 ${periodLabel} Lead Report — ${to.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
          text,
          html,
        });

        if (result.sent) {
          sent++;
          log.info({ companyId: company.id, periodLabel, recipients }, 'Digest report sent.');
        }
      } catch (err) {
        log.error({ err, companyId: company.id }, 'Failed to send digest report.');
      }
    }

    return { sent };
  }
}

export const digestReportService = new DigestReportService();
