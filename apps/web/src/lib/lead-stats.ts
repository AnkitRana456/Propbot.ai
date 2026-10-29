export interface DatedLead {
  createdAt: string;
  source: string;
  status: string;
}

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Leads created per calendar day for the last `days` days (oldest first, zero-filled). */
export function leadsPerDay(leads: DatedLead[], days = 30, now: Date = new Date()): Array<{ date: string; label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const l of leads) {
    const d = new Date(l.createdAt);
    if (!Number.isNaN(d.getTime())) counts.set(dayKey(d), (counts.get(dayKey(d)) ?? 0) + 1);
  }
  const out: Array<{ date: string; label: string; count: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    out.push({ date: dayKey(d), label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), count: counts.get(dayKey(d)) ?? 0 });
  }
  return out;
}

export type SourceGroup = 'Web chatbot' | 'WhatsApp' | 'Messenger' | 'Instagram' | 'Form' | 'Other';

export function sourceGroup(source: string): SourceGroup {
  const s = (source || '').toLowerCase();
  if (s.includes('whatsapp')) return 'WhatsApp';
  if (s === 'messenger' || s.includes('messenger')) return 'Messenger';
  if (s === 'instagram' || s.includes('instagram')) return 'Instagram';
  if (s.includes('form')) return 'Form';
  if (s.includes('chat') || s.includes('widget') || s.includes('web')) return 'Web chatbot';
  return 'Other';
}

export function leadsBySource(leads: DatedLead[]): Array<{ name: SourceGroup; value: number }> {
  const counts = new Map<SourceGroup, number>();
  for (const l of leads) counts.set(sourceGroup(l.source), (counts.get(sourceGroup(l.source)) ?? 0) + 1);
  return [...counts.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

/** Percentage change of the last `window` days against the `window` days before; null when there is no baseline. */
export function trendPercent(series: Array<{ count: number }>, window = 7): number | null {
  const cur = series.slice(-window).reduce((s, p) => s + p.count, 0);
  const prev = series.slice(-window * 2, -window).reduce((s, p) => s + p.count, 0);
  if (prev === 0) return cur === 0 ? 0 : null;
  return Math.round(((cur - prev) / prev) * 100);
}
