import { eq } from "drizzle-orm";
import { db } from "..";
import { notesTable } from "../schema";

export function getNote(query: string) {
  return db
    .select()
    .from(notesTable)
    .where(eq(notesTable.content, query))
    .limit(1);
}
