import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { KanbanColumn } from '../src/components/crm/KanbanColumn.js';
import { KanbanLeadCard } from '../src/components/crm/KanbanLeadCard.js';
import type { LeadItemResponse } from '@propbot/shared';

describe('CRM Kanban Component Suite', () => {
  const mockLead: LeadItemResponse = {
    id: '12345678-1234-1234-1234-123456789012',
    companyId: '11111111-1111-1111-1111-111111111111',
    contactId: '22222222-2222-2222-2222-222222222222',
    name: 'Anil Ambani',
    firstName: 'Anil',
    phone: '+919876543210',
    status: 'new',
    priority: 'high',
    intentScore: 85,
    intentLabel: 'hot',
    scoreExplanation: ['High budget fit', 'Shared phone'],
    buyerDna: {
      budgetMin: 15000000,
      budgetMax: 25000000,
      bhk: ['3BHK', '4BHK'],
      localities: ['Indiranagar'],
      propertyType: 'apartment',
      purpose: 'end_use',
      timeline: 'immediate',
      financing: 'self_funded',
      familySize: null,
      mustHaves: [],
      dealBreakers: [],
      objections: [],
      competitorsMentioned: [],
      language: 'en',
      confidence: {},
      explicitFields: [],
    },
    phoneVerified: true,
    tags: ['VIP', 'Luxury'],
    source: 'chat',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('instantiates KanbanColumn with stage title, count badge, and lead cards', () => {
    const handleSelect = vi.fn();
    const el = React.createElement(KanbanColumn, {
      stageId: 'new',
      title: 'New Leads',
      leads: [mockLead],
      count: 1,
      onSelectLead: handleSelect,
    });

    expect(el).toBeDefined();
    expect(el.props.stageId).toBe('new');
    expect(el.props.title).toBe('New Leads');
    expect(el.props.count).toBe(1);
    expect(el.props.leads).toHaveLength(1);
  });

  it('instantiates KanbanLeadCard with lead data and click handler', () => {
    const handleClick = vi.fn();
    const el = React.createElement(KanbanLeadCard, {
      lead: mockLead,
      onClick: handleClick,
    });

    expect(el).toBeDefined();
    expect(el.props.lead.name).toBe('Anil Ambani');
    expect(el.props.lead.intentScore).toBe(85);
    expect(el.props.lead.phone).toBe('+919876543210');
  });
});
