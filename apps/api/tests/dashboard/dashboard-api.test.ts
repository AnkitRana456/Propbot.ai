import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { dashboardService } from '../../src/modules/dashboard/dashboard.service.js';

describe('Dashboard API Routes', () => {
  const app = createApp();

  const validToken = signAccessToken({
    sub: '00000000-0000-0000-0000-000000000001',
    companyId: '11111111-1111-1111-1111-111111111111',
    role: 'company_admin',
    status: 'active',
    email: 'admin@prestigegroup.com',
    name: 'Ankit Sharma',
  });

  describe('Authentication & Guard', () => {
    it('blocks /api/dashboard/stats without bearer token', async () => {
      const res = await request(app).get('/api/dashboard/stats');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('blocks /api/dashboard/recent-leads without bearer token', async () => {
      const res = await request(app).get('/api/dashboard/recent-leads');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('blocks /api/dashboard/notifications without bearer token', async () => {
      const res = await request(app).get('/api/dashboard/notifications');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Authenticated Dashboard Data Retrieval', () => {
    it('returns stats payload conforming to dashboardStatsSchema', async () => {
      vi.spyOn(dashboardService, 'getDashboardStats').mockResolvedValueOnce({
        totalLeads: 150,
        newLeads: 30,
        qualifiedLeads: 55,
        convertedLeads: 18,
        activeChatbots: 4,
        todayVisits: 7,
      });

      const res = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        totalLeads: 150,
        newLeads: 30,
        qualifiedLeads: 55,
        convertedLeads: 18,
        activeChatbots: 4,
        todayVisits: 7,
      });
    });

    it('returns recent leads conforming to recentLeadItemSchema', async () => {
      vi.spyOn(dashboardService, 'getRecentLeads').mockResolvedValueOnce([
        {
          id: '22222222-2222-4222-a222-222222222222',
          name: 'Priya Sundaram',
          phone: '+91 98450 98765',
          email: 'priya.s@example.com',
          status: 'site_visit_scheduled',
          priority: 'urgent',
          intentScore: 92,
          intentLabel: 'hot',
          source: 'WhatsApp Bot',
          createdAt: new Date().toISOString(),
        },
      ]);

      const res = await request(app)
        .get('/api/dashboard/recent-leads')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('Priya Sundaram');
      expect(res.body.data[0].intentLabel).toBe('hot');
    });

    it('returns notifications and unreadCount', async () => {
      vi.spyOn(dashboardService, 'getNotifications').mockResolvedValueOnce({
        unreadCount: 1,
        items: [
          {
            id: 'n1',
            type: 'lead_hot',
            title: '🔥 Hot Lead Alert',
            message: 'Priya Sundaram scheduled a site visit',
            isRead: false,
            createdAt: new Date().toISOString(),
          },
        ],
      });

      const res = await request(app)
        .get('/api/dashboard/notifications')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.unreadCount).toBe(1);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].title).toBe('🔥 Hot Lead Alert');
    });
  });
});
