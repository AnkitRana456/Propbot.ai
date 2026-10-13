import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '../src/sanitizer.js';

describe('Widget XSS Sanitizer for AI Output (Phase 14.1)', () => {
  it('strips script tags and inner javascript execution', () => {
    const dirty = '<p>Hello!</p><script>alert("xss")</script><p>Welcome to Prestige Glenwood.</p>';
    const clean = sanitizeHtml(dirty);
    expect(clean).not.toContain('<script>');
    expect(clean).not.toContain('alert');
    expect(clean).toContain('<p>Hello!</p>');
    expect(clean).toContain('<p>Welcome to Prestige Glenwood.</p>');
  });

  it('strips inline event handlers (onerror, onload, onclick)', () => {
    const dirty = '<img src="invalid.jpg" onerror="alert(\'steal_token\')" /><a href="#" onclick="evil()">Click</a>';
    const clean = sanitizeHtml(dirty);
    expect(clean).not.toContain('onerror');
    expect(clean).not.toContain('onclick');
    expect(clean).not.toContain('evil()');
  });

  it('blocks javascript: and data: pseudo-protocols in links', () => {
    const dirty = '<a href="javascript:alert(1)">Dangerous Link</a><a href="https://prestige.com">Legit Link</a>';
    const clean = sanitizeHtml(dirty);
    expect(clean).not.toContain('javascript:alert(1)');
    expect(clean).toContain('href="https://prestige.com"');
  });

  it('preserves legitimate safe formatting for AI responses', () => {
    const markdownOutput =
      '<h3>Prestige Sanctuary</h3><p>Starting at <strong>₹3.25 Cr</strong> with <em>private club access</em>.</p><ul><li>3BHK Villas</li><li>4BHK Presidential</li></ul>';
    const clean = sanitizeHtml(markdownOutput);
    expect(clean).toContain('<h3>Prestige Sanctuary</h3>');
    expect(clean).toContain('<strong>₹3.25 Cr</strong>');
    expect(clean).toContain('<ul><li>3BHK Villas</li><li>4BHK Presidential</li></ul>');
  });
});
