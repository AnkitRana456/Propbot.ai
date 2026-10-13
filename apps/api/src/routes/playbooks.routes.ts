import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { tenantGuard } from '../middlewares/tenant-guard.js';
import { requirePermission } from '../middlewares/rbac.js';
import { playbooksService } from '../modules/ai/playbooks.service.js';
import {
  createObjectionPlaybookSchema,
  updateObjectionPlaybookSchema,
} from '@propbot/shared';

export const playbooksRouter: Router = Router({ mergeParams: true });

playbooksRouter.use(authenticate, tenantGuard);

playbooksRouter.get('/', async (req, res, next) => {
  try {
    const companyId = req.companyId!;
    const { id: chatbotId } = req.params as { id?: string };
    const result = await playbooksService.listPlaybooks(companyId, chatbotId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

playbooksRouter.get('/:playbookId', async (req, res, next) => {
  try {
    const companyId = req.companyId!;
    const { playbookId } = req.params;
    const playbook = await playbooksService.getPlaybookById(companyId, playbookId as string);
    if (!playbook) {
      res.status(404).json({ error: { message: 'Objection playbook not found' } });
      return;
    }
    res.json({ success: true, data: playbook });
  } catch (err) {
    next(err);
  }
});

playbooksRouter.post('/', requirePermission('manage_chatbots'), async (req, res, next) => {
  try {
    const companyId = req.companyId!;
    const { id: chatbotId } = req.params as { id?: string };
    const validated = createObjectionPlaybookSchema.parse({
      ...req.body,
      chatbotId: req.body.chatbotId || chatbotId,
    });
    const created = await playbooksService.createPlaybook(companyId, validated);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
});

playbooksRouter.put('/:playbookId', requirePermission('manage_chatbots'), async (req, res, next) => {
  try {
    const companyId = req.companyId!;
    const { playbookId } = req.params;
    const existing = await playbooksService.getPlaybookById(companyId, playbookId as string);
    if (!existing) {
      res.status(404).json({ error: { message: 'Objection playbook not found' } });
      return;
    }
    const validated = updateObjectionPlaybookSchema.parse(req.body);
    const updated = await playbooksService.updatePlaybook(companyId, playbookId as string, validated);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

playbooksRouter.delete('/:playbookId', requirePermission('manage_chatbots'), async (req, res, next) => {
  try {
    const companyId = req.companyId!;
    const { playbookId } = req.params;
    const existing = await playbooksService.getPlaybookById(companyId, playbookId as string);
    if (!existing) {
      res.status(404).json({ error: { message: 'Objection playbook not found' } });
      return;
    }
    await playbooksService.deletePlaybook(companyId, playbookId as string);
    res.json({ success: true, message: 'Objection playbook deleted successfully' });
  } catch (err) {
    next(err);
  }
});
