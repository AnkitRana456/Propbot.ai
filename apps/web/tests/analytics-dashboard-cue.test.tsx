import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import AnalyticsDashboard from '../src/components/AnalyticsDashboard.js';

describe('AnalyticsDashboard Component', () => {
  it('renders correctly with default props', () => {
    const html = renderToString(<AnalyticsDashboard />);
    expect(html).toContain('Cue');
    expect(html).toContain('Gross Sales');
    expect(html).toContain('Returning customer rate');
    expect(html).toContain('Pro sales');
    expect(html).toContain('Conversion rate');
    expect(html).toContain('Total sales over time');
    expect(html).toContain('Top products');
    expect(html).toContain('Sessions over time');
    expect(html).toContain('Ask');
    expect(html).toContain('Cue AI');
  });

  it('renders custom workspace and assistant name', () => {
    const html = renderToString(
      <AnalyticsDashboard workspace="PropBot." assistant="PropBot AI" height="800px" />
    );
    expect(html).toContain('PropBot');
    expect(html).toContain('PropBot AI');
  });

  it('renders top products accurately', () => {
    const html = renderToString(<AnalyticsDashboard />);
    expect(html).toContain('Lifetime Pro');
    expect(html).toContain('Motion Remake skill');
    expect(html).toContain('Kit Pro yearly');
    expect(html).toContain('Prompt pack: Landing');
    expect(html).toContain('Custom component');
  });
});
