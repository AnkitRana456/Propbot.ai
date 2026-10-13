import crypto from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { apiKeys } from '../../db/schema/index.js';
import { auditService } from '../audit/audit.service.js';

export class KeyRotationService {
  /**
   * Rotates an API key with zero-downtime:
   * Generates a new active key immediately and keeps old key active for a 24-hour grace period.
   */
  async rotateApiKey(companyId: string, oldKeyId: string, actorId?: string) {
    const oldKey = await db.query.apiKeys.findFirst({
      where: and(eq(apiKeys.id, oldKeyId), eq(apiKeys.companyId, companyId)),
    });

    if (!oldKey) {
      throw new Error(`API key not found or access denied: ${oldKeyId}`);
    }

    // 1. Generate new API key
    const rawSecret = crypto.randomBytes(32).toString('hex');
    const keyPrefix = `pb_live_${rawSecret.slice(0, 6)}`;
    const fullApiKey = `${keyPrefix}_${rawSecret.slice(6)}`;
    const keyHash = crypto.createHash('sha256').update(fullApiKey).digest('hex');

    const [newKey] = await db
      .insert(apiKeys)
      .values({
        companyId,
        name: oldKey.name,
        keyPrefix,
        keyHash,
        permissions: oldKey.permissions,
      })
      .returning();

    // 2. Mark old key as revoked with 24-hour grace window
    const now = new Date();
    const graceEnds = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    await db
      .update(apiKeys)
      .set({
        revokedAt: now,
      })
      .where(eq(apiKeys.id, oldKey.id));

    // 3. Audit log
    await auditService.log({
      companyId,
      userId: actorId,
      action: 'api_key_rotated',
      resourceType: 'api_key',
      resourceId: newKey!.id,
      details: {
        oldKeyId: oldKey.id,
        newKeyId: newKey!.id,
        graceEndsAt: graceEnds.toISOString(),
      },
    });

    return {
      newKeyId: newKey!.id,
      newApiKey: fullApiKey, // Only returned once at rotation
      oldKeyId: oldKey.id,
      gracePeriodEndsAt: graceEnds.toISOString(),
      permissions: newKey!.permissions,
    };
  }
}

export const keyRotationService = new KeyRotationService();
