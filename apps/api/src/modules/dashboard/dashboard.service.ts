import { eq, and, sql, desc, gte, lte, isNull } from 'drizzle-orm';
import type { DashboardStats, RecentLeadItem, NotificationItem } from '@propbot/shared';
import { db } from '../../db/index.js';
import { leads, contacts, chatbots, appointments, notifications } from '../../db/schema/index.js';

export class DashboardService {
  async getDashboardStats(companyId: string): Promise<DashboardStats> {
    // 1. Leads counts
    const [leadsCounts] = await db
      .select({
        total: sql<number>`count(*)::int`,
        newCount: sql<number>`count(case when ${leads.status} = 'new' then 1 end)::int`,
        qualifiedCount: sql<number>`count(case when ${leads.status} = 'qualified' then 1 end)::int`,
        convertedCount: sql<number>`count(case when ${leads.status} in ('booked', 'converted') then 1 end)::int`,
      })
      .from(leads)
      .where(and(eq(leads.companyId, companyId), isNull(leads.deletedAt)));

    // 2. Active chatbots
    const [botCount] = await db
      .select({
        active: sql<number>`count(*)::int`,
      })
      .from(chatbots)
      .where(
        and(
          eq(chatbots.companyId, companyId),
          eq(chatbots.status, 'active'),
          isNull(chatbots.deletedAt),
        ),
      );

    // 3. Today's visits
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const [visitCount] = await db
      .select({
        today: sql<number>`count(*)::int`,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.companyId, companyId),
          gte(appointments.scheduledAt, startOfDay),
          lte(appointments.scheduledAt, endOfDay),
          sql`${appointments.status} != 'cancelled'`,
        ),
      );

    return {
      totalLeads: leadsCounts?.total ?? 0,
      newLeads: leadsCounts?.newCount ?? 0,
      qualifiedLeads: leadsCounts?.qualifiedCount ?? 0,
      convertedLeads: leadsCounts?.convertedCount ?? 0,
      activeChatbots: botCount?.active ?? 0,
      todayVisits: visitCount?.today ?? 0,
    };
  }

  async getRecentLeads(companyId: string, limit = 5): Promise<RecentLeadItem[]> {
    const rawLeads = await db
      .select({
        id: leads.id,
        contactFirstName: contacts.firstName,
        contactLastName: contacts.lastName,
        contactPhone: contacts.phone,
        contactEmail: contacts.email,
        status: leads.status,
        priority: leads.priority,
        intentScore: leads.intentScore,
        intentLabel: leads.intentLabel,
        source: leads.source,
        createdAt: leads.createdAt,
      })
      .from(leads)
      .leftJoin(contacts, eq(leads.contactId, contacts.id))
      .where(and(eq(leads.companyId, companyId), isNull(leads.deletedAt)))
      .orderBy(desc(leads.createdAt))
      .limit(limit);

    return rawLeads.map(row => {
      const name =
        [row.contactFirstName, row.contactLastName].filter(Boolean).join(' ') ||
        'Prospective Buyer';
      return {
        id: row.id,
        name,
        phone: row.contactPhone ?? '—',
        email: row.contactEmail ?? null,
        status: row.status,
        priority: row.priority,
        intentScore: row.intentScore,
        intentLabel: row.intentLabel,
        source: row.source,
        createdAt: row.createdAt.toISOString(),
      };
    });
  }

  async getNotifications(
    companyId: string,
    userId: string,
  ): Promise<{ unreadCount: number; items: NotificationItem[] }> {
    const items = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        message: notifications.message,
        isRead: notifications.isRead,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(and(eq(notifications.companyId, companyId), eq(notifications.userId, userId)))
      .orderBy(desc(notifications.createdAt))
      .limit(10);

    const [unread] = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(notifications)
      .where(
        and(
          eq(notifications.companyId, companyId),
          eq(notifications.userId, userId),
          eq(notifications.isRead, false),
        ),
      );

    return {
      unreadCount: unread?.count ?? 0,
      items: items.map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
      })),
    };
  }
}

export const dashboardService = new DashboardService();
