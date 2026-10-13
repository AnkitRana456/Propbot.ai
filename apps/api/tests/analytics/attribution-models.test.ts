import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import {
  companies,
  users,
  contacts,
  leads,
  leadActivities,
} from '../../src/db/schema/index.js';

describe('Attribution Models & Campaign ROI Engine', () => {
  const app = createApp();
  const companyId = '99999999-9999-9999-9999-999999999923';
  const userId = '00000000-0000-0000-0000-000000000204';

  const token = signAccessToken({
    sub: userId,
    companyId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@attribtest.com',
    name: 'Attrib Admin',
  });

  beforeAll(async () => {
    await cleanupTestDatabase([companyId]);

    await testDb
      .insert(companies)
      .values({ id: companyId, name: 'Attribution Realty', slug: 'attrib-realty', plan: 'enterprise', status: 'active' })
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values({ id: userId, companyId, name: 'Admin', email: 'admin@attribtest.com', role: 'company_admin', status: 'active', passwordHash: 'dummy' })
      .onConflictDoNothing();

    const contactId = '66666666-6666-6666-6666-666666666031';
    const leadId = '55555555-5555-5555-5555-555555555031';

    await testDb.insert(contacts).values({
      id: contactId,
      companyId,
      firstName: 'Ananya',
      lastName: 'Sharma',
      phone: '+919876500031',
    });

    // Lead created with initial Google Search campaign
    await testDb.insert(leads).values({
      id: leadId,
      companyId,
      contactId,
      status: 'booked',
      source: 'google_ads',
      customFields: { utm_campaign: 'Google_Search_3BHK', utm_source: 'google' },
    });

    // Lead has later activity with Facebook Remarketing campaign
    await testDb.insert(leadActivities).values({
      companyId,
      leadId,
      contactId,
      activityType: 'page_view',
      title: 'Visited Shortlist Room from FB Ad',
      metadata: { utm_campaign: 'Facebook_Remarketing', utm_source: 'facebook' },
    });
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  it('calculates First-Touch attribution giving 100% credit to initial campaign', async () => {
    const res = await request(app)
      .get('/api/analytics/attribution?model=first_touch')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.model).toBe('first_touch');

    const googleCampaign = data.campaigns.find(
      (c: { campaign: string }) => c.campaign === 'Google_Search_3BHK',
    );
    expect(googleCampaign).toBeDefined();
    expect(googleCampaign.leads).toBe(1);
    expect(googleCampaign.dealsClosed).toBe(1);
  });

  it('calculates Last-Touch attribution giving 100% credit to final campaign', async () => {
    const res = await request(app)
      .get('/api/analytics/attribution?model=last_touch')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.model).toBe('last_touch');

    const fbCampaign = data.campaigns.find(
      (c: { campaign: string }) => c.campaign === 'Facebook_Remarketing',
    );
    expect(fbCampaign).toBeDefined();
    expect(fbCampaign.leads).toBe(1);
    expect(fbCampaign.dealsClosed).toBe(1);
  });

  it('allows logging ad spend and calculates Cost Per Lead (CPL)', async () => {
    const postRes = await request(app)
      .post('/api/analytics/spends')
      .set('Authorization', `Bearer ${token}`)
      .send({
        campaignName: 'Google_Search_3BHK',
        source: 'google_ads',
        spendAmount: 25000,
        periodStart: '2026-10-01',
        periodEnd: '2026-10-31',
      });

    expect(postRes.status).toBe(201);
    expect(postRes.body.data.spendAmount).toBe(25000);

    const attribRes = await request(app)
      .get('/api/analytics/attribution?model=first_touch')
      .set('Authorization', `Bearer ${token}`);

    const googleCampaign = attribRes.body.data.campaigns.find(
      (c: { campaign: string }) => c.campaign === 'Google_Search_3BHK',
    );
    expect(googleCampaign).toBeDefined();
    expect(googleCampaign.spend).toBe(25000);
    expect(googleCampaign.costPerLead).toBe(25000);
  });
});
