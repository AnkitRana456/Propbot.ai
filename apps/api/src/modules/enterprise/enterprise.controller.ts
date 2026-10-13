import type { Request, Response, NextFunction } from 'express';
import { ssoService } from './sso.service.js';
import { keyRotationService } from './key-rotation.service.js';
import { auditExportService } from './audit-export.service.js';
import { uptimeStatusService } from './uptime-status.service.js';
import { securityPackService } from './security-pack.service.js';
import { configureSsoRequestSchema, ssoCallbackPayloadSchema } from '@propbot/shared';

export class EnterpriseController {
  /**
   * POST /api/enterprise/sso
   * Configure company SAML/OIDC SSO settings.
   */
  async configureSso(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const actorId = req.user?.id;
      const parsed = configureSsoRequestSchema.parse(req.body);

      const config = await ssoService.configureSso(companyId, parsed, actorId);

      res.status(200).json({
        success: true,
        data: config,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/enterprise/sso
   * Get company SSO settings.
   */
  async getSsoConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const config = await ssoService.getSsoConfig(companyId);

      res.status(200).json({
        success: true,
        data: config,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/enterprise/sso/login
   * Initiates SSO redirect for a domain.
   */
  async initiateSso(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const domain = String(req.query.domain || '');
      if (!domain) {
        res.status(400).json({ error: { message: 'Domain query parameter required' } });
        return;
      }

      const result = await ssoService.initiateSso(domain);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/enterprise/sso/callback
   * Processes IdP assertion, auto-provisions or authenticates user.
   */
  async handleSsoCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = ssoCallbackPayloadSchema.parse(req.body);
      const email = parsed.email || `sso.user@${parsed.domain}`;
      const name = parsed.name || 'SSO User';
      const result = await ssoService.handleSsoCallback({
        domain: parsed.domain,
        email,
        name,
        assertion: parsed.assertion || parsed.samlResponse,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/enterprise/api-keys/:id/rotate
   * Rotates an API key with zero-downtime (24h grace window).
   */
  async rotateApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const actorId = req.user?.id;
      const keyId = req.params.id!;

      const result = await keyRotationService.rotateApiKey(companyId, keyId, actorId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/enterprise/audit-logs/export
   * Exports audit logs as CSV or JSON stream.
   */
  async exportAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const format = req.query.format === 'csv' ? 'csv' : 'json';
      const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
      const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;
      const action = typeof req.query.action === 'string' ? req.query.action : undefined;

      const result = await auditExportService.exportLogs(companyId, {
        format,
        startDate,
        endDate,
        action,
      });

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${Date.now()}.csv"`);
        res.status(200).send(result);
        return;
      }

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/status/uptime
   * Real-time SLA and uptime health check.
   */
  async getUptimeStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = await uptimeStatusService.getStatus();
      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/enterprise/security-pack
   * Security questionnaire answers pack for SOC 2 / ISO 27001.
   */
  async getSecurityPack(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const pack = securityPackService.getSecurityPack();
      res.status(200).json({
        success: true,
        data: pack,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const enterpriseController = new EnterpriseController();
