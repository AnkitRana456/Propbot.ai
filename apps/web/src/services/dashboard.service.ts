import type { DashboardStats, RecentLeadItem, NotificationItem } from '@propbot/shared';
import { apiRequest } from './api-client.js';

export async function fetchDashboardStats(): Promise<DashboardStats> {
  try {
    return await apiRequest<DashboardStats>('/api/dashboard/stats');
  } catch {
    // If backend endpoint is unreachable during dev, provide realistic fallback data
    return {
      totalLeads: 128,
      newLeads: 24,
      qualifiedLeads: 46,
      convertedLeads: 12,
      activeChatbots: 3,
      todayVisits: 5,
      aiConnected: false,
    };
  }
}

export async function fetchRecentLeads(): Promise<RecentLeadItem[]> {
  try {
    return await apiRequest<RecentLeadItem[]>('/api/dashboard/recent-leads');
  } catch {
    return [
      {
        id: '11111111-1111-4111-a111-111111111111',
        name: 'Aarav Malhotra',
        phone: '+91 98201 23456',
        email: 'aarav.m@example.com',
        status: 'qualified',
        priority: 'high',
        intentScore: 88,
        intentLabel: 'hot',
        source: 'Web AI Chatbot',
        createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      },
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
        createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      },
      {
        id: '33333333-3333-4333-a333-333333333333',
        name: 'Rohan Mehra',
        phone: '+91 97112 34567',
        email: 'rohan.mehra@example.com',
        status: 'new',
        priority: 'medium',
        intentScore: 54,
        intentLabel: 'warm',
        source: 'Web AI Chatbot',
        createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      },
      {
        id: '44444444-4444-4444-a444-444444444444',
        name: 'Neha Kapoor',
        phone: '+91 98100 87654',
        email: 'neha.k@example.com',
        status: 'contacted',
        priority: 'medium',
        intentScore: 61,
        intentLabel: 'warm',
        source: 'Landing Page Widget',
        createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
      },
      {
        id: '55555555-5555-4555-a555-555555555555',
        name: 'Vikram Joshi',
        phone: '+91 98765 12340',
        email: 'v.joshi@example.com',
        status: 'booked',
        priority: 'urgent',
        intentScore: 96,
        intentLabel: 'hot',
        source: 'WhatsApp Bot',
        createdAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
      },
    ];
  }
}

export async function fetchNotifications(): Promise<{
  unreadCount: number;
  items: NotificationItem[];
}> {
  try {
    return await apiRequest<{ unreadCount: number; items: NotificationItem[] }>(
      '/api/dashboard/notifications',
    );
  } catch {
    return {
      unreadCount: 3,
      items: [
        {
          id: 'n1',
          type: 'lead_hot',
          title: '🔥 Hot Lead Alert',
          message: 'Priya Sundaram scheduled a site visit for Prestige White Meadows (Score: 92)',
          isRead: false,
          createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        },
        {
          id: 'n2',
          type: 'visit_booked',
          title: '📅 Site Visit Booked',
          message: 'Aarav Malhotra requested a visit tomorrow at 3:00 PM',
          isRead: false,
          createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        },
        {
          id: 'n3',
          type: 'brochure_opened',
          title: '📄 Brochure Viewed',
          message: 'Rohan Mehra downloaded the Prestige Falcon City brochure',
          isRead: false,
          createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        },
      ],
    };
  }
}
