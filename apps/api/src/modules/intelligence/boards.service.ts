import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import type { BoardItem, BoardTaskItem, CreateBoardInput, CreateBoardTaskInput, TaskCommentItem } from '@propbot/shared';
import { db } from '../../db/index.js';
import { boardTaskComments, boardTasks, boards, forms, leads, users } from '../../db/schema/index.js';
import { badRequest, conflict, notFound } from '../../utils/api-error.js';
import { validateFormValues, type FieldDef } from '../forms/form-validation.js';
import { formsService } from '../forms/forms.service.js';

type BoardRow = typeof boards.$inferSelect;
type TaskRow = typeof boardTasks.$inferSelect;

class BoardsService {
  private async mustBoard(companyId: string, id: string): Promise<BoardRow> {
    const [b] = await db.select().from(boards).where(and(eq(boards.id, id), eq(boards.companyId, companyId), isNull(boards.deletedAt)));
    if (!b) throw notFound('Board');
    return b;
  }

  private async mustTask(companyId: string, boardId: string, taskId: string): Promise<TaskRow> {
    const [t] = await db.select().from(boardTasks).where(and(eq(boardTasks.id, taskId), eq(boardTasks.boardId, boardId), eq(boardTasks.companyId, companyId), isNull(boardTasks.deletedAt)));
    if (!t) throw notFound('Task');
    return t;
  }

  private async assertForm(companyId: string, formId?: string | null) {
    if (!formId) return;
    const [f] = await db.select({ id: forms.id }).from(forms).where(and(eq(forms.id, formId), eq(forms.companyId, companyId), isNull(forms.deletedAt)));
    if (!f) throw badRequest('FORM_INVALID', 'That form does not exist.');
  }

  private async assertPeople(companyId: string, p: { assigneeId?: string | null; leadId?: string | null }) {
    if (p.assigneeId) {
      const [u] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, p.assigneeId), eq(users.companyId, companyId)));
      if (!u) throw badRequest('ASSIGNEE_INVALID', 'That person is not on your team.');
    }
    if (p.leadId) {
      const [l] = await db.select({ id: leads.id }).from(leads).where(and(eq(leads.id, p.leadId), eq(leads.companyId, companyId)));
      if (!l) throw badRequest('LEAD_INVALID', 'That lead does not exist.');
    }
  }

  private toBoard(b: BoardRow, taskCount: number): BoardItem {
    return { id: b.id, name: b.name, description: b.description, formId: b.formId, columns: b.columns, taskCount, createdAt: b.createdAt.toISOString() };
  }

  async list(companyId: string): Promise<BoardItem[]> {
    const rows = await db.select().from(boards).where(and(eq(boards.companyId, companyId), isNull(boards.deletedAt))).orderBy(desc(boards.createdAt));
    const counts = await db.select({ id: boardTasks.boardId, n: sql<number>`count(*)::int` }).from(boardTasks).where(and(eq(boardTasks.companyId, companyId), isNull(boardTasks.deletedAt))).groupBy(boardTasks.boardId);
    return rows.map(b => this.toBoard(b, counts.find(c => c.id === b.id)?.n ?? 0));
  }

  async create(companyId: string, userId: string | null, input: CreateBoardInput): Promise<BoardItem> {
    await this.assertForm(companyId, input.formId);
    const keys = input.columns.map(c => c.key);
    if (new Set(keys).size !== keys.length) throw badRequest('BOARD_COLUMNS_DUPLICATE', 'Each column needs a unique key.');
    const [b] = await db.insert(boards).values({ companyId, name: input.name, description: input.description ?? null, formId: input.formId ?? null, columns: input.columns, createdBy: userId }).returning();
    return this.toBoard(b!, 0);
  }

  async update(companyId: string, id: string, input: Partial<CreateBoardInput>): Promise<BoardItem> {
    const cur = await this.mustBoard(companyId, id);
    await this.assertForm(companyId, input.formId);
    if (input.columns) {
      const keys = input.columns.map(c => c.key);
      if (new Set(keys).size !== keys.length) throw badRequest('BOARD_COLUMNS_DUPLICATE', 'Each column needs a unique key.');
      const removed = cur.columns.map(c => c.key).filter(k => !keys.includes(k));
      if (removed.length) {
        const [used] = await db.select({ id: boardTasks.id }).from(boardTasks).where(and(eq(boardTasks.boardId, id), isNull(boardTasks.deletedAt), sql`${boardTasks.columnKey} IN (${sql.join(removed.map(k => sql`${k}`), sql`, `)})`)).limit(1);
        if (used) throw conflict('BOARD_COLUMN_IN_USE', 'Move the tasks out of a column before removing it.');
      }
    }
    const [b] = await db.update(boards).set({ ...input, updatedAt: new Date() }).where(eq(boards.id, id)).returning();
    const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`count(*)::int` }).from(boardTasks).where(and(eq(boardTasks.boardId, id), isNull(boardTasks.deletedAt)));
    return this.toBoard(b!, n);
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.mustBoard(companyId, id);
    await db.update(boards).set({ deletedAt: new Date() }).where(eq(boards.id, id));
  }

  private toTask(t: TaskRow, assignee: string | null, comments: number): BoardTaskItem {
    return {
      id: t.id,
      title: t.title,
      columnKey: t.columnKey,
      position: t.position,
      assigneeId: t.assigneeId,
      assigneeName: assignee,
      dueAt: t.dueAt?.toISOString() ?? null,
      leadId: t.leadId,
      data: t.data,
      commentCount: comments,
      overdue: Boolean(t.dueAt && t.dueAt.getTime() < Date.now() && t.columnKey !== 'done'),
    };
  }

  async tasks(companyId: string, boardId: string): Promise<BoardTaskItem[]> {
    await this.mustBoard(companyId, boardId);
    const rows = await db
      .select({ t: boardTasks, assignee: users.name })
      .from(boardTasks)
      .leftJoin(users, eq(users.id, boardTasks.assigneeId))
      .where(and(eq(boardTasks.boardId, boardId), eq(boardTasks.companyId, companyId), isNull(boardTasks.deletedAt)))
      .orderBy(asc(boardTasks.columnKey), asc(boardTasks.position));
    const counts = await db.select({ id: boardTaskComments.taskId, n: sql<number>`count(*)::int` }).from(boardTaskComments).where(eq(boardTaskComments.companyId, companyId)).groupBy(boardTaskComments.taskId);
    return rows.map(r => this.toTask(r.t, r.assignee, counts.find(c => c.id === r.t.id)?.n ?? 0));
  }

  /** Validates task data against the board's form (full-form rules; partial values allowed). */
  private async cleanData(companyId: string, board: BoardRow, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!board.formId || Object.keys(data).length === 0) return data;
    const form = await formsService.get(companyId, board.formId);
    const { values, errors } = validateFormValues(form.fields as FieldDef[], data, { partial: true });
    if (Object.keys(errors).length) throw badRequest('TASK_DATA_INVALID', Object.entries(errors).map(([k, v]) => `${k}: ${v}`).join('; '), errors);
    return values;
  }

  async createTask(companyId: string, userId: string | null, boardId: string, input: CreateBoardTaskInput): Promise<BoardTaskItem> {
    const board = await this.mustBoard(companyId, boardId);
    const columnKey = input.columnKey ?? board.columns[0]!.key;
    if (!board.columns.some(c => c.key === columnKey)) throw badRequest('BOARD_COLUMN_INVALID', 'That column does not exist on this board.');
    await this.assertPeople(companyId, input);
    const data = await this.cleanData(companyId, board, input.data);
    const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`count(*)::int` }).from(boardTasks).where(and(eq(boardTasks.boardId, boardId), eq(boardTasks.columnKey, columnKey), isNull(boardTasks.deletedAt)));
    const [t] = await db
      .insert(boardTasks)
      .values({ companyId, boardId, title: input.title, columnKey, position: n, assigneeId: input.assigneeId ?? null, dueAt: input.dueAt ? new Date(input.dueAt) : null, leadId: input.leadId ?? null, data, createdBy: userId })
      .returning();
    return this.toTask(t!, null, 0);
  }

  async updateTask(companyId: string, boardId: string, taskId: string, input: Partial<CreateBoardTaskInput>): Promise<BoardTaskItem> {
    const board = await this.mustBoard(companyId, boardId);
    await this.mustTask(companyId, boardId, taskId);
    await this.assertPeople(companyId, input);
    if (input.columnKey && !board.columns.some(c => c.key === input.columnKey)) throw badRequest('BOARD_COLUMN_INVALID', 'That column does not exist on this board.');
    const patch: Partial<typeof boardTasks.$inferInsert> = { updatedAt: new Date() };
    if (input.title !== undefined) patch.title = input.title;
    if (input.columnKey !== undefined) patch.columnKey = input.columnKey;
    if (input.assigneeId !== undefined) patch.assigneeId = input.assigneeId;
    if (input.leadId !== undefined) patch.leadId = input.leadId;
    if (input.dueAt !== undefined) patch.dueAt = input.dueAt ? new Date(input.dueAt) : null;
    if (input.data !== undefined) patch.data = await this.cleanData(companyId, board, input.data);
    const [t] = await db.update(boardTasks).set(patch).where(eq(boardTasks.id, taskId)).returning();
    return this.toTask(t!, null, 0);
  }

  /** Moves a task and keeps positions in both columns dense (0..n-1). */
  async moveTask(companyId: string, boardId: string, taskId: string, columnKey: string, position: number): Promise<BoardTaskItem[]> {
    const board = await this.mustBoard(companyId, boardId);
    const task = await this.mustTask(companyId, boardId, taskId);
    if (!board.columns.some(c => c.key === columnKey)) throw badRequest('BOARD_COLUMN_INVALID', 'That column does not exist on this board.');
    await db.transaction(async tx => {
      const target = await tx.select({ id: boardTasks.id }).from(boardTasks).where(and(eq(boardTasks.boardId, boardId), eq(boardTasks.columnKey, columnKey), isNull(boardTasks.deletedAt))).orderBy(asc(boardTasks.position));
      const order = target.map(t => t.id).filter(id => id !== taskId);
      order.splice(Math.min(position, order.length), 0, taskId);
      await tx.update(boardTasks).set({ columnKey, updatedAt: new Date() }).where(eq(boardTasks.id, taskId));
      for (const [i, id] of order.entries()) await tx.update(boardTasks).set({ position: i }).where(eq(boardTasks.id, id));
      if (task.columnKey !== columnKey) {
        const source = await tx.select({ id: boardTasks.id }).from(boardTasks).where(and(eq(boardTasks.boardId, boardId), eq(boardTasks.columnKey, task.columnKey), isNull(boardTasks.deletedAt))).orderBy(asc(boardTasks.position));
        for (const [i, s] of source.entries()) await tx.update(boardTasks).set({ position: i }).where(eq(boardTasks.id, s.id));
      }
    });
    return this.tasks(companyId, boardId);
  }

  async deleteTask(companyId: string, boardId: string, taskId: string): Promise<void> {
    await this.mustBoard(companyId, boardId);
    await this.mustTask(companyId, boardId, taskId);
    await db.update(boardTasks).set({ deletedAt: new Date() }).where(eq(boardTasks.id, taskId));
  }

  async comments(companyId: string, boardId: string, taskId: string): Promise<TaskCommentItem[]> {
    await this.mustTask(companyId, boardId, taskId);
    const rows = await db.select({ c: boardTaskComments, name: users.name }).from(boardTaskComments).leftJoin(users, eq(users.id, boardTaskComments.authorId)).where(and(eq(boardTaskComments.taskId, taskId), eq(boardTaskComments.companyId, companyId))).orderBy(asc(boardTaskComments.createdAt));
    return rows.map(r => ({ id: r.c.id, authorId: r.c.authorId, authorName: r.name, body: r.c.body, createdAt: r.c.createdAt.toISOString() }));
  }

  async addComment(companyId: string, userId: string | null, boardId: string, taskId: string, body: string): Promise<TaskCommentItem> {
    await this.mustTask(companyId, boardId, taskId);
    const [c] = await db.insert(boardTaskComments).values({ companyId, taskId, authorId: userId, body }).returning();
    const [u] = userId ? await db.select({ name: users.name }).from(users).where(eq(users.id, userId)) : [];
    return { id: c!.id, authorId: userId, authorName: u?.name ?? null, body: c!.body, createdAt: c!.createdAt.toISOString() };
  }
}

export const boardsService = new BoardsService();
