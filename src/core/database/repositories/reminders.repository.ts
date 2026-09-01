import { and, asc, eq, isNotNull, isNull, lte } from "drizzle-orm";
import { db } from "..";
import { NewReminder, Reminder, remindersTable } from "../schema";

export function createReminder(reminder: NewReminder) {
  return db.insert(remindersTable).values(reminder).returning();
}

export async function getReminder(id: number) {
  const result = await db
    .select()
    .from(remindersTable)
    .where(eq(remindersTable.id, id))
    .limit(1);

  return result[0];
}

export function getUpcomingReminders(conversationId?: string) {
  const conditions = [
    eq(remindersTable.completed, false),
    isNotNull(remindersTable.remindAt),
  ];

  if (conversationId) {
    conditions.push(eq(remindersTable.conversationId, conversationId));
  }

  return db
    .select()
    .from(remindersTable)
    .where(and(...conditions))
    .orderBy(asc(remindersTable.remindAt));
}

/**
 * Reminders that are due now (or overdue) and not yet delivered.
 * Used by the reminder scheduler to know what to fire.
 */
export function getDueReminders(now = new Date()) {
  return db
    .select()
    .from(remindersTable)
    .where(
      and(
        eq(remindersTable.completed, false),
        isNotNull(remindersTable.remindAt),
        lte(remindersTable.remindAt, now),
      ),
    )
    .orderBy(asc(remindersTable.remindAt));
}

export async function updateReminder(
  id: number,
  updates: Partial<Pick<Reminder, "content" | "remindAt" | "completed">>,
) {
  const result = await db
    .update(remindersTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(remindersTable.id, id))
    .returning();

  return result[0];
}

export async function deleteReminder(id: number) {
  const result = await db
    .delete(remindersTable)
    .where(eq(remindersTable.id, id))
    .returning();

  return result[0];
}

/**
 * Reminders created without a specific time. Useful when the user says
 * "remind me about X" without saying when.
 */
export function getUnscheduledReminders(conversationId?: string) {
  const conditions = [
    eq(remindersTable.completed, false),
    isNull(remindersTable.remindAt),
  ];

  if (conversationId) {
    conditions.push(eq(remindersTable.conversationId, conversationId));
  }

  return db
    .select()
    .from(remindersTable)
    .where(and(...conditions))
    .orderBy(asc(remindersTable.createdAt));
}
