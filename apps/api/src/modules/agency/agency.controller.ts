import type { Request, Response, NextFunction } from 'express';
import {
  createClientCompanySchema,
  updateClientDeliveryRulesSchema,
  assignChatbotClientSchema,
} from '@propbot/shared';
import { agencyService } from './agency.service.js';

export class AgencyController {
  async getClients(req: Request, res: Response, next: NextFunction) {
    try {
      const agencyCompanyId = req.user!.companyId;
      const data = await agencyService.getClients(agencyCompanyId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async createClient(req: Request, res: Response, next: NextFunction) {
    try {
      const agencyCompanyId = req.user!.companyId;
      const actorId = req.user!.id;
      const input = createClientCompanySchema.parse(req.body);

      const data = await agencyService.createClient(agencyCompanyId, input, actorId);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async updateDeliveryRules(req: Request, res: Response, next: NextFunction) {
    try {
      const agencyCompanyId = req.user!.companyId;
      const clientId = req.params.id!;
      const actorId = req.user!.id;
      const input = updateClientDeliveryRulesSchema.parse(req.body);

      const data = await agencyService.updateClientDeliveryRules(
        agencyCompanyId,
        clientId,
        input,
        actorId,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async assignChatbot(req: Request, res: Response, next: NextFunction) {
    try {
      const agencyCompanyId = req.user!.companyId;
      const chatbotId = req.params.id!;
      const actorId = req.user!.id;
      const input = assignChatbotClientSchema.parse(req.body);

      const data = await agencyService.assignChatbotClient(
        agencyCompanyId,
        chatbotId,
        input,
        actorId,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getClientPortal(req: Request, res: Response, next: NextFunction) {
    try {
      const clientCompanyId = req.user!.companyId;
      const data = await agencyService.getClientPortalData(clientCompanyId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

export const agencyController = new AgencyController();
