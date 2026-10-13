import crypto from 'crypto';
import { eq, and, gt, isNull } from 'drizzle-orm';
import type { RegisterCompanyInput, LoginInput, UserRole, UserStatus } from '@propbot/shared';
import { db } from '../../db/index.js';
import {
  companies,
  companyAiSettings,
  companySsoConfigs,
  users,
  refreshTokens,
  passwordResetTokens,
} from '../../db/schema/index.js';
import {
  hashPassword,
  comparePassword,
  generateRandomToken,
  hashToken,
  signAccessToken,
} from './auth.utils.js';
import { emailStub } from './email-stub.js';

export class AuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export class AuthService {
  async registerCompany(input: RegisterCompanyInput) {
    // 1. Validate slug uniqueness
    const existingCompany = await db.query.companies.findFirst({
      where: eq(companies.slug, input.companySlug),
    });
    if (existingCompany) {
      throw new AuthError('SLUG_TAKEN', 'The company slug is already registered.', 409);
    }

    // 2. Validate email uniqueness
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, input.adminEmail),
    });
    if (existingUser) {
      throw new AuthError('EMAIL_TAKEN', 'An account with this email already exists.', 409);
    }

    // 3. Create company & first company_admin
    const passwordHash = await hashPassword(input.password);

    const [company] = await db
      .insert(companies)
      .values({
        name: input.companyName,
        slug: input.companySlug,
        plan: 'trial',
        status: 'active',
      })
      .returning();

    if (!company) {
      throw new AuthError('REGISTRATION_FAILED', 'Failed to create company record.', 500);
    }

    await db.insert(companyAiSettings).values({
      companyId: company.id,
      killSwitch: false,
      allowedTiers: ['T0', 'T1'],
      dailyActionCap: 100,
    });

    const [adminUser] = await db
      .insert(users)
      .values({
        companyId: company.id,
        name: input.adminName,
        email: input.adminEmail,
        passwordHash,
        role: 'company_admin',
        status: 'active', // First company admin is pre-approved
      })
      .returning();

    if (!adminUser) {
      throw new AuthError('REGISTRATION_FAILED', 'Failed to create company administrator.', 500);
    }

    // 4. Issue access and refresh tokens
    const tokens = await this.createTokenPair(adminUser, company.id);

    return {
      user: {
        id: adminUser.id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role as UserRole,
        status: adminUser.status as UserStatus,
      },
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        plan: company.plan,
      },
      tokens,
    };
  }

  async login(input: LoginInput) {
    const user = await db.query.users.findFirst({
      where: eq(users.email, input.email),
    });

    if (!user) {
      throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password.', 401);
    }

    const company = await db.query.companies.findFirst({
      where: eq(companies.id, user.companyId),
    });

    if (!company) {
      throw new AuthError('COMPANY_NOT_FOUND', 'Company not found.', 404);
    }

    if (input.companySlug && company.slug !== input.companySlug) {
      throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or company context.', 401);
    }

    // Check account status
    if (user.status === 'pending_approval') {
      throw new AuthError(
        'ACCOUNT_PENDING_APPROVAL',
        'Your account is pending administrator approval. Please contact your company administrator.',
        403,
      );
    }

    if (user.status === 'disabled') {
      throw new AuthError('ACCOUNT_DISABLED', 'Your account has been disabled.', 403);
    }

    // Check if company enforces Single Sign-On (SSO)
    const ssoConfig = await db.query.companySsoConfigs.findFirst({
      where: and(
        eq(companySsoConfigs.companyId, company.id),
        eq(companySsoConfigs.isActive, true),
        eq(companySsoConfigs.enforceForDomain, true),
      ),
    });

    if (ssoConfig) {
      throw new AuthError(
        'SSO_ENFORCED',
        'Single Sign-On (SSO) is enforced for your organization. Please sign in via your Identity Provider.',
        403,
      );
    }

    const isPasswordValid = await comparePassword(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password.', 401);
    }

    // Check 2FA enforcement for enterprise companies
    const companySettings = (company.settings as Record<string, unknown>) || {};
    if (companySettings.enforce2FA === true && !user.twoFactorEnabled) {
      return {
        requires2faSetup: true,
        message: 'Your organization enforces Two-Factor Authentication (2FA). Please configure 2FA to complete sign-in.',
        userId: user.id,
      };
    }

    // Update lastLoginAt
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

    const tokens = await this.createTokenPair(user, user.companyId);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role as UserRole,
        status: user.status as UserStatus,
      },
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        plan: company.plan,
      },
      tokens,
    };
  }

  async refreshToken(rawRefreshToken: string) {
    const tokenHash = hashToken(rawRefreshToken);

    const tokenRecord = await db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.tokenHash, tokenHash),
    });

    if (!tokenRecord) {
      throw new AuthError('INVALID_REFRESH_TOKEN', 'Refresh token is invalid.', 401);
    }

    // Reuse detection: if token is already revoked, invalidate entire family!
    if (tokenRecord.revokedAt !== null) {
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.familyId, tokenRecord.familyId));

      throw new AuthError(
        'TOKEN_REUSE_DETECTED',
        'Compromised refresh token reused. All active sessions have been invalidated.',
        401,
      );
    }

    if (tokenRecord.expiresAt < new Date()) {
      throw new AuthError('TOKEN_EXPIRED', 'Refresh token has expired.', 401);
    }

    // Revoke used token
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, tokenRecord.id));

    // Verify user is still active
    const user = await db.query.users.findFirst({
      where: eq(users.id, tokenRecord.userId),
    });

    if (!user || user.status !== 'active') {
      throw new AuthError('USER_INACTIVE', 'User is no longer active.', 403);
    }

    // Issue new pair in the same family
    const newRawRefreshToken = generateRandomToken(48);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db.insert(refreshTokens).values({
      userId: user.id,
      companyId: user.companyId,
      tokenHash: hashToken(newRawRefreshToken),
      familyId: tokenRecord.familyId,
      expiresAt: newExpiresAt,
    });

    const accessToken = signAccessToken({
      sub: user.id,
      companyId: user.companyId,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      status: user.status as UserStatus,
    });

    return {
      accessToken,
      refreshToken: newRawRefreshToken,
      expiresIn: 900, // 15 mins in seconds
    };
  }

  async logout(rawRefreshToken: string, allDevices = false, userId?: string) {
    const tokenHash = hashToken(rawRefreshToken);

    if (allDevices && userId) {
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
      return;
    }

    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, tokenHash));
  }

  async forgotPassword(email: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    // Anti-enumeration: always return success
    if (!user || user.status !== 'active') {
      return { message: 'If an account exists, a password reset link has been dispatched.' };
    }

    const resetToken = generateRandomToken(32);
    const tokenHash = hashToken(resetToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    await emailStub.sendPasswordResetEmail(email, resetToken);

    return { message: 'If an account exists, a password reset link has been dispatched.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = hashToken(token);

    const resetRecord = await db.query.passwordResetTokens.findFirst({
      where: and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date()),
      ),
    });

    if (!resetRecord) {
      throw new AuthError(
        'INVALID_RESET_TOKEN',
        'Password reset token is invalid or expired.',
        400,
      );
    }

    const newHash = await hashPassword(newPassword);

    // Update password
    await db
      .update(users)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(users.id, resetRecord.userId));

    // Mark token used
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, resetRecord.id));

    // Invalidate all active sessions for security
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.userId, resetRecord.userId));

    return {
      message: 'Password has been reset successfully. Please log in with your new password.',
    };
  }

  async getPendingUsers(companyId: string) {
    return await db.query.users.findMany({
      where: and(eq(users.companyId, companyId), eq(users.status, 'pending_approval')),
      columns: {
        id: true,
        name: true,
        email: true,
        role: true,
        team: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async approveUser(companyId: string, userId: string) {
    const user = await db.query.users.findFirst({
      where: and(eq(users.id, userId), eq(users.companyId, companyId)),
    });

    if (!user) {
      throw new AuthError('USER_NOT_FOUND', 'User not found in your company.', 404);
    }

    const [updatedUser] = await db
      .update(users)
      .set({ status: 'active', updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        status: users.status,
      });

    return updatedUser;
  }

  async rejectUser(companyId: string, userId: string) {
    const user = await db.query.users.findFirst({
      where: and(eq(users.id, userId), eq(users.companyId, companyId)),
    });

    if (!user) {
      throw new AuthError('USER_NOT_FOUND', 'User not found in your company.', 404);
    }

    const [updatedUser] = await db
      .update(users)
      .set({ status: 'disabled', updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        status: users.status,
      });

    return updatedUser;
  }

  private async createTokenPair(
    user: { id: string; name: string; email: string; role: string; status: string },
    companyId: string,
  ) {
    const familyId = crypto.randomUUID();
    const rawRefreshToken = generateRandomToken(48);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db.insert(refreshTokens).values({
      userId: user.id,
      companyId,
      tokenHash: hashToken(rawRefreshToken),
      familyId,
      expiresAt,
    });

    const accessToken = signAccessToken({
      sub: user.id,
      companyId,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      status: user.status as UserStatus,
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: 900,
    };
  }
}

export const authService = new AuthService();
