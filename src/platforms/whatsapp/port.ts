import { WASocket } from "@whiskeysockets/baileys";
import NodeCache from "node-cache";
import {
  ChatInfo,
  MessagingPort,
  OutgoingMessage,
} from "../../core/ports/messaging";
import { applyMentions } from "./mentions";

/**
 * WhatsApp implementation of the MessagingPort contract.
 * All Baileys-specific mechanics (JIDs, mentions, quoting) live here.
 */
export class WhatsAppMessagingPort implements MessagingPort {
  readonly platform = "whatsapp";

  constructor(
    public readonly sock: WASocket,
    private readonly groupCache: NodeCache,
  ) {}

  isGroup(conversationId: string): boolean {
    return conversationId.endsWith("@g.us");
  }

  async getChatInfo(conversationId: string): Promise<ChatInfo> {
    if (this.isGroup(conversationId)) {
      try {
        const metadata = await this.sock.groupMetadata(conversationId);

        return {
          conversationId,
          name: metadata.subject,
          isGroup: true,
        };
      } catch {
        return {
          conversationId,
          name: shortJid(conversationId),
          isGroup: true,
        };
      }
    }

    return {
      conversationId,
      name: shortJid(conversationId),
      isGroup: false,
    };
  }

  async send(
    conversationId: string,
    message: OutgoingMessage,
    replyTo?: unknown,
  ): Promise<void> {
    const quoted = replyTo as Parameters<
      typeof this.sock.sendMessage
    >[2] extends { quoted?: infer Q } | undefined
      ? Q
      : never;

    await this.sock.sendMessage(
      conversationId,
      {
        text: message.text,
        mentions: message.mentionIds,
      },
      quoted ? { quoted } : undefined,
    );
  }

  /**
   * Convert "@Name" tokens into real WhatsApp mentions using the
   * name -> JID map built from chat history.
   */
  applyMentions(
    text: string,
    nameToId: Map<string, string>,
  ): { text: string; mentionIds: string[] } {
    return applyMentions(text, nameToId);
  }
}

function shortJid(jid: string) {
  const bare = jid.split("@")[0].split(":")[0];
  return `…${bare.slice(-5)}`;
}
