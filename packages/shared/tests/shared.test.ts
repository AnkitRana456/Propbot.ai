import { describe, it, expect } from 'vitest';
import {
  domainEventSchema,
  agentActionSchema,
  assertNever,
  type DomainEvent,
} from '../src/index.js';

describe('@propbot/shared', () => {
  it('validates a lead_created domain event schema', () => {
    const validEvent = {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      company_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      type: 'lead_created',
      timestamp: new Date().toISOString(),
      attempts: 0,
      payload: {
        lead_id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
        source: 'website_widget',
      },
    };

    const parsed = domainEventSchema.parse(validEvent);
    expect(parsed.type).toBe('lead_created');
  });

  it('validates an agent action schema', () => {
    const validAction = {
      id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
      company_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      agent_name: 'PropBot Lead Agent',
      tier: 'T1',
      action_type: 'add_tag',
      status: 'proposed',
      created_at: new Date().toISOString(),
      args: {
        lead_id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
        tag: 'high_budget',
      },
    };

    const parsed = agentActionSchema.parse(validAction);
    expect(parsed.action_type).toBe('add_tag');
    expect(parsed.tier).toBe('T1');
  });

  it('handles exhaustive switch matching with assertNever', () => {
    const eventType: DomainEvent['type'] = 'brochure_opened';

    function handle(e: DomainEvent['type']): string {
      switch (e) {
        case 'lead_created':
        case 'lead_updated':
        case 'intent_changed':
        case 'lead_hot':
        case 'lead_status_changed':
        case 'message_received':
        case 'visit_booked':
        case 'visit_changed':
        case 'brochure_opened':
        case 'room_viewed':
        case 'handoff_requested':
        case 'payment_received':
        case 'survey_completed':
          return 'handled';
        default:
          return assertNever(e);
      }
    }

    expect(handle(eventType)).toBe('handled');
  });
});
