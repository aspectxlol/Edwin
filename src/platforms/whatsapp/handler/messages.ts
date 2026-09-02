import { WAMessage, WASocket } from "@whiskeysockets/baileys";
import { runAssistant } from "../../../core/ai/assistant";
import { decideGroupResponse } from "../../../core/ai/groupDecision";
import type { PermissionMap } from "../../../core/ai/types";
import { isToolAllowed } from "../../../core/security/acl.evaluator";
import {
  getMessageByExternalId,
  getRecentMessages,
  messageExists,
  saveMessage,
} from "../../../core/database/repositories/messages.repository";
import {
  logIncoming,
  logOutgoing,
  logger,
  shortJid,
} from "../../../core/libs/logger";
import { applyMentions } from "../mentions";
import { WhatsAppMessagingPort } from "../port";
import { getOrCreateUser } from "../../../core/database/repositories/users.repository";
import { getOrCreateGroup } from "../../../core/database/repositories/groups.repository";

function isGroup(jid: string) {
  return jid.endsWith("@g.us");
}

/**
 * Resolve a readable chat name: group subject for groups,
 * pushName / short JID for private chats.
 */
async function getChatName(sock: WASocket, jid: string) {
  if (isGroup(jid)) {
    try {
      const metadata = await sock.groupMetadata(jid);
      return metadata.subject;
    } catch {
      return shortJid(jid);
    }
  }

  return shortJid(jid);
}

function getMessageText(message: WAMessage) {
  return (
    message.message?.conversation ??
    message.message?.extendedTextMessage?.text ??
    ""
  );
}

function getReplyContext(message: WAMessage) {
  const context = message.message?.extendedTextMessage?.contextInfo;

  if (!context?.quotedMessage) {
    return null;
  }

  const quotedText =
    context.quotedMessage.conversation ??
    context.quotedMessage.extendedTextMessage?.text ??
    "";

  return {
    text: quotedText || "[attachment]",
    participant: context.participant,
    messageId: context.stanzaId,
  };
}

function normalizeJid(jid: string) {
  return jid.split(":")[0];
}

function mentionsEdwin(message: WAMessage, edwinJid: string) {
  const mentionedJids =
    message.message?.extendedTextMessage?.contextInfo?.mentionedJid;

  if (!mentionedJids) {
    return false;
  }

  return mentionedJids.some(
    (jid) => normalizeJid(jid) === normalizeJid(edwinJid),
  );
}

function startsWithEdwin(text: string) {
  return /^(\s*)(hey\s+)?edwin\b/i.test(text);
}

async function shouldRespond(message: WAMessage, edwinJid: string) {
  const jid = message.key.remoteJid;

  if (!jid) {
    return false;
  }

  // Private chats always wake Edwin.
  if (!isGroup(jid)) {
    return true;
  }

  const text = getMessageText(message);
  const reply = getReplyContext(message);

  // @Edwin
  if (mentionsEdwin(message, edwinJid)) {
    return true;
  }

  // Reply to Edwin
  if (reply?.messageId) {
    const repliedMessage = await getMessageByExternalId(reply.messageId);

    if (repliedMessage?.senderId === "EDWIN") {
      return true;
    }
  }

  // "Edwin, ..."
  // "Hey Edwin ..."
  if (startsWithEdwin(text)) {
    return true;
  }

  return false;
}

export async function handleMessage(
  port: WhatsAppMessagingPort,
  message: WAMessage,
  type: string,
) {
  const sock = port.sock;

  if (!message.message) {
    return;
  }

  const externalId = message.key.id;

  if (!externalId) {
    logger.warn("Message has no ID, skipping");
    return;
  }

  // Prevent duplicate history-sync messages
  // and duplicate live messages.
  if (await messageExists(externalId)) {
    return;
  }

  const jid = message.key.remoteJid;

  if (!jid) {
    return;
  }

  const sender = message.pushName ?? "Unknown";
  const text = getMessageText(message);

  const senderId =
    message.key.participant ?? message.key.remoteJid ?? "unknown";

  const reply = getReplyContext(message);

  const createdAt = new Date(
    Number(message.messageTimestamp ?? Math.floor(Date.now() / 1000)) * 1000,
  );

  // Persist EVERY message.
  await saveMessage({
    externalId,
    content: text,
    conversationId: jid,

    senderId: message.key.fromMe ? "EDWIN" : senderId,

    senderName: message.key.fromMe ? "Edwin" : sender,

    createdAt,

    role: message.key.fromMe ? "assistant" : "human",

    metadata: {
      upsertType: type,
      isGroup: isGroup(jid),

      replyTo: reply
        ? {
            messageId: reply.messageId,
            participant: reply.participant,
            text: reply.text,
          }
        : null,
    },
  });

  const chatName = await getChatName(sock, jid);

  // Lazily register the sender and the group, loading their permission
  // maps for the ACL system. Bot's own messages don't need this.
  let senderPermissions: PermissionMap = {};
  let groupPermissions: PermissionMap = {};

  if (!message.key.fromMe) {
    try {
      const user = await getOrCreateUser(senderId, {
        displayName: sender,
        platform: "whatsapp",
      });

      senderPermissions = (user.permissions as PermissionMap) ?? {};

      if (isGroup(jid)) {
        const group = await getOrCreateGroup(jid, { name: chatName });

        groupPermissions = (group.permissions as PermissionMap) ?? {};
      }
    } catch (error) {
      // Registration/permission failures must never block message handling.
      logger.warn(`User/group registration failed: ${error}`);
    }
  }

  // The bot's own messages arrive here as an "append" echo after being
  // sent (they're persisted above for history). Don't log them as IN —
  // they were already logged as OUT when sent.
  if (!message.key.fromMe) {
    logIncoming({
      chat: chatName,
      isGroup: isGroup(jid),
      sender,
      senderId: shortJid(senderId),
      text,
      replyTo: reply?.text ?? null,
      type,
    });
  }

  // History synchronization.
  // Save it, but never trigger the AI.
  if (type !== "notify") {
    return;
  }

  // Don't respond to ourselves.
  if (message.key.fromMe) {
    return;
  }

  const edwinJid = sock.user?.id;

  if (!edwinJid) {
    logger.warn("Edwin JID unavailable");
    return;
  }

  // Reply permission gate: unknown/random senders (empty permission maps)
  // are denied by default, so random people pinging the bot get silence.
  // Owners/users/groups with "chat.reply": "allow" (or a wildcard) get
  // normal behavior. Uses the same additive-union rules as tools.
  const replyAuth = isToolAllowed(
    "chat.reply",
    {
      senderId,
      senderName: sender,
      senderPermissions,
      conversationId: jid,
      isGroup: isGroup(jid),
      groupPermissions,
    },
    // Default for users/groups with NO matching entry at all: allow.
    // Explicitly set "chat.reply": "deny" (or "*": "deny") to silence.
    "allow",
  );

  if (!replyAuth.allowed) {
    logger.info(
      `Reply denied for ${sender} (${shortJid(senderId)}) in "${chatName}": ${replyAuth.reason}`,
    );
    return;
  }

  const history = await getRecentMessages(jid, 30);

  // Build name -> JID map for mention resolution.
  const nameToJid = new Map<string, string>();

  for (const m of history) {
    if (
      m.senderName &&
      m.senderId !== "EDWIN" &&
      m.senderId !== "SYSTEM" &&
      m.senderId.includes("@")
    ) {
      const lower = m.senderName.toLowerCase();

      if (!nameToJid.has(lower)) {
        nameToJid.set(lower, m.senderId);
      }

      const first = lower.split(/\s+/)[0];

      if (!nameToJid.has(first)) {
        nameToJid.set(first, m.senderId);
      }
    }
  }

  // Group messages: explicit pings always wake the bot.
  // Everything else goes through the restraint-first decision engine,
  // which either stays silent or produces the exact response to send.
  if (isGroup(jid) && !(await shouldRespond(message, edwinJid))) {
    const decision = await decideGroupResponse(history);

    if (decision.action === "no_reply") {
      return;
    }

    const mentioned = applyMentions(decision.text, nameToJid);

    await sock.sendMessage(
      jid,
      {
        text: mentioned.text,
        mentions: mentioned.mentionIds,
      },
      {
        quoted: message,
      },
    );

    logOutgoing(chatName, decision.text);
    return;
  }

  logger.bot(`Direct ping from ${sender} in "${chatName}" — waking agent`);

  await sock.sendPresenceUpdate("composing", jid);

  const typingInterval = setInterval(() => {
    sock.sendPresenceUpdate("composing", jid).catch(() => {});
  }, 3_000);

  try {
    const response = await runAssistant(history, {
      senderId,
      senderName: sender,
      senderPermissions,
      conversationId: jid,
      isGroup: isGroup(jid),
      groupPermissions,
    });

    if (!response) {
      return;
    }

    const mentioned = applyMentions(response, nameToJid);

    await sock.sendMessage(
      jid,
      {
        text: mentioned.text,
        mentions: mentioned.mentionIds,
      },
      {
        quoted: message,
      },
    );

    logOutgoing(chatName, response);
  } finally {
    clearInterval(typingInterval);

    await sock.sendPresenceUpdate("paused", jid);
  }
}
