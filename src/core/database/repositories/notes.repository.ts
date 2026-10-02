import { and, desc, eq, ilike } from "drizzle-orm";
import { db } from "..";
import { Note, notesTable } from "../schema";

export async function createNote(data: {
  content: string;
  recipientId?: string | null;
  conversationId?: string | null;
}): Promise<Note> {
  const result = await db
    .insert(notesTable)
    .values({
      content: data.content,
      recipientId: data.recipientId ?? null,
      conversationId: data.conversationId ?? null,
    })
    .returning();

  return result[0];
}

export async function listNotes(
  opts: { conversationId?: string; search?: string; limit?: number } = {},
): Promise<Note[]> {
  const conditions = [];

  if (opts.conversationId) {
    conditions.push(eq(notesTable.conversationId, opts.conversationId));
  }

  if (opts.search) {
    conditions.push(ilike(notesTable.content, `%${opts.search}%`));
  }

  return db
    .select()
    .from(notesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(notesTable.updatedAt))
    .limit(opts.limit ?? 100);
}

export async function getNoteById(id: number): Promise<Note | undefined> {
  const result = await db
    .select()
    .from(notesTable)
    .where(eq(notesTable.id, id))
    .limit(1);

  return result[0];
}

export async function updateNote(
  id: number,
  updates: Partial<Pick<Note, "content">>,
): Promise<Note | undefined> {
  const result = await db
    .update(notesTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(notesTable.id, id))
    .returning();

  return result[0];
}

export async function deleteNoteById(id: number): Promise<Note | undefined> {
  const result = await db
    .delete(notesTable)
    .where(eq(notesTable.id, id))
    .returning();

  return result[0];
}
