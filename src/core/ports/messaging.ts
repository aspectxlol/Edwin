/**
 * The platform contract between Edwin's core and any chat platform.
 *
 * Core never imports WhatsApp/Discord types — it talks to a MessagingPort.
 * A new integration (e.g. Discord) only needs to implement this interface
 * and register itself, and the whole brain works unchanged.
 */
export interface OutgoingMessage {
  text: string;

  // Platform-specific IDs of users to @-mention/ping (already resolved
  // by the platform adapter's mention utilities).
  mentionIds?: string[];
}

export interface IncomingMessage {
  // Platform-agnostic conversation identifier (used as DB conversationId).
  conversationId: string;

  // Platform user ID of the sender (JID for WhatsApp, snowflake for Discord).
  senderId: string;

  // Display name of the sender, when the platform provides one.
  senderName?: string;

  // Text content of the message.
  text: string;

  // Text of the message being replied to, if any.
  replyToText?: string | null;

  // Whether the sender is the bot itself.
  fromSelf: boolean;
}

export interface ChatInfo {
  conversationId: string;

  // Human-readable chat name (group subject / DM label) for logging.
  name: string;

  isGroup: boolean;
}

export interface MessagingPort {
  // Platform identifier, e.g. "whatsapp", "discord".
  readonly platform: string;

  // Send a message to a conversation. `replyTo` is an opaque platform
  // message reference the adapter may use for quoting.
  send(
    conversationId: string,
    message: OutgoingMessage,
    replyTo?: unknown,
  ): Promise<void>;

  // Resolve a chat's display name for logging/UI.
  getChatInfo(conversationId: string): Promise<ChatInfo>;

  // Whether the bot should consider this conversation "group-like"
  // (multi-participant). Drives the group decision engine.
  isGroup(conversationId: string): boolean;
}
