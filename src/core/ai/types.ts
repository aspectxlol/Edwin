import OpenAI from "openai";

// Context about the current conversation, injected into every tool handler.
export interface ToolContext {
  // WhatsApp JID of the person the bot is talking to right now.
  senderId: string;

  // Display name of the sender, when available.
  senderName?: string;

  // Chat JID the message came from.
  conversationId: string;
}

// Tool Contract Interface
export interface AgentTool<T = any> {
  definition: OpenAI.ChatCompletionTool;
  handler: (
    args: T,
    context: ToolContext,
  ) => Promise<Record<string, any>> | Record<string, any>;
}

// Global registry type indexed by function name
export type ToolRegistry = Record<string, AgentTool>;
