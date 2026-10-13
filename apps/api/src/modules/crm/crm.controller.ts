import type { Request, Response, NextFunction } from 'express';
import {
  assignLeadInputSchema,
  bulkAssignInputSchema,
  bulkStatusInputSchema,
  createNoteInputSchema,
  createTaskInputSchema,
  updateTaskInputSchema,
  createContactInputSchema,
  mergeContactsInputSchema,
  createOrganizationInputSchema,
  exportLeadsInputSchema,
  updateLeadStatusInputSchema,
} from '@propbot/shared';
import { pipelineService } from './pipeline.service.js';
import { assignmentService } from './assignment.service.js';
import { notesService } from './notes.service.js';
import { tasksService } from './tasks.service.js';
import { timelineService } from './timeline.service.js';
import { contactsService } from './contacts.service.js';
import { exportService } from './export.service.js';
import { crmReportsService } from './crm-reports.service.js';

function getCompanyId(req: Request): string {
  const companyId = req.tenant?.companyId || req.user?.companyId;
  if (!companyId) {
    throw new Error('Tenant company context required');
  }
  return companyId;
}

export class CrmController {
  // --- Pipeline & Kanban ---
  async getKanbanBoard(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = getCompanyId(req);
      const board = await pipelineService.getKanbanBoard(companyId);
      return res.json({ data: board });
    } catch (err) {
      return next(err);
    }
  }

  async updateStage(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = getCompanyId(req);
      const leadId = req.params.leadId as string;
      const parsed = updateLeadStatusInputSchema.parse(req.body);
      const updated = await pipelineService.updateStage(
        companyId,
        leadId,
        parsed.status,
        parsed.lostReason,
        req.user?.id,
      );
      return res.json({ data: updated });
    } catch (err) {
      return next(err);
    }
  }

  async bulkUpdateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = getCompanyId(req);
      const parsed = bulkStatusInputSchema.parse(req.body);
      const result = await pipelineService.bulkUpdateStatus(
        companyId,
        parsed.leadIds,
        parsed.status,
        parsed.lostReason,
        req.user?.id,
      );
      return res.json({ data: result });
    } catch (err) {
      return next(err);
    }
  }

  // --- Assignment ---
  async assignLead(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = getCompanyId(req);
      const leadId = req.params.leadId as string;
      const parsed = assignLeadInputSchema.parse(req.body);
      const result = await assignmentService.assignLead(
        companyId,
        leadId,
        parsed.agentId,
        parsed.reason,
        req.user?.id,
      );
      return res.json({ data: result });
    } catch (err) {
      return next(err);
    }
  }

  async roundRobinAssign(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = getCompanyId(req);
      const leadId = req.params.leadId as string;
      const result = await assignmentService.roundRobinAssign(companyId, leadId);
      return res.json({ data: result });
    } catch (err) {
      return next(err);
    }
  }

  async bulkAssign(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = getCompanyId(req);
      const parsed = bulkAssignInputSchema.parse(req.body);
      const result = await assignmentService.bulkAssign(
        companyId,
        parsed.leadIds,
        parsed.agentId,
        req.user?.id,
      );
      return res.json({ data: result });
    } catch (err) {
      return next(err);
    }
  }

  async checkSla(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = getCompanyId(req);
      const result = await assignmentService.checkAndReassignSlaBreaches(companyId);
      return res.json({ data: result });
    } catch (err) {
      return next(err);
    }
  }

  // --- Notes ---
  async listNotes(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = getCompanyId(req);
      const leadId = req.params.leadId as string;
      const notes = await notesService.listNotes(companyId, leadId);
      return res.json({ data: notes });
    } catch (err) {
      return next(err);
    }
  }

  async createNote(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = getCompanyId(req);
      const leadId = req.params.leadId as string;
      const parsed = createNoteInputSchema.parse(req.body);
      const note = await notesService.createNote(companyId, leadId, req.user!.id, parsed.content);
      return res.status(201).json({ data: note });
    } catch (err) {
      return next(err);
    }
  }

  async deleteNote(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = getCompanyId(req);
      const noteId = req.params.noteId as string;
      await notesService.deleteNote(companyId, noteId);
      return res.json({ data: { success: true } });
    } catch (err) {
      return next(err);
    }
  }

  // --- Tasks ---
  async listTasks(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = getCompanyId(req);
      const { leadId, assignedUserId, status, myDay, overdue } = req.query;

      const result = await tasksService.listTasks(companyId, {
        leadId: leadId as string | undefined,
        assignedUserId: assignedUserId as string | undefined,
        status: status as string | undefined,
        myDay: myDay === 'true',
        overdue: overdue === 'true',
      });
      return res.json({ data: result });
    } catch (err) {
      return next(err);
    }
  }

  async createTask(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = getCompanyId(req);
      const parsed = createTaskInputSchema.parse(req.body);
      const task = await tasksService.createTask(companyId, parsed, req.user?.id);
      return res.status(201).json({ data: task });
    } catch (err) {
      return next(err);
    }
  }

  async updateTask(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = getCompanyId(req);
      const taskId = req.params.taskId as string;
      const parsed = updateTaskInputSchema.parse(req.body);
      const task = await tasksService.updateTask(companyId, taskId, parsed, req.user?.id);
      return res.json({ data: task });
    } catch (err) {
      return next(err);
    }
  }

  async deleteTask(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = getCompanyId(req);
      const taskId = req.params.taskId as string;
      await tasksService.deleteTask(companyId, taskId);
      return res.json({ data: { success: true } });
    } catch (err) {
      return next(err);
    }
  }

  // --- Visitor Timeline ---
  async getVisitorTimeline(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = getCompanyId(req);
      const leadId = req.params.leadId as string;
      const result = await timelineService.getVisitorTimeline(companyId, leadId);
      return res.json({ data: result });
    } catch (err) {
      return next(err);
    }
  }

  // --- Contacts & Organizations ---
  async listContacts(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = getCompanyId(req);
      const { search, organizationId, page, limit } = req.query;
      const result = await contactsService.listContacts(companyId, {
        search: search as string | undefined,
        organizationId: organizationId as string | undefined,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });
      return res.json({ data: result });
    } catch (err) {
      return next(err);
    }
  }

  async getContactById(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = getCompanyId(req);
      const contactId = req.params.contactId as string;
      const result = await contactsService.getContactById(companyId, contactId);
      return res.json({ data: result });
    } catch (err) {
      return next(err);
    }
  }

  async createContact(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = getCompanyId(req);
      const parsed = createContactInputSchema.parse(req.body);
      const contact = await contactsService.createContact(companyId, parsed);
      return res.status(201).json({ data: contact });
    } catch (err) {
      return next(err);
    }
  }

  async mergeContacts(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = getCompanyId(req);
      const parsed = mergeContactsInputSchema.parse(req.body);
      const result = await contactsService.mergeContacts(
        companyId,
        parsed.sourceContactId,
        parsed.targetContactId,
      );
      return res.json({ data: result });
    } catch (err) {
      return next(err);
    }
  }

  async listOrganizations(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = getCompanyId(req);
      const result = await contactsService.listOrganizations(companyId);
      return res.json({ data: result });
    } catch (err) {
      return next(err);
    }
  }

  async createOrganization(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = getCompanyId(req);
      const parsed = createOrganizationInputSchema.parse(req.body);
      const org = await contactsService.createOrganization(companyId, parsed);
      return res.status(201).json({ data: org });
    } catch (err) {
      return next(err);
    }
  }

  // --- Export ---
  async exportLeads(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = getCompanyId(req);
      const parsed = exportLeadsInputSchema.parse(req.body);
      const csvString = await exportService.exportLeadsToCsv(companyId, parsed);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="leads-export-${Date.now()}.csv"`);
      return res.send(csvString);
    } catch (err) {
      return next(err);
    }
  }

  // --- CRM Reports ---
  async getCrmReports(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = getCompanyId(req);
      const reports = await crmReportsService.getCrmReports(companyId);
      return res.json({ data: reports });
    } catch (err) {
      return next(err);
    }
  }
}

export const crmController = new CrmController();
