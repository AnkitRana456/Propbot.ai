import type { Request, Response, NextFunction } from 'express';
import { inventoryService } from './inventory.service.js';
import { bulkImportService } from './bulk-import.service.js';
import { propertySearchService } from './property-search.service.js';
import { brochureService } from './brochure.service.js';
import { shortlistRoomService } from './shortlist-room.service.js';
import {
  createProjectInputSchema,
  updateProjectInputSchema,
  createUnitInputSchema,
  bulkImportUnitsInputSchema,
  createBrochureInputSchema,
  requestBrochureInputSchema,
  propertySearchInputSchema,
  createShortlistRoomInputSchema,
  shortlistTelemetryInputSchema,
} from '@propbot/shared';

function getCompanyId(req: Request): string {
  const companyId = req.tenant?.companyId;
  if (!companyId) {
    const err = new Error('Tenant company context required');
    Object.assign(err, { statusCode: 403 });
    throw err;
  }
  return companyId;
}

export class InventoryController {
  // ==========================================
  // Projects
  // ==========================================

  async listProjects(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const { status, search, location, page, limit } = req.query;

      const result = await inventoryService.listProjects(companyId, {
        status: status ? (String(status) as import('@propbot/shared').ProjectStatus) : undefined,
        search: search ? String(search) : undefined,
        location: location ? String(location) : undefined,
        page: page ? parseInt(String(page), 10) : undefined,
        limit: limit ? parseInt(String(limit), 10) : undefined,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const result = await inventoryService.getProjectById(companyId, req.params.id as string);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async createProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const parsed = createProjectInputSchema.parse(req.body);
      const result = await inventoryService.createProject(companyId, parsed);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async updateProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const parsed = updateProjectInputSchema.parse(req.body);
      const result = await inventoryService.updateProject(companyId, req.params.id as string, parsed);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async deleteProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const result = await inventoryService.deleteProject(companyId, req.params.id as string);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async syncKnowledge(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const result = await inventoryService.syncProjectToKnowledgeBase(companyId, req.params.id as string);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // Units & Bulk Import
  // ==========================================

  async listUnits(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const { bhk, status, floor, priceMax, page, limit } = req.query;

      const result = await inventoryService.listUnits(companyId, req.params.projectId as string, {
        bhk: bhk ? parseInt(String(bhk), 10) : undefined,
        status: status ? (String(status) as import('@propbot/shared').UnitStatus) : undefined,
        floor: floor !== undefined ? parseInt(String(floor), 10) : undefined,
        priceMax: priceMax ? parseFloat(String(priceMax)) : undefined,
        page: page ? parseInt(String(page), 10) : undefined,
        limit: limit ? parseInt(String(limit), 10) : undefined,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async createUnit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const parsed = createUnitInputSchema.parse(req.body);
      const result = await inventoryService.createUnit(companyId, req.params.projectId as string, parsed);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async updateUnitStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const { status } = req.body;
      if (!status) {
        res.status(400).json({ error: { message: 'Status is required' } });
        return;
      }
      const result = await inventoryService.updateUnitStatus(companyId, req.params.unitId as string, status);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async bulkImportUnits(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const parsed = bulkImportUnitsInputSchema.parse(req.body);
      const result = await bulkImportService.importUnits(companyId, req.params.projectId as string, parsed);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // Brochures
  // ==========================================

  async listBrochures(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const result = await brochureService.listBrochures(companyId, req.params.projectId as string);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async createBrochure(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const parsed = createBrochureInputSchema.parse(req.body);
      const result = await brochureService.createBrochure(companyId, req.params.projectId as string, parsed);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async requestBrochure(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const parsed = requestBrochureInputSchema.parse(req.body);
      const brochureId = (req.params.id || req.params.brochureId) as string;
      const result = await brochureService.requestBrochure(companyId, brochureId, parsed);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async trackBrochureDownload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const fileUrl = await brochureService.trackAndDownload(req.params.token as string);
      res.redirect(fileUrl);
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // Property Search Tool
  // ==========================================

  async searchProperties(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const payload: Record<string, unknown> = req.method === 'GET' ? { ...req.query } : { ...req.body };
      if (req.method === 'GET') {
        if (payload.budgetMin) payload.budgetMin = parseFloat(String(payload.budgetMin));
        if (payload.budgetMax) payload.budgetMax = parseFloat(String(payload.budgetMax));
        if (payload.bhk) {
          if (typeof payload.bhk === 'string' && payload.bhk.includes(',')) {
            payload.bhk = payload.bhk.split(',').map((x: string) => parseInt(x.trim(), 10));
          } else {
            payload.bhk = parseInt(String(payload.bhk), 10);
          }
        }
        if (payload.limit) payload.limit = parseInt(String(payload.limit), 10);
      }
      const parsed = propertySearchInputSchema.parse(payload);
      const result = await propertySearchService.searchProperties(companyId, parsed);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // Smart Shortlist Rooms
  // ==========================================

  async createShortlistRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const parsed = createShortlistRoomInputSchema.parse(req.body);
      const result = await shortlistRoomService.createShortlistRoom(companyId, parsed);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async listRoomsForLead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = getCompanyId(req);
      const result = await shortlistRoomService.listRoomsForLead(companyId, req.params.leadId as string);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getPublicRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await shortlistRoomService.getPublicRoomByToken(req.params.token as string);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async trackRoomInteraction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = shortlistTelemetryInputSchema.parse(req.body);
      const result = await shortlistRoomService.trackInteraction(req.params.token as string, parsed);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const inventoryController = new InventoryController();
