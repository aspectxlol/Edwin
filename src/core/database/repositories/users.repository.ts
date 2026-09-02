import { eq } from "drizzle-orm";
import { db } from "..";
import { NewUser, usersTable, User } from "../schema";
import { PermissionMap } from "../../ai/types";

/**
 * Get a user by platform id, creating a stub row on first sight.
 * This is the "lazy registration" path — every sender Edwin encounters
 * ends up with a row here.
 */
export async function getOrCreateUser(
  platformId: string,
  opts: { displayName?: string; platform?: string } = {},
): Promise<User> {
  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.platformId, platformId))
    .limit(1);

  if (existing[0]) {
    // Keep the display name fresh — pushName changes as users rename
    // themselves, and the latest is the most useful for the AI.
    if (
      opts.displayName &&
      opts.displayName !== "Unknown" &&
      existing[0].displayName !== opts.displayName
    ) {
      const updated = await db
        .update(usersTable)
        .set({ displayName: opts.displayName, updatedAt: new Date() })
        .where(eq(usersTable.id, existing[0].id))
        .returning();

      return updated[0];
    }

    return existing[0];
  }

  const created = await db
    .insert(usersTable)
    .values({
      platformId,
      displayName: opts.displayName,
      platform: opts.platform ?? "whatsapp",
    })
    .onConflictDoNothing()
    .returning();

  if (created[0]) {
    return created[0];
  }

  // Lost a race with a concurrent insert — re-read.
  const raced = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.platformId, platformId))
    .limit(1);

  return raced[0];
}

export async function getUser(platformId: string): Promise<User | undefined> {
  const result = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.platformId, platformId))
    .limit(1);

  return result[0];
}

export async function updateUser(
  platformId: string,
  updates: Partial<
    Pick<User, "displayName" | "isOwner" | "permissions" | "preferences">
  >,
): Promise<User | undefined> {
  const result = await db
    .update(usersTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(usersTable.platformId, platformId))
    .returning();

  return result[0];
}

export function setUserPermissions(
  platformId: string,
  permissions: PermissionMap,
) {
  return updateUser(platformId, { permissions });
}

export function setUserPreferences(
  platformId: string,
  preferences: Record<string, unknown>,
) {
  return updateUser(platformId, { preferences });
}
