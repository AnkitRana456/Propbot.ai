import { Router } from 'express';
import { crmController } from '../modules/crm/crm.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { tenantGuard } from '../middlewares/tenant-guard.js';
import { requirePermission } from '../middlewares/rbac.js';

export const crmRouter: Router = Router();

// All CRM routes require authentication & tenant context
crmRouter.use(authenticate, tenantGuard);

// 1. Pipeline & Kanban
crmRouter.get('/pipeline', requirePermission('view_leads'), (req, res, next) => {
  crmController.getKanbanBoard(req, res, next);
});

crmRouter.patch('/pipeline/:leadId/stage', requirePermission('edit_leads'), (req, res, next) => {
  crmController.updateStage(req, res, next);
});

crmRouter.post('/pipeline/bulk-status', requirePermission('edit_leads'), (req, res, next) => {
  crmController.bulkUpdateStatus(req, res, next);
});

// 2. Assignment & Routing
crmRouter.post('/leads/:leadId/assign', requirePermission('assign_leads'), (req, res, next) => {
  crmController.assignLead(req, res, next);
});

crmRouter.post('/leads/:leadId/round-robin', requirePermission('assign_leads'), (req, res, next) => {
  crmController.roundRobinAssign(req, res, next);
});

crmRouter.post('/leads/bulk-assign', requirePermission('assign_leads'), (req, res, next) => {
  crmController.bulkAssign(req, res, next);
});

crmRouter.post('/leads/sla-check', requirePermission('manage_settings'), (req, res, next) => {
  crmController.checkSla(req, res, next);
});

// 3. Notes
crmRouter.get('/leads/:leadId/notes', requirePermission('view_leads'), (req, res, next) => {
  crmController.listNotes(req, res, next);
});

crmRouter.post('/leads/:leadId/notes', requirePermission('edit_leads'), (req, res, next) => {
  crmController.createNote(req, res, next);
});

crmRouter.delete('/notes/:noteId', requirePermission('edit_leads'), (req, res, next) => {
  crmController.deleteNote(req, res, next);
});

// 4. Tasks & Follow-ups
crmRouter.get('/tasks', requirePermission('view_leads'), (req, res, next) => {
  crmController.listTasks(req, res, next);
});

crmRouter.post('/tasks', requirePermission('edit_leads'), (req, res, next) => {
  crmController.createTask(req, res, next);
});

crmRouter.patch('/tasks/:taskId', requirePermission('edit_leads'), (req, res, next) => {
  crmController.updateTask(req, res, next);
});

crmRouter.delete('/tasks/:taskId', requirePermission('edit_leads'), (req, res, next) => {
  crmController.deleteTask(req, res, next);
});

// 5. Visitor Timeline
crmRouter.get('/leads/:leadId/timeline', requirePermission('view_leads'), (req, res, next) => {
  crmController.getVisitorTimeline(req, res, next);
});

// 6. Contacts & Organizations
crmRouter.get('/contacts', requirePermission('view_leads'), (req, res, next) => {
  crmController.listContacts(req, res, next);
});

crmRouter.get('/contacts/:contactId', requirePermission('view_leads'), (req, res, next) => {
  crmController.getContactById(req, res, next);
});

crmRouter.post('/contacts', requirePermission('edit_leads'), (req, res, next) => {
  crmController.createContact(req, res, next);
});

crmRouter.post('/contacts/merge', requirePermission('edit_leads'), (req, res, next) => {
  crmController.mergeContacts(req, res, next);
});

crmRouter.get('/organizations', requirePermission('view_leads'), (req, res, next) => {
  crmController.listOrganizations(req, res, next);
});

crmRouter.post('/organizations', requirePermission('edit_leads'), (req, res, next) => {
  crmController.createOrganization(req, res, next);
});

// 7. Export
crmRouter.post('/export', requirePermission('view_leads'), (req, res, next) => {
  crmController.exportLeads(req, res, next);
});

// 8. CRM Reports
crmRouter.get('/reports', requirePermission('view_analytics'), (req, res, next) => {
  crmController.getCrmReports(req, res, next);
});
