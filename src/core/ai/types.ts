import OpenAI from "openai";

export type PermissionEffect = "allow" | "deny";

// Map of permission pattern -> effect. Patterns may be exact
// ("tools.order.create"), glob ("tools.order.*"), or "*" for everything.
export type PermissionMap = Record<string, PermissionEffect>;

export interface AccessSubject {
  id: string;
  name?: string;
  permissions: PermissionMap;
}

// Context about the current conversation, injected into every tool handler.
export interface ToolContext {
  // WhatsApp JID of the person the bot is talking to right now.
  senderId: string;

  // Display name of the sender, when available.
  senderName?: string;

  // The sender's personal permission map (what THEY are allowed to do).
  senderPermissions: PermissionMap;

  // Chat JID the message came from.
  conversationId: string;

  // Whether the message came from a group chat.
  isGroup: boolean;

  // The group's permission map. Access is granted if EITHER the sender
  // OR the group allows (additive union).
  groupPermissions?: PermissionMap;
}

// Tool Contract Interface
export interface AgentTool<T = any> {
  // Required permission action key checked before execution
  // (e.g. "tools.order.create", "tools.notes.save").
  permissionKey: string;

  // Effect used when neither subject has any matching pattern (default deny).
  defaultEffect?: PermissionEffect;

  definition: OpenAI.ChatCompletionTool;

  handler: (
    args: T,
    context: ToolContext,
  ) => Promise<Record<string, any>> | Record<string, any>;
}

// Global registry type indexed by function name
export type ToolRegistry = Record<string, AgentTool>;
