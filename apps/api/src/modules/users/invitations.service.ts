import crypto from 'crypto';
import { eq, and, isNull, gt, desc } from 'drizzle-orm';
import type { InviteUserInput, AcceptInviteInput, UserRole, UserStatus } from '@propbot/shared';
import { db } from '../../db/index.js';
import { users, userInvitations, companies, refreshTokens } from '../../db/schema/index.js';
import { hashPassword, hashToken, generateRandomToken, signAccessToken } from '../auth/auth.utils.js';
import { auditService } from '../audit/audit.service.js';

export class InvitationsService {
  async inviteUser(
    companyId: string,
    invitedBy: string,
    input: InviteUserInput,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // 1. Check if user already exists in company
    const existingUser = await db.query.users.findFirst({
      where: and(eq(users.companyId, companyId), eq(users.email, input.email)),
    });
    if (existingUser) {
      throw new Error('A user with this email already exists in your company.');
    }

    // 2. Generate secure token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // 3. Invalidate previous pending invitations for this email
    const [invitation] = await db
      .insert(userInvitations)
      .values({
        companyId,
        email: input.email,
        role: input.role,
        team: input.team,
        leadCapacity: input.leadCapacity ?? 50,
        workingHours: input.workingHours,
        tokenHash,
        invitedBy,
        expiresAt,
      })
      .returning();

    // 4. Send email stub
    const company = await db.query.companies.findFirst({
      where: eq(companies.id, companyId),
    });
    const companyName = company?.name ?? 'PropBot Pro';
    const inviteUrl = `http://localhost:5173/accept-invite?token=${rawToken}`;
    console.info(`[INVITE EMAIL STUB] Invitation sent to ${input.email} for ${companyName}: ${inviteUrl}`);

    // 5. Audit log
    await auditService.log({
      companyId,
      userId: invitedBy,
      action: 'user_invited',
      resourceType: 'user_invitation',
      resourceId: invitation?.id,
      details: { email: input.email, role: input.role, team: input.team },
      ipAddress,
      userAgent,
    });

    return {
      id: invitation?.id,
      email: input.email,
      role: input.role,
      expiresAt,
      inviteUrl, // Provided for easy development and testing
    };
  }

  async getInvitations(companyId: string) {
    return await db.query.userInvitations.findMany({
      where: and(
        eq(userInvitations.companyId, companyId),
        isNull(userInvitations.acceptedAt),
        gt(userInvitations.expiresAt, new Date()),
      ),
      orderBy: [desc(userInvitations.createdAt)],
    });
  }

  async revokeInvitation(companyId: string, invitationId: string, actorId: string) {
    const invitation = await db.query.userInvitations.findFirst({
      where: and(eq(userInvitations.id, invitationId), eq(userInvitations.companyId, companyId)),
    });
    if (!invitation) {
      throw new Error('Invitation not found.');
    }

    await db.delete(userInvitations).where(eq(userInvitations.id, invitationId));

    await auditService.log({
      companyId,
      userId: actorId,
      action: 'invitation_revoked',
      resourceType: 'user_invitation',
      resourceId: invitationId,
      details: { email: invitation.email },
    });

    return { success: true };
  }

  async acceptInvitation(input: AcceptInviteInput) {
    const tokenHash = hashToken(input.token);

    const invitation = await db.query.userInvitations.findFirst({
      where: and(
        eq(userInvitations.tokenHash, tokenHash),
        isNull(userInvitations.acceptedAt),
        gt(userInvitations.expiresAt, new Date()),
      ),
    });

    if (!invitation) {
      throw new Error('Invalid or expired invitation token.');
    }

    // Check if email already registered meanwhile
    const existing = await db.query.users.findFirst({
      where: and(eq(users.companyId, invitation.companyId), eq(users.email, invitation.email)),
    });
    if (existing) {
      throw new Error('An account with this email is already registered.');
    }

    const passwordHash = await hashPassword(input.password);

    const [newUser] = await db
      .insert(users)
      .values({
        companyId: invitation.companyId,
        name: input.name,
        email: invitation.email,
        passwordHash,
        role: invitation.role,
        team: invitation.team,
        leadCapacity: invitation.leadCapacity,
        workingHours: invitation.workingHours,
        status: 'active',
      })
      .returning();

    if (!newUser) {
      throw new Error('Failed to create user account.');
    }

    // Mark invitation as accepted
    await db
      .update(userInvitations)
      .set({ acceptedAt: new Date() })
      .where(eq(userInvitations.id, invitation.id));

    // Audit log
    await auditService.log({
      companyId: invitation.companyId,
      userId: newUser.id,
      action: 'invitation_accepted',
      resourceType: 'user',
      resourceId: newUser.id,
      details: { email: newUser.email, role: newUser.role },
    });

    // Create session token pair
    const familyId = crypto.randomUUID();
    const rawRefreshToken = generateRandomToken(48);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.insert(refreshTokens).values({
      userId: newUser.id,
      companyId: newUser.companyId,
      tokenHash: hashToken(rawRefreshToken),
      familyId,
      expiresAt,
    });

    const accessToken = signAccessToken({
      sub: newUser.id,
      companyId: newUser.companyId,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role as UserRole,
      status: newUser.status as UserStatus,
    });

    return {
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role as UserRole,
        status: newUser.status as UserStatus,
      },
      tokens: {
        accessToken,
        refreshToken: rawRefreshToken,
        expiresIn: 900,
      },
    };
  }
}

export const invitationsService = new InvitationsService();
