import { sql } from "drizzle-orm";
import { db } from "..";
import { groupsTable, usersTable } from "../schema";

export interface ConversationSummary {
  conversationId: string;
  name: string;
  isGroup: boolean;
  lastMessageAt: Date | null;
  messageCount: number;
}

/**
 * List every chat Edwin has seen, with display names resolved from the
 * users/groups tables and message stats from the messages table.
 */
export async function listConversations(): Promise<ConversationSummary[]> {
  const result = await db.execute(
    sql`SELECT "conversationId", MAX("createdAt") AS "lastMessageAt", COUNT(*)::int AS "messageCount" FROM messages GROUP BY "conversationId" ORDER BY "lastMessageAt" DESC`,
  );

  const rows = (
    result as unknown as {
      rows: Array<{
        conversationId: string;
        lastMessageAt: Date | null;
        messageCount: number;
      }>;
    }
  ).rows;

  const groups = await db.select().from(groupsTable);
  const users = await db.select().from(usersTable);

  const groupNameById = new Map(
    groups.map((group) => [group.platformId, group.name]),
  );

  const userNameById = new Map<string, string | null>();

  for (const user of users) {
    userNameById.set(user.platformId, user.displayName);

    // Users may be stored with a device suffix ("123:45@s.whatsapp.net");
    // index the bare form too so DM JIDs match either way.
    userNameById.set(user.platformId.split(":")[0], user.displayName);
  }

  return rows.map((row) => {
    const conversationId = row.conversationId;
    const isGroup = conversationId.endsWith("@g.us");

    let name = conversationId;

    if (isGroup) {
      name = groupNameById.get(conversationId) ?? conversationId;
    } else {
      const bare = conversationId.split(":")[0];

      name =
        userNameById.get(conversationId) ??
        userNameById.get(bare) ??
        conversationId;
    }

    return {
      conversationId,
      name,
      isGroup,
      lastMessageAt: row.lastMessageAt,
      messageCount: Number(row.messageCount),
    };
  });
}
