import { eq, and, desc, isNull } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { notes, users, leadActivities, leads } from '../../db/schema/index.js';
import type { NoteItem } from '@propbot/shared';

export class NotesService {
  /**
   * Retrieves all non-deleted notes for a lead with author details.
   */
  async listNotes(companyId: string, leadId: string): Promise<NoteItem[]> {
    const rows = await db
      .select({
        note: notes,
        author: users,
      })
      .from(notes)
      .leftJoin(users, eq(notes.userId, users.id))
      .where(and(eq(notes.companyId, companyId), eq(notes.leadId, leadId), isNull(notes.deletedAt)))
      .orderBy(desc(notes.createdAt));

    return rows.map(({ note, author }) => ({
      id: note.id,
      leadId: note.leadId,
      userId: note.userId,
      userName: author?.name || 'Agent',
      userRole: author?.role || 'agent',
      content: note.content,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    }));
  }

  /**
   * Creates an internal team note and records a timeline activity.
   */
  async createNote(
    companyId: string,
    leadId: string,
    userId: string,
    content: string,
  ): Promise<NoteItem> {
    const lead = await db.query.leads.findFirst({
      where: and(eq(leads.id, leadId), eq(leads.companyId, companyId), isNull(leads.deletedAt)),
    });

    if (!lead) {
      throw new Error('Lead not found');
    }

    const author = await db.query.users.findFirst({
      where: and(eq(users.id, userId), eq(users.companyId, companyId)),
    });

    const [newNote] = await db
      .insert(notes)
      .values({
        companyId,
        leadId,
        userId,
        content: content.trim(),
      })
      .returning();

    if (!newNote) {
      throw new Error('Failed to create note');
    }

    // Record activity in lead_activities
    await db.insert(leadActivities).values({
      companyId,
      leadId,
      contactId: lead.contactId,
      activityType: 'note_added',
      title: `Note added by ${author?.name || 'Team member'}`,
      description: content.length > 100 ? `${content.slice(0, 97)}...` : content,
      metadata: { noteId: newNote.id, authorId: userId },
    });

    return {
      id: newNote.id,
      leadId: newNote.leadId,
      userId: newNote.userId,
      userName: author?.name || 'Agent',
      userRole: author?.role || 'agent',
      content: newNote.content,
      createdAt: newNote.createdAt.toISOString(),
      updatedAt: newNote.updatedAt.toISOString(),
    };
  }

  /**
   * Soft-deletes a note.
   */
  async deleteNote(companyId: string, noteId: string): Promise<{ success: boolean }> {
    const existing = await db.query.notes.findFirst({
      where: and(eq(notes.id, noteId), eq(notes.companyId, companyId)),
    });

    if (!existing) {
      throw new Error('Note not found');
    }

    await db
      .update(notes)
      .set({ deletedAt: new Date() })
      .where(and(eq(notes.id, noteId), eq(notes.companyId, companyId)));

    return { success: true };
  }
}

export const notesService = new NotesService();
