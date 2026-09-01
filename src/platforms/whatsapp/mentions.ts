import { Message } from "../../core/database/schema";

export interface MentionedText {
  text: string;

  // Platform user IDs (WhatsApp JIDs) to ping.
  mentionIds: string[];
}

/**
 * Convert "@Name" tokens in AI output into real WhatsApp mentions.
 *
 * The model only knows display names, but WhatsApp mentions require the
 * person's JID in the text plus a `mentions` array. This resolves names
 * against a name -> JID map built from the chat history.
 *
 * Unresolvable "@Name" tokens are left as plain text (no ping).
 */ export function applyMentions(
  text: string,
  nameToJid: Map<string, string>,
): MentionedText {
  const mentions: string[] = [];

  // Replace @Name / @First Name tokens with the mention format @<jid-user>.
  const rewritten = text.replace(
    /@([\p{L}\p{N}]+(?:\s[\p{L}\p{N}]+)?)/gu,
    (match, name: string) => {
      const jid = nameToJid.get(name.toLowerCase());

      if (!jid) {
        // Unknown person — keep as plain text, don't ping anyone.
        return match;
      }

      const user = jid.split("@")[0].split(":")[0];

      if (!mentions.includes(jid)) {
        mentions.push(jid);
      }

      return `@${user}`;
    },
  );

  return { text: rewritten, mentionIds: mentions };
}
