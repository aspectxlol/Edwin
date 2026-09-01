import { WASocket, WAMessage } from "@whiskeysockets/baileys";
import NodeCache from "node-cache";
import { logger } from "../../../core/libs/logger";
import { handleGroupParticipantsUpdate, handleGroupsUpdate } from "./groups";
import { handleMessage } from "./messages";
import { handleConnectionUpdate } from "./connection";
import { WhatsAppMessagingPort } from "../port";

export function registerWhatsAppEvents(
  port: WhatsAppMessagingPort,
  sock: WASocket,
  groupCache: NodeCache,
) {
  sock.ev.on("connection.update", async (update) => {
    await handleConnectionUpdate(sock, update, groupCache);
  });

  sock.ev.on("groups.update", async (events) => {
    await handleGroupsUpdate(sock, events, groupCache);
  });

  sock.ev.on("group-participants.update", async (event) => {
    await handleGroupParticipantsUpdate(sock, event, groupCache);
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    for (const message of messages) {
      try {
        await handleMessage(port, message, type);
      } catch (error) {
        logger.error(`Failed processing message: ${error}`);
      }
    }
  });
}
