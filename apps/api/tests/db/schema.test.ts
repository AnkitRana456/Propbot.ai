import { describe, it, expect } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import * as schema from '../../src/db/schema/index.js';

describe('Database Schema Architecture (Phase 1.2)', () => {
  it('exports all 25 required tables and settings', () => {
    expect(schema.companies).toBeDefined();
    expect(schema.companyAiSettings).toBeDefined();
    expect(schema.users).toBeDefined();
    expect(schema.organizations).toBeDefined();
    expect(schema.contacts).toBeDefined();
    expect(schema.chatbots).toBeDefined();
    expect(schema.knowledgeSources).toBeDefined();
    expect(schema.knowledgeChunks).toBeDefined();
    expect(schema.conversations).toBeDefined();
    expect(schema.messages).toBeDefined();
    expect(schema.leads).toBeDefined();
    expect(schema.leadActivities).toBeDefined();
    expect(schema.notes).toBeDefined();
    expect(schema.tasks).toBeDefined();
    expect(schema.projects).toBeDefined();
    expect(schema.units).toBeDefined();
    expect(schema.brochures).toBeDefined();
    expect(schema.appointments).toBeDefined();
    expect(schema.webhookEndpoints).toBeDefined();
    expect(schema.webhookLogs).toBeDefined();
    expect(schema.subscriptions).toBeDefined();
    expect(schema.auditLogs).toBeDefined();
    expect(schema.notifications).toBeDefined();
    expect(schema.domainEvents).toBeDefined();
    expect(schema.agentActions).toBeDefined();
  });

  it('enforces company_id, created_at, and updated_at on all tenant tables', () => {
    const tenantTables = [
      schema.users,
      schema.organizations,
      schema.contacts,
      schema.chatbots,
      schema.knowledgeSources,
      schema.knowledgeChunks,
      schema.conversations,
      schema.messages,
      schema.leads,
      schema.leadActivities,
      schema.notes,
      schema.tasks,
      schema.projects,
      schema.units,
      schema.brochures,
      schema.appointments,
      schema.webhookEndpoints,
      schema.webhookLogs,
      schema.subscriptions,
      schema.auditLogs,
      schema.notifications,
      schema.domainEvents,
      schema.agentActions,
    ];

    for (const table of tenantTables) {
      const cols = getTableColumns(table);
      expect(cols).toHaveProperty('companyId');
      expect(cols).toHaveProperty('createdAt');
      expect(cols).toHaveProperty('updatedAt');
    }
  });

  it('validates domain_events outbox table schema', () => {
    const cols = getTableColumns(schema.domainEvents);
    expect(cols).toHaveProperty('id');
    expect(cols).toHaveProperty('companyId');
    expect(cols).toHaveProperty('type');
    expect(cols).toHaveProperty('payload');
    expect(cols).toHaveProperty('createdAt');
    expect(cols).toHaveProperty('processedAt');
    expect(cols).toHaveProperty('attempts');
    expect(cols).toHaveProperty('lastError');
  });

  it('validates agent_actions guarded action schema', () => {
    const cols = getTableColumns(schema.agentActions);
    expect(cols).toHaveProperty('id');
    expect(cols).toHaveProperty('companyId');
    expect(cols).toHaveProperty('agentName');
    expect(cols).toHaveProperty('actionType');
    expect(cols).toHaveProperty('tier');
    expect(cols).toHaveProperty('status');
    expect(cols).toHaveProperty('args');
    expect(cols).toHaveProperty('result');
    expect(cols).toHaveProperty('approvedBy');
  });

  it('validates company_ai_settings guardrails schema', () => {
    const cols = getTableColumns(schema.companyAiSettings);
    expect(cols).toHaveProperty('companyId');
    expect(cols).toHaveProperty('killSwitch');
    expect(cols).toHaveProperty('allowedTiers');
    expect(cols).toHaveProperty('dailyActionCap');
  });

  it('validates contacts and leads relations', () => {
    const contactCols = getTableColumns(schema.contacts);
    const leadCols = getTableColumns(schema.leads);

    expect(contactCols).toHaveProperty('phone');
    expect(contactCols).toHaveProperty('email');
    expect(leadCols).toHaveProperty('contactId');
    expect(leadCols).toHaveProperty('intentScore');
    expect(leadCols).toHaveProperty('buyerDna');
  });
});
