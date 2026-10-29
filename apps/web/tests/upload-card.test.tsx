import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { UploadCard } from '../src/components/ui/UploadCard.js';

describe('UploadCard', () => {
  it('renders the ready state: drop zone, hint and the demo link', () => {
    const html = renderToString(<UploadCard />);
    expect(html).toContain('data-s="ready"');
    expect(html).toContain('data-v="drop"');
    expect(html).toContain('File Upload');
    expect(html).toContain('Up to 50 MB · .zip .pdf .png .mp4');
    expect(html).toContain('Try a demo file');
    // 24 segments in the progress meter and 24 in the done sweep
    expect(html.match(/<i[\s>]/g)?.length).toBe(48);
  });

  it('hides the demo link and uses the given title and hint', () => {
    const html = renderToString(<UploadCard title="Import leads" hint="Up to 500 rows · .csv" accept=".csv" demo={false} />);
    expect(html).toContain('aria-label="Import leads"');
    expect(html).toContain('Up to 500 rows · .csv');
    expect(html).toContain('accept=".csv"');
    expect(html).not.toContain('Try a demo file');
  });
});
