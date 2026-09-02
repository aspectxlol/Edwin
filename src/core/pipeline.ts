import { runAssistant } from "./ai/assistant";
import { decideGroupResponse } from "./ai/groupDecision";
import {
  getMessageByExternalId,
  getRecentMessages,
  messageExists,
  saveMessage,
} from "./database/repositories/messages.repository";
import { logger } from "./libs/logger";
import { IncomingMessage, MessagingPort } from "./ports/messaging";

export interface PipelineDeps {
  // The platform this pipeline instance serves.
  port: MessagingPort;

  // Resolve the platform message ID of an incoming message, used for
  // dedup and reply-to lookups.
  getExternalId: (raw: unknown) => string | null;

  // Whether the bot was explicitly pinged (mention, name prefix, reply
  // to a bot message). Platform-specific mechanics live in the adapter.
  isExplicitPing: (raw: unknown, incoming: IncomingMessage) => Promise<boolean>;

  // Convert "@Name" tokens into platform mentions. Returns the final
  // text and mention IDs to send.
  applyMentions: (
    text: string,
    nameToId: Map<string, string>,
  ) => { text: string; mentionIds: string[] };
}

/**
 * Core message pipeline, shared by every platform.
 *
 * Persists the message, decides whether to reply (explicit ping fast-path,
 * then the restraint-first group decision engine), runs the agent, and
 * sends the response through the platform port.
 */
export async function handleIncomingMessage(
  deps: PipelineDeps,
  raw: unknown,
  incoming: IncomingMessage,
  upsertType: string,
) {
  const { port } = deps;

  const externalId = deps.getExternalId(raw);

  if (!externalId) {
    logger.warn("Message has no ID, skipping");
    return;
  }

  // Prevent duplicate history-sync messages and duplicate live messages.
  if (await messageExists(externalId)) {
    return;
  }

  const isGroup = port.isGroup(incoming.conversationId);

  // Persist EVERY message (including the bot's own, for history).
  await saveMessage({
    externalId,
    content: incoming.text,
    conversationId: incoming.conversationId,

    senderId: incoming.fromSelf ? "EDWIN" : incoming.senderId,

    senderName: incoming.fromSelf
      ? "Edwin"
      : (incoming.senderName ?? "Unknown"),

    role: incoming.fromSelf ? "assistant" : "human",

    createdAt: new Date(),

    metadata: {
      upsertType,
      platform: port.platform,
      isGroup,

      replyTo: incoming.replyToText ? { text: incoming.replyToText } : null,
    },
  });

  const chat = await port.getChatInfo(incoming.conversationId);

  if (!incoming.fromSelf) {
    logger.info(
      `IN  [${chat.name}] ${incoming.senderName ?? incoming.senderId}: ${incoming.text || "[attachment]"}`,
    );
  }

  // History synchronization and echoes never trigger the AI.
  if (upsertType !== "notify" || incoming.fromSelf) {
    return;
  }

  const history = await getRecentMessages(incoming.conversationId, 30);

  // Build the name -> platform-id map for mention resolution.
  const nameToId = new Map<string, string>();

  for (const m of history) {
    if (
      m.senderName &&
      m.senderId !== "EDWIN" &&
      m.senderId !== "SYSTEM" &&
      m.senderId.includes("@")
    ) {
      const lower = m.senderName.toLowerCase();

      if (!nameToId.has(lower)) {
        nameToId.set(lower, m.senderId);
      }

      const first = lower.split(/\s+/)[0];

      if (!nameToId.has(first)) {
        nameToId.set(first, m.senderId);
      }
    }
  }

  // Fast path: explicit pings always wake the agent.
  const explicitPing = await deps.isExplicitPing(raw, incoming);

  if (isGroup && !explicitPing) {
    // Restraint-first decision engine.
    const decision = await decideGroupResponse(history);

    if (decision.action === "no_reply") {
      return;
    }

    const mentioned = deps.applyMentions(decision.text, nameToId);

    await port.send(incoming.conversationId, mentioned, raw);

    logger.info(`OUT [${chat.name}] ${decision.text}`);
    return;
  }

  logger.bot(`Direct ping from ${incoming.senderName} in "${chat.name}"`);

  const response = await runAssistant(history, {
    senderId: incoming.senderId,
    senderName: incoming.senderName,
    senderPermissions: {},
    conversationId: incoming.conversationId,
    isGroup: isGroup,
    groupPermissions: {},
  });

  if (!response) {
    return;
  }

  const mentioned = deps.applyMentions(response, nameToId);

  await port.send(incoming.conversationId, mentioned, raw);

  logger.info(`OUT [${chat.name}] ${response}`);
}

// Re-export for reply lookups (used by adapters implementing isExplicitPing).
export { getMessageByExternalId };
