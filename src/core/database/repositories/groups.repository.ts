import { eq } from "drizzle-orm";
import { db } from "..";
import { Group, groupsTable, NewGroup } from "../schema";
import { PermissionMap } from "../../ai/types";

/**
 * Get a group by platform id, creating a stub row on first sight.
 * Called whenever Edwin sees a group chat so settings always exist.
 */
export async function getOrCreateGroup(
  platformId: string,
  opts: { name?: string; platform?: string } = {},
): Promise<Group> {
  const existing = await db
    .select()
    .from(groupsTable)
    .where(eq(groupsTable.platformId, platformId))
    .limit(1);

  if (existing[0]) {
    // Refresh the group name when it changes (subjects get renamed).
    if (opts.name && existing[0].name !== opts.name) {
      const updated = await db
        .update(groupsTable)
        .set({ name: opts.name, updatedAt: new Date() })
        .where(eq(groupsTable.id, existing[0].id))
        .returning();

      return updated[0];
    }

    return existing[0];
  }

  const created = await db
    .insert(groupsTable)
    .values({
      platformId,
      name: opts.name,
      platform: opts.platform ?? "whatsapp",
    })
    .onConflictDoNothing()
    .returning();

  if (created[0]) {
    return created[0];
  }

  const raced = await db
    .select()
    .from(groupsTable)
    .where(eq(groupsTable.platformId, platformId))
    .limit(1);

  return raced[0];
}

export async function getGroup(platformId: string): Promise<Group | undefined> {
  const result = await db
    .select()
    .from(groupsTable)
    .where(eq(groupsTable.platformId, platformId))
    .limit(1);

  return result[0];
}

export async function updateGroup(
  platformId: string,
  updates: Partial<
    Pick<Group, "name" | "autoParticipate" | "permissions" | "preferences">
  >,
): Promise<Group | undefined> {
  const result = await db
    .update(groupsTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(groupsTable.platformId, platformId))
    .returning();

  return result[0];
}

export function setGroupPermissions(
  platformId: string,
  permissions: PermissionMap,
) {
  return updateGroup(platformId, { permissions });
}

export function setGroupPreferences(
  platformId: string,
  preferences: Record<string, unknown>,
) {
  return updateGroup(platformId, { preferences });
}
