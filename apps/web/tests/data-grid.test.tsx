import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DataGrid, type GridColumn } from '../src/components/crm/DataGrid.js';
import { csvCell, formatInr, parseInr } from '../src/lib/format.js';

interface Row { id: string; name: string }
const rows: Row[] = [{ id: '1', name: 'Charu' }, { id: '2', name: 'Asha' }, { id: '3', name: 'Bala' }];
const columns: Array<GridColumn<Row>> = [{ key: 'name', label: 'Name', sortValue: r => r.name, render: r => <span>{r.name}</span> }];
const html = (props: Partial<React.ComponentProps<typeof DataGrid<Row>>> = {}) =>
  renderToStaticMarkup(<DataGrid label="People" columns={columns} rows={rows} getId={r => r.id} {...props} />);

describe('DataGrid', () => {
  it('renders an accessible grid with sort state and a single tab stop', () => {
    const out = html({ defaultSort: { key: 'name', dir: 'asc' }, onSelectionChange: () => undefined });
    expect(out).toContain('role="grid"');
    expect(out).toContain('aria-sort="ascending"');
    expect(out.indexOf('Asha')).toBeLessThan(out.indexOf('Bala'));
    expect(out.indexOf('Bala')).toBeLessThan(out.indexOf('Charu'));
    expect(out.match(/tabindex="0"/g)).toHaveLength(1);
  });

  it('sorts descending and shows the empty slot when there are no rows', () => {
    const out = html({ defaultSort: { key: 'name', dir: 'desc' } });
    expect(out.indexOf('Charu')).toBeLessThan(out.indexOf('Asha'));
    expect(html({ rows: [], empty: <p>Nothing here</p> })).toContain('Nothing here');
  });

  it('shows a retry action on error instead of the table', () => {
    const out = html({ error: 'boom', onRetry: () => undefined });
    expect(out).toContain('role="alert"');
    expect(out).toContain('Retry');
    expect(out).not.toContain('role="grid"');
  });
});

describe('format helpers', () => {
  it('formats and parses INR', () => {
    expect(formatInr(12_000_000)).toBe('₹1.2 Cr');
    expect(formatInr(8_500_000)).toBe('₹85 L');
    expect(formatInr(null)).toBe('—');
    expect(parseInr('1.2 Cr')).toBe(12_000_000);
    expect(parseInr('85L')).toBe(8_500_000);
    expect(parseInr('abc')).toBeNull();
  });
  it('neutralises spreadsheet formulas in CSV', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('a,b')).toBe('"a,b"');
  });
});

import { leadsPerDay, leadsBySource, trendPercent } from '../src/lib/lead-stats.js';

describe('lead stats', () => {
  const now = new Date(2026, 9, 21, 12);
  const mk = (daysAgo: number, source = 'web') => ({ createdAt: new Date(2026, 9, 21 - daysAgo, 10).toISOString(), source, status: 'new' });
  it('zero-fills a 30 day series and counts per day', () => {
    const s = leadsPerDay([mk(0), mk(0), mk(2)], 30, now);
    expect(s).toHaveLength(30);
    expect(s[29]!.count).toBe(2);
    expect(s[27]!.count).toBe(1);
    expect(s[0]!.count).toBe(0);
  });
  it('groups sources and computes the weekly trend', () => {
    expect(leadsBySource([mk(0, 'WhatsApp Bot'), mk(0, 'Lead form'), mk(0, 'Web AI Chatbot'), mk(1, 'Web AI Chatbot')])[0]).toEqual({ name: 'Web chatbot', value: 2 });
    const s = leadsPerDay([mk(0), mk(1), mk(8)], 14, now);
    expect(trendPercent(s)).toBe(100);
    expect(trendPercent(leadsPerDay([mk(0)], 14, now))).toBeNull();
  });
});
