import React from 'react';
import { describe, it, expect } from 'vitest';
import { ShortlistPanel } from '../src/components/crm/ShortlistPanel.js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

describe('Shortlist Room Components', () => {
  it('instantiates ShortlistPanel with leadId and leadName', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    const el = React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(ShortlistPanel, {
        leadId: '12345678-1234-1234-1234-123456789012',
        leadName: 'Vikram Malhotra',
      }),
    );

    expect(el).toBeDefined();
    expect(el.props.children.props.leadId).toBe('12345678-1234-1234-1234-123456789012');
    expect(el.props.children.props.leadName).toBe('Vikram Malhotra');
  });
});
