import { eq, and, or, ilike, desc, isNull } from 'drizzle-orm';
import type { UpdateUserInput, UserFilter, UserKpiMetrics } from '@propbot/shared';
import { db } from '../../db/index.js';
import { users, refreshTokens } from '../../db/schema/index.js';
import { auditService } from '../audit/audit.service.js';

export class UsersService {
  async getUsers(companyId: string, isSuperAdmin: boolean, filter: UserFilter) {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions = [];

    if (!isSuperAdmin) {
      conditions.push(eq(users.companyId, companyId));
    }
    conditions.push(isNull(users.deletedAt));

    if (filter.role) {
      conditions.push(eq(users.role, filter.role));
    }
    if (filter.status) {
      conditions.push(eq(users.status, filter.status));
    }
    if (filter.team) {
      conditions.push(eq(users.team, filter.team));
    }
    if (filter.q) {
      conditions.push(
        or(ilike(users.name, `%${filter.q}%`), ilike(users.email, `%${filter.q}%`))!,
      );
    }

    const whereClause = and(...conditions);

    const userList = await db.query.users.findMany({
      where: whereClause,
      orderBy: [desc(users.createdAt)],
      limit,
      offset,
      columns: {
        id: true,
        companyId: true,
        name: true,
        email: true,
        role: true,
        team: true,
        status: true,
        workingHours: true,
        leadCapacity: true,
        assignedChatbots: true,
        twoFactorEnabled: true,
        lastLoginAt: true,
        createdAt: true,
      },
      with: {
        company: {
          columns: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    const allMatching = await db.query.users.findMany({
      where: whereClause,
      columns: { id: true },
    });

    return {
      users: userList,
      pagination: {
        page,
        limit,
        total: allMatching.length,
        totalPages: Math.ceil(allMatching.length / limit),
      },
    };
  }

  async getKpis(companyId: string, isSuperAdmin: boolean): Promise<UserKpiMetrics> {
    const companyFilter = isSuperAdmin ? undefined : eq(users.companyId, companyId);
    const notDeleted = isNull(users.deletedAt);
    const whereClause = companyFilter ? and(companyFilter, notDeleted) : notDeleted;

    const allUsers = await db.query.users.findMany({
      where: whereClause,
      columns: { id: true, status: true, companyId: true },
    });

    const allCompanies = await db.query.companies.findMany({
      columns: { id: true },
    });

    const totalUsers = allUsers.length;
    const activeUsers = allUsers.filter(u => u.status === 'active').length;
    const pendingApproval = allUsers.filter(u => u.status === 'pending_approval').length;
    const companiesCount = isSuperAdmin
      ? allCompanies.length
      : new Set(allUsers.map(u => u.companyId)).size;

    return {
      totalUsers,
      activeUsers,
      pendingApproval,
      companiesCount,
    };
  }

  async updateUser(
    companyId: string,
    targetUserId: string,
    input: UpdateUserInput,
    actorId: string,
    isSuperAdmin = false,
  ) {
    const user = await db.query.users.findFirst({
      where: isSuperAdmin
        ? eq(users.id, targetUserId)
        : and(eq(users.id, targetUserId), eq(users.companyId, companyId)),
    });

    if (!user) {
      throw new Error('User not found.');
    }

    // Privilege-escalation guard: only a ps-owner may grant, change or edit the ps-owner role.
    if (!isSuperAdmin && (input.role === 'ps-owner' || user.role === 'ps-owner')) {
      throw Object.assign(new Error('Only a platform owner can manage the ps-owner role.'), {
        statusCode: 403,
        code: 'FORBIDDEN_ROLE',
      });
    }

    // Safety guard: Last company_admin cannot be demoted or disabled
    if (
      user.role === 'company_admin' &&
      ((input.role && input.role !== 'company_admin') || input.status === 'disabled')
    ) {
      const activeAdmins = await db.query.users.findMany({
        where: and(
          eq(users.companyId, user.companyId),
          eq(users.role, 'company_admin'),
          eq(users.status, 'active'),
          isNull(users.deletedAt),
        ),
      });

      if (activeAdmins.length <= 1) {
        throw new Error('Cannot demote or disable the last active company administrator.');
      }
    }

    const [updatedUser] = await db
      .update(users)
      .set({
        name: input.name ?? user.name,
        role: input.role ?? user.role,
        team: input.team !== undefined ? input.team : user.team,
        leadCapacity: input.leadCapacity !== undefined ? input.leadCapacity : user.leadCapacity,
        workingHours: input.workingHours !== undefined ? input.workingHours : user.workingHours,
        assignedChatbots:
          input.assignedChatbots !== undefined ? input.assignedChatbots : user.assignedChatbots,
        status: input.status ?? user.status,
        updatedAt: new Date(),
      })
      .where(eq(users.id, targetUserId))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        team: users.team,
        status: users.status,
        workingHours: users.workingHours,
        leadCapacity: users.leadCapacity,
        assignedChatbots: users.assignedChatbots,
        twoFactorEnabled: users.twoFactorEnabled,
      });

    await auditService.log({
      companyId: user.companyId,
      userId: actorId,
      action: input.role && input.role !== user.role ? 'role_changed' : 'user_updated',
      resourceType: 'user',
      resourceId: targetUserId,
      details: { previousRole: user.role, newRole: input.role, changes: input },
    });

    return updatedUser;
  }

  async deleteUser(companyId: string, targetUserId: string, actorId: string, isSuperAdmin = false) {
    const user = await db.query.users.findFirst({
      where: isSuperAdmin
        ? eq(users.id, targetUserId)
        : and(eq(users.id, targetUserId), eq(users.companyId, companyId)),
    });

    if (!user) {
      throw new Error('User not found.');
    }

    if (user.role === 'company_admin') {
      const activeAdmins = await db.query.users.findMany({
        where: and(
          eq(users.companyId, user.companyId),
          eq(users.role, 'company_admin'),
          eq(users.status, 'active'),
          isNull(users.deletedAt),
        ),
      });

      if (activeAdmins.length <= 1) {
        throw new Error('Cannot delete the last remaining company administrator.');
      }
    }

    // Soft delete and disable
    await db
      .update(users)
      .set({
        deletedAt: new Date(),
        status: 'disabled',
        updatedAt: new Date(),
      })
      .where(eq(users.id, targetUserId));

    // Revoke all active sessions
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.userId, targetUserId));

    await auditService.log({
      companyId: user.companyId,
      userId: actorId,
      action: 'user_deleted',
      resourceType: 'user',
      resourceId: targetUserId,
      details: { email: user.email, name: user.name },
    });

    return { success: true };
  }

  async resetTwoFactor(companyId: string, targetUserId: string, actorId: string) {
    const user = await db.query.users.findFirst({
      where: and(eq(users.id, targetUserId), eq(users.companyId, companyId)),
    });

    if (!user) {
      throw new Error('User not found.');
    }

    await db
      .update(users)
      .set({
        twoFactorEnabled: false,
        twoFactorSecret: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, targetUserId));

    await auditService.log({
      companyId,
      userId: actorId,
      action: 'two_factor_reset',
      resourceType: 'user',
      resourceId: targetUserId,
      details: { email: user.email },
    });

    return { success: true, message: 'Two-factor authentication has been reset for the user.' };
  }

  async getUserSessions(userId: string) {
    const tokens = await db.query.refreshTokens.findMany({
      where: and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)),
      orderBy: [desc(refreshTokens.createdAt)],
    });

    // Group by familyId
    const seenFamilies = new Set<string>();
    const sessions = [];

    for (const token of tokens) {
      if (!seenFamilies.has(token.familyId)) {
        seenFamilies.add(token.familyId);
        sessions.push({
          familyId: token.familyId,
          device: 'Browser Session',
          ipAddress: null,
          lastActiveAt: token.createdAt.toISOString(),
          isCurrent: sessions.length === 0,
        });
      }
    }

    return sessions;
  }

  async revokeSession(userId: string, familyId: string, _actorId?: string) {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), eq(refreshTokens.familyId, familyId)));

    return { success: true };
  }
}

export const usersService = new UsersService();
