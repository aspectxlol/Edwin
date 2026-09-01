import { registerProcessHandlers } from "./core/libs/processHandlers";
import { logger } from "./core/libs/logger";
import { startReminderScheduler } from "./core/scheduling/reminderScheduler";
import { createWhatsAppClient } from "./platforms/whatsapp/client";
import { applyMentions } from "./platforms/whatsapp/mentions";
import { getRecentMessages } from "./core/database/repositories/messages.repository";
import { Message } from "./core/database/schema";

/**
 * Build a display-name -> platform-user-id map from chat history.
 * Shared by all platforms for mention resolution.
 */
function buildNameMap(history: Message[]): Map<string, string> {
  const map = new Map<string, string>();

  for (const m of history) {
    if (
      m.senderName &&
      m.senderId !== "EDWIN" &&
      m.senderId !== "SYSTEM" &&
      m.senderId.includes("@")
    ) {
      const lower = m.senderName.toLowerCase();

      if (!map.has(lower)) {
        map.set(lower, m.senderId);
      }

      const first = lower.split(/\s+/)[0];

      if (!map.has(first)) {
        map.set(first, m.senderId);
      }
    }
  }

  return map;
}

async function main() {
  registerProcessHandlers();

  logger.info("Starting Edwin...");

  // Register platforms. Adding Discord later = create its client + port
  // here, wire its events to core, and pass its port to the scheduler too.
  const whatsapp = await createWhatsAppClient();

  startReminderScheduler(
    whatsapp.port,
    async (text: string, conversationId: string) => {
      const history = await getRecentMessages(conversationId, 20);
      const nameToJid = buildNameMap(history);

      return applyMentions(text, nameToJid);
    },
  );

  logger.success("Edwin is running");
}

main().catch((error) => {
  logger.error(`Fatal startup error: ${error}`);
  process.exit(1);
});
