import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { createApp } from '../../src/server.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import {
  companies,
  apiKeys,
  leads,
  contacts,
  units,
  projects,
  auditLogs,
  companyAiSettings,
  users,
} from '../../src/db/schema/index.js';
import { eq, and } from 'drizzle-orm';

describe('Phase 15C: Model Context Protocol (MCP) CRM Integration', () => {
  const app = createApp();

  const companyAId = 'da000000-0000-0000-0000-000000000001';
  const companyBId = 'da000000-0000-0000-0000-000000000002';

  const rawKeyA_Read = 'pb_live_read01_secretkeyformcptestingread12345';
  const rawKeyA_Write = 'pb_live_writ01_secretkeyformcptestingwrite1234';
  const rawKeyB = 'pb_live_compb1_secretkeyformcptestingcompb1234';

  let leadAId: string;
  let leadBId: string;
  let projectAId: string;

  beforeAll(async () => {
    await cleanupTestDatabase([companyAId, companyBId]);

    // Create companies
    await testDb.insert(companies).values([
      {
        id: companyAId,
        name: 'MCP Realty A',
        slug: 'mcp-realty-a',
        plan: 'enterprise',
        status: 'active',
      },
      {
        id: companyBId,
        name: 'MCP Realty B',
        slug: 'mcp-realty-b',
        plan: 'enterprise',
        status: 'active',
      },
    ]);

    // Create test user for Company A
    await testDb.insert(users).values({
      companyId: companyAId,
      email: 'mcp.admin@company-a.com',
      passwordHash: 'hashed_pw',
      role: 'company_admin',
      name: 'MCP Admin A',
      status: 'active',
    });

    // Ensure company AI settings allows T1 and T2
    await testDb.insert(companyAiSettings).values({
      companyId: companyAId,
      allowedTiers: ['T0', 'T1', 'T2'],
      dailyActionCap: 100,
    });

    // Create API keys for Company A (Read-only, Read+Write) and Company B
    const hashReadA = crypto.createHash('sha256').update(rawKeyA_Read).digest('hex');
    const hashWriteA = crypto.createHash('sha256').update(rawKeyA_Write).digest('hex');
    const hashCompB = crypto.createHash('sha256').update(rawKeyB).digest('hex');

    await testDb.insert(apiKeys).values([
      {
        companyId: companyAId,
        name: 'Claude Desktop Read Key',
        keyPrefix: 'pb_live_read01',
        keyHash: hashReadA,
        permissions: ['mcp:read'],
      },
      {
        companyId: companyAId,
        name: 'Cursor Full Key',
        keyPrefix: 'pb_live_writ01',
        keyHash: hashWriteA,
        permissions: ['mcp:read', 'mcp:write'],
      },
      {
        companyId: companyBId,
        name: 'Company B Key',
        keyPrefix: 'pb_live_compb1',
        keyHash: hashCompB,
        permissions: ['mcp:read', 'mcp:write'],
      },
    ]);

    // Create Contact & Lead for Company A
    const [contactA] = await testDb
      .insert(contacts)
      .values({
        companyId: companyAId,
        firstName: 'Rahul',
        lastName: 'Verma',
        phone: '+919876500001',
        email: 'rahul.verma@example.com',
      })
      .returning();

    const [leadA] = await testDb
      .insert(leads)
      .values({
        companyId: companyAId,
        contactId: contactA!.id,
        status: 'qualified',
        intentScore: 85,
        intentLabel: 'hot',
        buyerDna: { budget: '2.5 Cr', bhk: '3BHK', location: 'Sarjapur' },
      })
      .returning();
    leadAId = leadA!.id;

    // Create Contact & Lead for Company B
    const [contactB] = await testDb
      .insert(contacts)
      .values({
        companyId: companyBId,
        firstName: 'Siddharth',
        lastName: 'Menon',
        phone: '+919876500002',
        email: 'siddharth.m@example.com',
      })
      .returning();

    const [leadB] = await testDb
      .insert(leads)
      .values({
        companyId: companyBId,
        contactId: contactB!.id,
        status: 'new',
        intentScore: 30,
        buyerDna: { budget: '1.2 Cr', bhk: '2BHK' },
      })
      .returning();
    leadBId = leadB!.id;

    // Create Project & Units for Company A
    const [projA] = await testDb
      .insert(projects)
      .values({
        companyId: companyAId,
        name: 'Prestige Lakeside Habitat',
        builderName: 'Prestige Group',
        location: 'Whitefield',
        status: 'ready_to_move',
      })
      .returning();
    projectAId = projA!.id;

    await testDb.insert(units).values([
      {
        companyId: companyAId,
        projectId: projectAId,
        unitNumber: 'T1-101',
        bhk: 3,
        carpetAreaSqft: '1450.00',
        price: '22500000.00',
        status: 'available',
      },
      {
        companyId: companyAId,
        projectId: projectAId,
        unitNumber: 'T1-102',
        bhk: 2,
        carpetAreaSqft: '1050.00',
        price: '16000000.00',
        status: 'available',
      },
    ]);
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyAId, companyBId]);
  });

  describe('15.13 MCP Server Tools & Scoped Authentication', () => {
    it('rejects unauthenticated requests to MCP tools', async () => {
      const res = await request(app).get('/api/mcp/tools');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects invalid API bearer token', async () => {
      const res = await request(app)
        .get('/api/mcp/tools')
        .set('Authorization', 'Bearer pb_live_invalid_token');

      expect(res.status).toBe(401);
    });

    it('lists available tools scoped to caller permissions', async () => {
      // Read-only key should only see read tools
      const resRead = await request(app)
        .get('/api/mcp/tools')
        .set('Authorization', `Bearer ${rawKeyA_Read}`);

      expect(resRead.status).toBe(200);
      expect(resRead.body.data.tools.length).toBeGreaterThanOrEqual(5);
      const toolNames = resRead.body.data.tools.map((t: { name: string }) => t.name);
      expect(toolNames).toContain('get_leads');
      expect(toolNames).toContain('get_lead_detail');
      expect(toolNames).toContain('get_pipeline_stats');
      expect(toolNames).toContain('get_inventory');
      expect(toolNames).toContain('get_appointments');
      expect(toolNames).not.toContain('create_lead_note');

      // Full key sees both read and write tools
      const resFull = await request(app)
        .get('/api/mcp/tools')
        .set('Authorization', `Bearer ${rawKeyA_Write}`);

      expect(resFull.status).toBe(200);
      const fullNames = resFull.body.data.tools.map((t: { name: string }) => t.name);
      expect(fullNames).toContain('create_lead_note');
      expect(fullNames).toContain('update_lead_status');
      expect(fullNames).toContain('schedule_appointment');
      expect(fullNames).toContain('send_payment_link');
    });

    it('enforces tenant RLS: caller cannot see or query other companies leads', async () => {
      // Company A queries leads
      const resA = await request(app)
        .post('/api/mcp/tools/get_leads')
        .set('Authorization', `Bearer ${rawKeyA_Read}`)
        .send({ minIntentScore: 0 });

      expect(resA.status).toBe(200);
      const leadIdsA = resA.body.data.leads.map((l: { id: string }) => l.id);
      expect(leadIdsA).toContain(leadAId);
      expect(leadIdsA).not.toContain(leadBId);

      // Company A maliciously passes companyId of Company B in body - MUST BE IGNORED
      const resSpoof = await request(app)
        .post('/api/mcp/tools/get_leads')
        .set('Authorization', `Bearer ${rawKeyA_Read}`)
        .send({ companyId: companyBId, company_id: companyBId });

      expect(resSpoof.status).toBe(200);
      const spoofIds = resSpoof.body.data.leads.map((l: { id: string }) => l.id);
      expect(spoofIds).not.toContain(leadBId); // Cross-tenant leak prevented!
    });

    it('executes get_lead_detail returning full context including Buyer DNA', async () => {
      const res = await request(app)
        .post('/api/mcp/tools/get_lead_detail')
        .set('Authorization', `Bearer ${rawKeyA_Read}`)
        .send({ leadId: leadAId });

      expect(res.status).toBe(200);
      expect(res.body.data.lead.id).toBe(leadAId);
      expect(res.body.data.lead.buyerDna).toEqual({
        budget: '2.5 Cr',
        bhk: '3BHK',
        location: 'Sarjapur',
      });
      expect(res.body.data.contact.firstName).toBe('Rahul');
    });

    it('executes get_pipeline_stats with aggregated funnel metrics', async () => {
      const res = await request(app)
        .post('/api/mcp/tools/get_pipeline_stats')
        .set('Authorization', `Bearer ${rawKeyA_Read}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.totalLeads).toBeGreaterThanOrEqual(1);
      expect(res.body.data.breakdown).toHaveProperty('qualified');
    });

    it('executes get_inventory returning available project units', async () => {
      const res = await request(app)
        .post('/api/mcp/tools/get_inventory')
        .set('Authorization', `Bearer ${rawKeyA_Read}`)
        .send({ projectId: projectAId, bhk: 3 });

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(1);
      expect(res.body.data.units[0].unitNumber).toBe('T1-101');
    });

    it('rejects write tool when caller API key only has mcp:read scope', async () => {
      const res = await request(app)
        .post('/api/mcp/tools/create_lead_note')
        .set('Authorization', `Bearer ${rawKeyA_Read}`)
        .send({
          leadId: leadAId,
          content: 'Prospect prefers East-facing 3BHK flat.',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('mcp:write');
    });

    it('executes guarded write tool create_lead_note (Tier T1) with write scope', async () => {
      const noteContent = 'Spoke with prospect; budget confirmed at 2.5 Cr.';
      const res = await request(app)
        .post('/api/mcp/tools/create_lead_note')
        .set('Authorization', `Bearer ${rawKeyA_Write}`)
        .send({
          leadId: leadAId,
          content: noteContent,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('executed');
      expect(res.body.data.tier).toBe('T1');
    });

    it('executes guarded write tool update_lead_status (Tier T2) with write scope', async () => {
      const res = await request(app)
        .post('/api/mcp/tools/update_lead_status')
        .set('Authorization', `Bearer ${rawKeyA_Write}`)
        .send({
          leadId: leadAId,
          status: 'contacted',
          reason: 'Initial qualification call completed.',
        });

      expect(res.status).toBe(200);
      expect(['executed', 'proposed']).toContain(res.body.data.status);
      expect(res.body.data.tier).toBe('T2');
    });

    it('strictly BLOCKS Tier T3 write tool send_payment_link as prohibited for AI', async () => {
      const res = await request(app)
        .post('/api/mcp/tools/send_payment_link')
        .set('Authorization', `Bearer ${rawKeyA_Write}`)
        .send({
          leadId: leadAId,
          amount: 500000,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('blocked');
      expect(res.body.data.tier).toBe('T3');
      expect(res.body.data.message).toContain('T3 actions');
    });

    it('creates audit log record for every MCP tool call', async () => {
      const logs = await testDb
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.companyId, companyAId),
            eq(auditLogs.action, 'mcp_tool_execution'),
          ),
        );

      expect(logs.length).toBeGreaterThan(0);
      const noteLog = logs.find((l) => l.resourceId === 'create_lead_note');
      expect(noteLog).toBeDefined();
      expect(noteLog!.details).toHaveProperty('durationMs');
      expect(noteLog!.details).toHaveProperty('apiKeyName');
    });

    it('handles JSON-RPC 2.0 tools/list and tools/call protocol requests', async () => {
      const rpcListRes = await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${rawKeyA_Read}`)
        .send({
          jsonrpc: '2.0',
          id: 'rpc-1',
          method: 'tools/list',
          params: {},
        });

      expect(rpcListRes.status).toBe(200);
      expect(rpcListRes.body.jsonrpc).toBe('2.0');
      expect(rpcListRes.body.result.tools.length).toBeGreaterThanOrEqual(5);

      const rpcCallRes = await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${rawKeyA_Read}`)
        .send({
          jsonrpc: '2.0',
          id: 'rpc-2',
          method: 'tools/call',
          params: {
            name: 'get_leads',
            arguments: { limit: 5 },
          },
        });

      expect(rpcCallRes.status).toBe(200);
      expect(rpcCallRes.body.result.content[0].text).toContain('leads');
    });
  });
});
