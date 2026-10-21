import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(__dirname, '../src/styles/tokens.css'), 'utf8').split('\r\n').join('\n');

/** Pulls `--name: #hex` pairs out of the first block that starts with the selector. */
function tokens(selectorStart: string): Record<string, string> {
  const start = css.indexOf(selectorStart);
  const end = css.indexOf('\n}', start);
  const block = css.slice(start, end);
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g)) out[m[1]!] = m[2]!;
  return out;
}

const lum = (hex: string) => {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

const themes = { light: tokens(":root,\n[data-theme='light']"), dark: tokens(".dark,\n[data-theme='dark']") };
const STATUSES = ['new', 'contacted', 'qualified', 'site-visit', 'negotiation', 'won', 'lost'];

describe.each(Object.entries(themes))('%s theme tokens', (name, t) => {
  it.each(STATUSES)('status pill "%s" has at least 4.5:1 contrast', s => {
    const bg = t[`status-${s}-bg`];
    const fg = t[`status-${s}-fg`];
    expect(bg, `status-${s}-bg`).toBeTruthy();
    expect(fg, `status-${s}-fg`).toBeTruthy();
    expect(ratio(bg!, fg!), `${name}/${s}`).toBeGreaterThanOrEqual(4.5);
  });

  it('body text, muted text and the accent are readable on the page and card backgrounds', () => {
    for (const bg of [t.bg!, t.surface!, t['surface-2']!]) {
      expect(ratio(t.text!, bg)).toBeGreaterThanOrEqual(7);
      expect(ratio(t['text-muted']!, bg), `muted on ${bg}`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(t.accent!, bg), `accent on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('text on a filled accent button and on the soft accent background passes', () => {
    expect(ratio(t['on-accent']!, t.accent!)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(t.accent!, t['accent-soft']!)).toBeGreaterThanOrEqual(4.5);
  });

  it('feedback colours are readable as text on the surface', () => {
    for (const k of ['success', 'warning', 'danger']) expect(ratio(t[k]!, t.surface!), k).toBeGreaterThanOrEqual(4.5);
  });
});
