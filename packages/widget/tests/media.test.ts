// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderMediaItems, isSafeImageUrl, isSafeMapUrl } from '../src/media.js';

describe('widget media rendering', () => {
  it('renders photos, plan and map cards from API items', () => {
    const el = renderMediaItems([
      { kind: 'highlight_photos', title: 'Lakeside highlights', urls: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'] },
      { kind: 'floor_plan', title: '3 BHK floor plans', urls: ['https://cdn.example.com/p.png'], caption: '3BHK Type B (1200 sq ft carpet)' },
      { kind: 'master_plan', title: 'Master plan', urls: ['https://cdn.example.com/m.png'] },
      { kind: 'location_map', title: 'Location', embedUrl: 'https://www.google.com/maps?q=12.97,77.59&output=embed' },
    ])!;
    expect(el.querySelectorAll('.propbot-media-card')).toHaveLength(4);
    expect(el.querySelectorAll('img')).toHaveLength(4);
    const iframe = el.querySelector('iframe')!;
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin');
    expect(iframe.getAttribute('sandbox')).not.toContain('allow-top-navigation');
    expect(el.querySelector('a')!.getAttribute('rel')).toBe('noopener noreferrer');
    expect(el.textContent).toContain('1200 sq ft carpet');
  });

  it('drops unsafe URLs and never injects server strings as HTML', () => {
    const el = renderMediaItems([
      { kind: 'highlight_photos', title: '<img src=x onerror=alert(1)>', urls: ['javascript:alert(1)', 'http://insecure.example.com/x.jpg', 'https://ok.example.com/ok.jpg'] },
      { kind: 'location_map', title: 'Map', embedUrl: 'https://evil.example.com/maps' },
      { kind: 'unknown', title: 'x' },
    ])!;
    expect(el.querySelectorAll('img')).toHaveLength(1);
    expect(el.querySelector('iframe')).toBeNull();
    expect(el.querySelector('[onerror]')).toBeNull(); // no element was created from the title string
    expect(el.textContent).toContain('<img src=x onerror=alert(1)>'); // shown as text
  });

  it('returns null when nothing is renderable', () => {
    expect(renderMediaItems(undefined)).toBeNull();
    expect(renderMediaItems([])).toBeNull();
    expect(renderMediaItems([{ kind: 'floor_plan', title: 't', urls: ['ftp://x'] }])).toBeNull();
    expect(isSafeImageUrl('https://a.b/c.png')).toBe(true);
    expect(isSafeMapUrl('https://www.google.com/maps/embed?pb=1')).toBe(true);
    expect(isSafeMapUrl('https://www.google.com.evil.com/maps?x')).toBe(false);
  });
});
