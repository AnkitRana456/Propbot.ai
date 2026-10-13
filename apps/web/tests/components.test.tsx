import { describe, it, expect } from 'vitest';
import React from 'react';
import { Users, Bot } from 'lucide-react';
import { KpiCard } from '../src/components/dashboard/KpiCard.js';
import { Skeleton } from '../src/components/common/Skeleton.js';
import { EmptyState } from '../src/components/common/EmptyState.js';

describe('Web UI Components', () => {
  it('instantiates KpiCard with props', () => {
    const el = React.createElement(KpiCard, {
      title: 'Total Inbound Leads',
      value: 128,
      icon: Users,
      trendText: '+14% vs last week',
      trendType: 'positive',
    });
    expect(el).toBeDefined();
    expect(el.props.title).toBe('Total Inbound Leads');
    expect(el.props.value).toBe(128);
    expect(el.props.trendText).toBe('+14% vs last week');
  });

  it('instantiates Skeleton loader with custom className', () => {
    const el = React.createElement(Skeleton, {
      className: 'h-8 w-24 rounded-lg',
    });
    expect(el).toBeDefined();
    expect(el.props.className).toContain('h-8 w-24');
  });

  it('instantiates EmptyState with title and action', () => {
    const onAction = () => {};
    const el = React.createElement(EmptyState, {
      icon: Bot,
      title: 'No Active Chatbots',
      description: 'Create your first AI real estate concierge',
      actionLabel: 'Create Bot',
      onAction,
    });
    expect(el).toBeDefined();
    expect(el.props.title).toBe('No Active Chatbots');
    expect(el.props.actionLabel).toBe('Create Bot');
  });
});
