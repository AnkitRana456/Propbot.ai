/** Indian-style short amounts: 1.2 Cr, 85 L, 45 K. */
export function formatInr(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount) || amount <= 0) return '—';
  const trim = (n: number) => String(Number(n.toFixed(2)));
  if (amount >= 10_000_000) return `₹${trim(amount / 10_000_000)} Cr`;
  if (amount >= 100_000) return `₹${trim(amount / 100_000)} L`;
  if (amount >= 1_000) return `₹${trim(amount / 1_000)} K`;
  return `₹${amount}`;
}

/** Parses "1.2 Cr", "85L", "4500000" or "45 lakh" into rupees; null when it is not an amount. */
export function parseInr(input: string): number | null {
  const m = input.trim().toLowerCase().replace(/[₹,\s]/g, '').match(/^(\d+(?:\.\d+)?)(cr|crore|l|lac|lakh|k)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2];
  const mult = !unit ? 1 : unit.startsWith('c') ? 10_000_000 : unit === 'k' ? 1_000 : 100_000;
  return Math.round(n * mult);
}

/** "2h ago", "3d ago", or a date for anything older than a month. */
export function timeAgo(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const s = Math.round((now - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/** Value for an <input type="datetime-local"> in the viewer's timezone. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Stops a spreadsheet from running a cell as a formula, then quotes it for CSV. */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCsv(filename: string, header: string[], rows: unknown[][]): void {
  const body = [header, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
