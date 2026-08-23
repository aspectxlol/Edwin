import { WASocket, WAMessage } from "@whiskeysockets/baileys";
import NodeCache from "node-cache";
import {
  handleGroupParticipantsUpdate,
  handleGroupsUpdate,
} from "./handler/groups";
import { handleMessage } from "./handler/messages";
import { handleConnectionUpdate } from "./handler/connection";

export function registerWhatsAppEvents(sock: WASocket, groupCache: NodeCache) {
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
        await handleMessage(sock, message, type);
      } catch (error) {
        console.error("[WhatsApp] Failed processing message:", error);
      }
    }
  });
}
