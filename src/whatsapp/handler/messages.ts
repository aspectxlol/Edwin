import { WAMessage, WASocket } from "@whiskeysockets/baileys";
import { runAssistant } from "../../ai/assistant";
import {
  getMessageByExternalId,
  getRecentMessages,
  messageExists,
  saveMessage,
} from "../../database/repositories/messages.repository";

function isGroup(jid: string) {
  return jid.endsWith("@g.us");
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

function mentionsElora(message: WAMessage, eloraJid: string) {
  const mentionedJids =
    message.message?.extendedTextMessage?.contextInfo?.mentionedJid;

  if (!mentionedJids) {
    return false;
  }

  return mentionedJids.some(
    (jid) => normalizeJid(jid) === normalizeJid(eloraJid),
  );
}

function startsWithElora(text: string) {
  return /^(\s*)(hey\s+)?elora\b/i.test(text);
}

async function shouldRespond(message: WAMessage, eloraJid: string) {
  const jid = message.key.remoteJid;

  if (!jid) {
    return false;
  }

  // Private chats always wake Elora.
  if (!isGroup(jid)) {
    return true;
  }

  const text = getMessageText(message);
  const reply = getReplyContext(message);

  // @Elora
  if (mentionsElora(message, eloraJid)) {
    return true;
  }

  // Reply to Elora
  if (reply?.messageId) {
    const repliedMessage = await getMessageByExternalId(reply.messageId);

    if (repliedMessage?.senderId === "ELORA") {
      return true;
    }
  }

  // "Elora, ..."
  // "Hey Elora ..."
  if (startsWithElora(text)) {
    return true;
  }

  return false;
}

export async function handleMessage(
  sock: WASocket,
  message: WAMessage,
  type: string,
) {
  if (!message.message) {
    return;
  }

  const externalId = message.key.id;

  if (!externalId) {
    console.warn("Message has no ID, skipping");
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

    senderId: message.key.fromMe ? "ELORA" : senderId,

    senderName: message.key.fromMe ? "Elora" : sender,

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

  console.log("--------------------------------");
  console.log(`type: ${type}`);
  console.log(`conversation: ${isGroup(jid) ? "group" : "private"}`);
  console.log(`from: ${message.key.fromMe ? "Elora" : sender}`);
  console.log(`message: ${text || "[attachment]"}`);

  if (reply) {
    console.log(`replying to: ${reply.text}`);
  }

  console.log("--------------------------------");

  // History synchronization.
  // Save it, but never trigger the AI.
  if (type !== "notify") {
    return;
  }

  // Don't respond to ourselves.
  if (message.key.fromMe) {
    return;
  }

  const eloraJid = sock.user?.id;

  if (!eloraJid) {
    console.warn("Elora JID unavailable");
    return;
  }

  // Group messages require explicit addressing.
  if (!(await shouldRespond(message, eloraJid))) {
    return;
  }

  console.log("[Elora] Message addressed to Elora");

  await sock.sendPresenceUpdate("composing", jid);

  const typingInterval = setInterval(() => {
    sock.sendPresenceUpdate("composing", jid).catch(() => {});
  }, 3_000);

  try {
    const history = await getRecentMessages(jid, 30);

    const response = await runAssistant(history);

    if (!response) {
      return;
    }

    await sock.sendMessage(
      jid,
      {
        text: response,
      },
      {
        quoted: message,
      },
    );

    console.log("[Assistant Output]:", response);
  } finally {
    clearInterval(typingInterval);

    await sock.sendPresenceUpdate("paused", jid);
  }
}
