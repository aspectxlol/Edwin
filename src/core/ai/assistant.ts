import OpenAI from "openai";

import { aiClient, MODEL } from "./client";
import { systemPrompt } from "./prompt";
import { toolDefinitions, toolsRegistry } from "./tools/registry";

import { Message } from "../database/schema";
import { ToolContext } from "./types";
import { logger } from "../libs/logger";
import { executeAgentTool } from "../security/executeAgentTool";

export async function runAssistant(history: Message[], context: ToolContext) {
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: systemPrompt,
    },

    ...history.map((message) => {
      if (message.role === "assistant") {
        return {
          role: "assistant" as const,
          content: message.content,
        };
      }

      return {
        role: "user" as const,
        content: `${message.senderName}: ${message.content}`,
      };
    }),
  ];

  while (true) {
    const response = await aiClient.chat.completions.create({
      model: MODEL,
      messages,
      tools: toolDefinitions.length > 0 ? toolDefinitions : undefined,
      tool_choice: "auto",
    });

    const choice = response.choices[0];

    if (!choice) {
      throw new Error("No valid choice returned from OpenRouter.");
    }

    const assistantMessage = choice.message;

    messages.push(assistantMessage);

    if (
      !assistantMessage.tool_calls ||
      assistantMessage.tool_calls.length === 0
    ) {
      return assistantMessage.content ?? "";
    }

    for (const toolCall of assistantMessage.tool_calls) {
      if (toolCall.type !== "function") {
        continue;
      }

      const toolName = toolCall.function.name;

      let args: unknown;

      try {
        args = JSON.parse(toolCall.function.arguments || "{}");
      } catch {
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({ error: "Invalid tool arguments." }),
        });

        continue;
      }

      logger.agent(`tool call → ${toolName} ${JSON.stringify(args)}`);

      // ACL-guarded execution: resolves the tool, checks the inline
      // permissionKey against sender/group permissions, then runs it.
      const toolOutput = await executeAgentTool(
        toolsRegistry,
        toolName,
        args,
        context,
      );

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolOutput),
      });
    }
  }
}
