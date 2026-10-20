import nodemailer, { type Transporter } from 'nodemailer';

export interface MailMessage {
  to: string[];
  subject: string;
  text: string;
  html: string;
}

export type MailResult = { sent: true; messageId: string } | { sent: false; reason: 'SMTP_NOT_CONFIGURED' };

let transport: Transporter | null = null;
let transportOverride: Transporter | null = null;

export function isSmtpConfigured(): boolean {
  return Boolean(transportOverride || process.env.SMTP_HOST);
}

/** Test seam: inject a nodemailer transport (e.g. `nodemailer.createTransport({ jsonTransport: true })`). */
export function setMailTransport(t: Transporter | null): void {
  transportOverride = t;
}

function getTransport(): Transporter {
  if (transportOverride) return transportOverride;
  if (!transport) {
    const port = Number(process.env.SMTP_PORT) || 587;
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }
  return transport;
}

export async function sendMail(msg: MailMessage): Promise<MailResult> {
  if (!isSmtpConfigured()) return { sent: false, reason: 'SMTP_NOT_CONFIGURED' };
  const info = await getTransport().sendMail({
    from: process.env.SMTP_FROM || 'no-reply@propbotpro.com',
    to: msg.to.join(', '),
    subject: msg.subject,
    text: msg.text,
    html: msg.html,
  });
  return { sent: true, messageId: String(info.messageId ?? '') };
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Strips CR/LF so lead-supplied text can never inject extra mail headers into a subject. */
export function singleLine(value: unknown): string {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, 150);
}

export interface LeadAlertFields {
  Name: string;
  Phone: string;
  Email: string;
  Source: string;
  ChatbotName: string;
  PageUrl: string;
  UTMSource: string;
  UTMMedium: string;
  UTMCampaign: string;
  UTMSubSource: string;
  UTMAgencyPartner: string;
  CapturedAt: string;
}

export function buildLeadAlertMail(lead: LeadAlertFields, recipients: string[]): MailMessage {
  const rows: Array<[string, string]> = [
    ['Name', lead.Name],
    ['Phone', lead.Phone],
    ['Email', lead.Email || '-'],
    ['Source', lead.Source],
    ['Chatbot', lead.ChatbotName || '-'],
    ['Page', lead.PageUrl || '-'],
    ['UTM source', lead.UTMSource || '-'],
    ['UTM medium', lead.UTMMedium || '-'],
    ['UTM campaign', lead.UTMCampaign || '-'],
    ['UTM sub source', lead.UTMSubSource || '-'],
    ['Agency partner', lead.UTMAgencyPartner || '-'],
    ['Captured at', lead.CapturedAt],
  ];
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n');
  const html =
    `<h2>New lead: ${escapeHtml(lead.Name)}</h2><table cellpadding="6" style="border-collapse:collapse">` +
    rows.map(([k, v]) => `<tr><td><b>${escapeHtml(k)}</b></td><td>${escapeHtml(v)}</td></tr>`).join('') +
    '</table>';
  return { to: recipients, subject: `New lead: ${singleLine(lead.Name)} (${singleLine(lead.Phone)})`, text, html };
}
