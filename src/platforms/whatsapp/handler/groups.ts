import { WASocket } from "@whiskeysockets/baileys";
import NodeCache from "node-cache";
import { logger } from "../../../core/libs/logger";

export async function handleGroupsUpdate(
  sock: WASocket,
  events: any[],
  groupCache: NodeCache,
) {
  for (const event of events) {
    try {
      const metadata = await sock.groupMetadata(event.id);

      groupCache.set(event.id, metadata);
    } catch (error) {
      logger.error(`Failed to update group metadata: ${error}`);
    }
  }
}

export async function handleGroupParticipantsUpdate(
  sock: WASocket,
  event: any,
  groupCache: NodeCache,
) {
  try {
    const metadata = await sock.groupMetadata(event.id);

    groupCache.set(event.id, metadata);
  } catch (error) {
    logger.error(`Failed to update group participants: ${error}`);
  }
}
