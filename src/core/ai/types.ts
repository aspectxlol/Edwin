import OpenAI from "openai";

// Tool Contract Interface
export interface AgentTool<T = any> {
  definition: OpenAI.ChatCompletionTool;
  handler: (args: T) => Promise<Record<string, any>> | Record<string, any>;
}

// Global registry type indexed by function name
export type ToolRegistry = Record<string, AgentTool>;
