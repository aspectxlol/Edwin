import { desc, eq } from "drizzle-orm";
import { db } from "..";
import { NewMessage, NewNote, messagesTable, notesTable } from "../schema";

export function saveMessage(message: NewMessage) {
  return db.insert(messagesTable).values(message);
}

export async function getRecentMessages(conversationId: string, amount = 30) {
  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, conversationId))
    .orderBy(desc(messagesTable.createdAt))
    .limit(amount);

  return messages.reverse();
}

export async function messageExists(externalId: string) {
  const result = await db
    .select({ id: messagesTable.id })
    .from(messagesTable)
    .where(eq(messagesTable.externalId, externalId))
    .limit(1);

  return result.length > 0;
}

export async function getMessageByExternalId(externalId: string) {
  const result = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.externalId, externalId))
    .limit(1);

  return result[0];
}

export function saveNote(note: NewNote) {
  return db.insert(notesTable).values(note);
}
