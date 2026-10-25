import { Router } from 'express';
import { inventoryController } from '../modules/inventory/inventory.controller.js';
import { costSheetService } from '../modules/inventory/cost-sheet.service.js';
import { authenticate } from '../middlewares/authenticate.js';
import { tenantGuard } from '../middlewares/tenant-guard.js';
import { requirePermission } from '../middlewares/rbac.js';

export const propertiesRouter: Router = Router();

// Tracked brochure download (token in path - public tracking endpoint)
propertiesRouter.get('/brochures/track/:token', (req, res, next) => {
  inventoryController.trackBrochureDownload(req, res, next);
});

// All remaining endpoints require authentication and tenant context
propertiesRouter.use(authenticate);
propertiesRouter.use(tenantGuard);

// ------------------------------------------
// Projects
// ------------------------------------------
propertiesRouter.get('/projects', requirePermission('view_leads', 'view_inventory'), (req, res, next) => {
  inventoryController.listProjects(req, res, next);
});

propertiesRouter.get('/projects/:id', requirePermission('view_leads', 'view_inventory'), (req, res, next) => {
  inventoryController.getProject(req, res, next);
});

propertiesRouter.post('/projects', requirePermission('manage_inventory', 'manage_chatbots'), (req, res, next) => {
  inventoryController.createProject(req, res, next);
});

propertiesRouter.put('/projects/:id', requirePermission('manage_inventory', 'manage_chatbots'), (req, res, next) => {
  inventoryController.updateProject(req, res, next);
});

propertiesRouter.delete('/projects/:id', requirePermission('manage_inventory', 'manage_chatbots'), (req, res, next) => {
  inventoryController.deleteProject(req, res, next);
});

propertiesRouter.post('/projects/:id/sync-knowledge', requirePermission('manage_inventory', 'manage_chatbots'), (req, res, next) => {
  inventoryController.syncKnowledge(req, res, next);
});

// ------------------------------------------
// Units & Bulk Import
// ------------------------------------------
propertiesRouter.get('/projects/:projectId/units', requirePermission('view_leads', 'view_inventory'), (req, res, next) => {
  inventoryController.listUnits(req, res, next);
});

propertiesRouter.post('/projects/:projectId/units', requirePermission('manage_inventory', 'manage_chatbots'), (req, res, next) => {
  inventoryController.createUnit(req, res, next);
});

propertiesRouter.patch('/units/:unitId/status', requirePermission('edit_leads', 'manage_inventory'), (req, res, next) => {
  inventoryController.updateUnitStatus(req, res, next);
});

propertiesRouter.post('/projects/:projectId/units/import', requirePermission('manage_inventory', 'manage_chatbots'), (req, res, next) => {
  inventoryController.bulkImportUnits(req, res, next);
});

// ------------------------------------------
// Brochures
// ------------------------------------------
propertiesRouter.get('/projects/:projectId/brochures', requirePermission('view_leads', 'view_inventory'), (req, res, next) => {
  inventoryController.listBrochures(req, res, next);
});

propertiesRouter.post('/projects/:projectId/brochures', requirePermission('manage_inventory', 'manage_chatbots'), (req, res, next) => {
  inventoryController.createBrochure(req, res, next);
});

propertiesRouter.post('/brochures/:id/request', (req, res, next) => {
  inventoryController.requestBrochure(req, res, next);
});

propertiesRouter.post('/projects/:projectId/brochures/:id/request', (req, res, next) => {
  inventoryController.requestBrochure(req, res, next);
});

// ------------------------------------------
// Bot Property Search Tool
// ------------------------------------------
propertiesRouter.get('/search', (req, res, next) => {
  inventoryController.searchProperties(req, res, next);
});

propertiesRouter.post('/search', (req, res, next) => {
  inventoryController.searchProperties(req, res, next);
});

// ------------------------------------------
// Shortlist Rooms Management
// ------------------------------------------
propertiesRouter.post('/shortlist-rooms', requirePermission('view_leads', 'edit_leads'), (req, res, next) => {
  inventoryController.createShortlistRoom(req, res, next);
});

propertiesRouter.get('/shortlist-rooms/lead/:leadId', requirePermission('view_leads'), (req, res, next) => {
  inventoryController.listRoomsForLead(req, res, next);
});

// ------------------------------------------
// Cost Sheets
// ------------------------------------------
propertiesRouter.get('/projects/:projectId/cost-sheet-config', requirePermission('view_inventory'), (req, res, next) => {
  const companyId = req.tenant?.companyId ?? '';
  costSheetService.getConfig(companyId, req.params.projectId!).then(data => res.json({ data })).catch(next);
});

propertiesRouter.put('/projects/:projectId/cost-sheet-config', requirePermission('manage_inventory'), (req, res, next) => {
  const companyId = req.tenant?.companyId ?? '';
  costSheetService.updateConfig(companyId, req.params.projectId!, req.body as object).then(data => res.json({ data })).catch(next);
});

propertiesRouter.post('/projects/:projectId/cost-sheets', requirePermission('manage_inventory'), (req, res, next) => {
  const companyId = req.tenant?.companyId ?? '';
  const userId = req.tenant?.userId ?? '';
  const body = req.body as { unitId: string; leadId?: string; discount?: number; parkingSlots?: number; notes?: string; validDays?: number };
  costSheetService.createSheet(companyId, userId, { projectId: req.params.projectId!, ...body }).then(data => res.json({ data })).catch(next);
});

propertiesRouter.get('/projects/:projectId/cost-sheets', requirePermission('view_inventory'), (req, res, next) => {
  const companyId = req.tenant?.companyId ?? '';
  costSheetService.listSheets(companyId, { projectId: req.params.projectId!, ...(req.query.unitId ? { unitId: String(req.query.unitId) } : {}), ...(req.query.leadId ? { leadId: String(req.query.leadId) } : {}) })
    .then(data => res.json({ data })).catch(next);
});
