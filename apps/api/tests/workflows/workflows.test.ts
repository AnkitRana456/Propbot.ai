import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { companies, users, companyAiSettings, workflows, workflowRuns, workflowRunSteps, leads, contacts } from '../../src/db/schema/index.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { workflowEngineService } from '../../src/modules/workflows/workflow-engine.service.js';
import { WORKFLOW_TEMPLATES } from '../../src/modules/workflows/workflow-templates.js';

describe('Phase 15B: Workflow Automation Engine & Canvas Endpoints', () => {
  const app = createApp();

  const companyAId = 'ba000000-0000-0000-0000-000000000001';
  const companyBId = 'ba000000-0000-0000-0000-000000000002';
  const userAId = 'ba000000-0000-0000-0000-000000000011';
  const userBId = 'ba000000-0000-0000-0000-000000000012';

  const tokenA = signAccessToken({
    sub: userAId,
    companyId: companyAId,
    role: 'company_admin',
    status: 'active',
    email: 'admin.a@workflow-test.com',
    name: 'Workflow Admin A',
  });

  const tokenB = signAccessToken({
    sub: userBId,
    companyId: companyBId,
    role: 'company_admin',
    status: 'active',
    email: 'admin.b@workflow-test.com',
    name: 'Workflow Admin B',
  });

  beforeAll(async () => {
    await cleanupTestDatabase([companyAId, companyBId]);

    await testDb
      .insert(companies)
      .values([
        {
          id: companyAId,
          name: 'Workflow Realty A',
          slug: 'workflow-realty-a',
          plan: 'growth',
          status: 'active',
        },
        {
          id: companyBId,
          name: 'Workflow Realty B',
          slug: 'workflow-realty-b',
          plan: 'growth',
          status: 'active',
        },
      ])
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values([
        {
          id: userAId,
          companyId: companyAId,
          name: 'Workflow Admin A',
          email: 'admin.a@workflow-test.com',
          passwordHash: 'hash',
          role: 'company_admin',
          status: 'active',
        },
        {
          id: userBId,
          companyId: companyBId,
          name: 'Workflow Admin B',
          email: 'admin.b@workflow-test.com',
          passwordHash: 'hash',
          role: 'company_admin',
          status: 'active',
        },
      ])
      .onConflictDoNothing();

    await testDb
      .insert(companyAiSettings)
      .values([
        {
          companyId: companyAId,
          killSwitch: false,
          allowedTiers: ['T0', 'T1', 'T2'],
          dailyActionCap: 100,
        },
        {
          companyId: companyBId,
          killSwitch: false,
          allowedTiers: ['T0', 'T1', 'T2'],
          dailyActionCap: 100,
        },
      ])
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyAId, companyBId]);
  });

  it('GET /api/workflows/templates returns built-in workflow templates', async () => {
    const res = await request(app)
      .get('/api/workflows/templates')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(4);
    expect(res.body.data[0].id).toBe('tpl_welcome_qualify');
  });

  it('POST /api/workflows/draft-from-prompt drafts workflow from natural language prompt', async () => {
    const res = await request(app)
      .post('/api/workflows/draft-from-prompt')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        prompt: 'Alert broker when hot lead asks for callback or unit pricing',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name.toLowerCase()).toContain('hot lead');
    expect(res.body.data.definition.nodes.length).toBeGreaterThanOrEqual(3);
  });

  it('POST /api/workflows creates a new workflow in draft state', async () => {
    const templateDef = WORKFLOW_TEMPLATES[0]!.definition;

    const res = await request(app)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'New Lead Welcome & Qualification Journey',
        description: 'Auto welcomes lead, checks budget > 50L, and notifies rep',
        definition: templateDef,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.name).toBe('New Lead Welcome & Qualification Journey');

    const workflowId = res.body.data.id;

    // GET /api/workflows returns this workflow
    const listRes = await request(app)
      .get('/api/workflows')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some((w: any) => w.id === workflowId)).toBe(true);

    // GET /api/workflows/:id
    const singleRes = await request(app)
      .get(`/api/workflows/${workflowId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(singleRes.status).toBe(200);
    expect(singleRes.body.data.id).toBe(workflowId);

    // PUT /api/workflows/:id updates workflow
    const updateRes = await request(app)
      .put(`/api/workflows/${workflowId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Updated Lead Welcome Journey',
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.name).toBe('Updated Lead Welcome Journey');

    // POST /api/workflows/:id/activate sets status to active
    const activateRes = await request(app)
      .post(`/api/workflows/${workflowId}/activate`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(activateRes.status).toBe(200);
    expect(activateRes.body.data.status).toBe('active');

    // POST /api/workflows/:id/pause sets status to paused
    const pauseRes = await request(app)
      .post(`/api/workflows/${workflowId}/pause`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(pauseRes.status).toBe(200);
    expect(pauseRes.body.data.status).toBe('paused');
  });

  it('POST /api/workflows/:id/test executes dry-run simulation of workflow', async () => {
    const templateDef = WORKFLOW_TEMPLATES[0]!.definition;

    const createRes = await request(app)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Simulation Test Workflow',
        definition: templateDef,
      });

    const workflowId = createRes.body.data.id;

    const testRes = await request(app)
      .post(`/api/workflows/${workflowId}/test`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        payload: {
          leadId: 'test-lead-123',
          budget: 7500000,
        },
      });

    expect(testRes.status).toBe(200);
    expect(testRes.body.success).toBe(true);
    expect(testRes.body.data.status).toBe('completed');
    expect(testRes.body.data.stepsExecuted).toBeGreaterThan(0);
  });

  it('WorkflowEngineService handles trigger events and creates run and step logs', async () => {
    // 1. Create and activate a workflow with a trigger node for "lead_created"
    const wfDef = {
      nodes: [
        {
          id: 'trigger-1',
          type: 'trigger' as const,
          config: { event_type: 'lead_created' },
          position: { x: 0, y: 0 },
        },
        {
          id: 'action-1',
          type: 'action' as const,
          config: {
            action_kind: 'send_whatsapp' as const,
            parameters: { template: 'quick_hello' },
          },
          position: { x: 200, y: 0 },
        },
      ],
      edges: [
        {
          id: 'e-1-2',
          source: 'trigger-1',
          target: 'action-1',
        },
      ],
    };

    const createRes = await request(app)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Trigger Event Test Flow',
        definition: wfDef,
      });

    const workflowId = createRes.body.data.id;

    // Activate it
    await request(app)
      .post(`/api/workflows/${workflowId}/activate`)
      .set('Authorization', `Bearer ${tokenA}`);

    const [contact] = await testDb
      .insert(contacts)
      .values({
        companyId: companyAId,
        firstName: 'Alok',
        phone: '+919876543210',
      })
      .returning();

    const [lead] = await testDb
      .insert(leads)
      .values({
        companyId: companyAId,
        contactId: contact!.id,
        source: 'web_chat',
        status: 'new',
      })
      .returning();

    // Trigger event through engine service
    const triggerResult = await workflowEngineService.handleTriggerEvent({
      id: 'event-outbox-999',
      companyId: companyAId,
      type: 'lead_created',
      payload: { leadId: lead!.id, name: 'Alok Nath' },
    });

    expect(triggerResult.matchedWorkflows).toBeGreaterThanOrEqual(1);
    expect(triggerResult.executedRuns).toBe(1);

    // Verify workflow runs endpoint
    const runsRes = await request(app)
      .get(`/api/workflows/${workflowId}/runs`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(runsRes.status).toBe(200);
    expect(runsRes.body.data.length).toBeGreaterThanOrEqual(1);

    const latestRun = runsRes.body.data[0];
    expect(latestRun.status).toBe('completed');

    // Verify run steps endpoint
    const stepsRes = await request(app)
      .get(`/api/workflows/runs/${latestRun.id}/steps`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(stepsRes.status).toBe(200);
    expect(stepsRes.body.data.length).toBe(2);
    expect(stepsRes.body.data[0].nodeType).toBe('trigger');
    expect(stepsRes.body.data[1].nodeType).toBe('action');
  });

  it('enforces multi-tenant isolation: Company B cannot access Company A workflows or runs', async () => {
    // 1. Create a workflow in Company A
    const createRes = await request(app)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Tenant A Secret Flow',
        definition: WORKFLOW_TEMPLATES[0]!.definition,
      });

    const workflowAId = createRes.body.data.id;

    // 2. Company B tries to fetch it -> 404
    const getRes = await request(app)
      .get(`/api/workflows/${workflowAId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(getRes.status).toBe(404);

    // 3. Company B tries to update it -> 404
    const putRes = await request(app)
      .put(`/api/workflows/${workflowAId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Hacked Name' });

    expect(putRes.status).toBe(404);

    // 4. Company B tries to activate it -> 404
    const actRes = await request(app)
      .post(`/api/workflows/${workflowAId}/activate`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(actRes.status).toBe(404);

    // 5. Company B listing does not contain Company A's workflow
    const listBRes = await request(app)
      .get('/api/workflows')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(listBRes.status).toBe(200);
    expect(listBRes.body.data.some((w: any) => w.id === workflowAId)).toBe(false);
  });
});
