import { eq, and } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { companySsoConfigs, users } from '../../db/schema/index.js';
import { signAccessToken } from '../auth/auth.utils.js';
import { auditService } from '../audit/audit.service.js';
import type { ConfigureSsoRequest, UserRole, UserStatus } from '@propbot/shared';
import { pino } from 'pino';

export const ssoLogger = pino({
  name: 'enterprise-sso',
  level: process.env.LOG_LEVEL ?? 'info',
});

function formatSsoConfig(config: typeof companySsoConfigs.$inferSelect | undefined) {
  if (!config) return null;
  return {
    id: config.id,
    companyId: config.companyId,
    ssoProvider: config.providerType,
    domain: config.domain,
    issuer: config.entityId,
    ssoUrl: config.ssoUrl,
    certificate: config.certificate,
    clientId: config.clientId,
    isActive: config.isActive,
    isEnforced: config.enforceForDomain,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

export class SsoService {
  /**
   * Configures or updates SSO for a company.
   */
  async configureSso(companyId: string, input: ConfigureSsoRequest, actorId?: string) {
    const existing = await db.query.companySsoConfigs.findFirst({
      where: eq(companySsoConfigs.companyId, companyId),
    });

    const values = {
      providerType: input.ssoProvider || 'saml',
      domain: input.domain.toLowerCase(),
      entityId: input.issuer,
      ssoUrl: input.ssoUrl,
      certificate: input.certificate,
      clientId: input.clientId,
      clientSecret: input.clientSecret,
      isActive: input.isActive ?? true,
      enforceForDomain: input.isEnforced ?? false,
      updatedAt: new Date(),
    };

    let config;
    if (existing) {
      const [updated] = await db
        .update(companySsoConfigs)
        .set(values)
        .where(eq(companySsoConfigs.id, existing.id))
        .returning();
      config = updated;
    } else {
      const [created] = await db
        .insert(companySsoConfigs)
        .values({
          companyId,
          ...values,
        })
        .returning();
      config = created;
    }

    await auditService.log({
      companyId,
      userId: actorId,
      action: 'sso_configured',
      resourceType: 'sso_config',
      resourceId: config?.id,
      details: {
        ssoProvider: input.ssoProvider,
        domain: input.domain,
        isEnforced: input.isEnforced,
      },
    });

    return formatSsoConfig(config);
  }

  /**
   * Retrieves SSO configuration for a company.
   */
  async getSsoConfig(companyId: string) {
    const config = await db.query.companySsoConfigs.findFirst({
      where: eq(companySsoConfigs.companyId, companyId),
    });
    return formatSsoConfig(config);
  }

  /**
   * Checks if SSO is enforced for a given domain or email.
   */
  async isSsoEnforcedForEmail(email: string): Promise<{ enforced: boolean; ssoUrl?: string }> {
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return { enforced: false };

    const config = await db.query.companySsoConfigs.findFirst({
      where: and(
        eq(companySsoConfigs.domain, domain),
        eq(companySsoConfigs.isActive, true),
        eq(companySsoConfigs.enforceForDomain, true),
      ),
    });

    if (config && config.ssoUrl) {
      return { enforced: true, ssoUrl: config.ssoUrl };
    }

    return { enforced: false };
  }

  /**
   * Initiates SSO login redirect.
   */
  async initiateSso(domain: string) {
    const config = await db.query.companySsoConfigs.findFirst({
      where: and(
        eq(companySsoConfigs.domain, domain.toLowerCase()),
        eq(companySsoConfigs.isActive, true),
      ),
    });

    if (!config || !config.ssoUrl) {
      throw new Error(`SSO not configured or inactive for domain: ${domain}`);
    }

    const redirectUrl = `${config.ssoUrl}?entityID=${encodeURIComponent(config.entityId || '')}&relayState=${Date.now()}`;
    return { redirectUrl, provider: config.providerType };
  }

  /**
   * Validates SSO callback assertion and issues JWT token pair.
   */
  async handleSsoCallback(data: {
    domain: string;
    email: string;
    name: string;
    assertion?: string;
  }) {
    const cleanDomain = data.domain.toLowerCase();
    const config = await db.query.companySsoConfigs.findFirst({
      where: and(
        eq(companySsoConfigs.domain, cleanDomain),
        eq(companySsoConfigs.isActive, true),
      ),
    });

    if (!config) {
      throw new Error(`Invalid SSO callback: No active SSO configuration for domain ${cleanDomain}`);
    }

    // Auto-provision or find existing user under company
    let user = await db.query.users.findFirst({
      where: and(
        eq(users.companyId, config.companyId),
        eq(users.email, data.email.toLowerCase()),
      ),
    });

    if (!user) {
      const [newUser] = await db
        .insert(users)
        .values({
          companyId: config.companyId,
          email: data.email.toLowerCase(),
          name: data.name || data.email.split('@')[0]!,
          passwordHash: 'SSO_MANAGED_ACCOUNT',
          role: 'agent',
          status: 'active',
        })
        .returning();
      user = newUser;

      await auditService.log({
        companyId: config.companyId,
        action: 'user_sso_provisioned',
        resourceType: 'user',
        resourceId: user?.id,
        details: { email: data.email, domain: cleanDomain, ssoProvider: config.providerType },
      });
    }

    const token = signAccessToken({
      sub: user!.id,
      companyId: config.companyId,
      role: user!.role as UserRole,
      status: user!.status as UserStatus,
      email: user!.email,
      name: user!.name,
    });

    await auditService.log({
      companyId: config.companyId,
      userId: user!.id,
      action: 'sso_login_successful',
      resourceType: 'auth',
      details: { ssoProvider: config.providerType },
    });

    return {
      token,
      user: {
        id: user!.id,
        name: user!.name,
        email: user!.email,
        role: user!.role,
      },
      companyId: config.companyId,
    };
  }
}

export const ssoService = new SsoService();
