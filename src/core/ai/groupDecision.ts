import { aiClient, MODEL } from "./client";
import { groupDecisionPrompt } from "./groupDecisionPrompt";
import { Message } from "../database/schema";

export type GroupDecision =
  | { action: "no_reply" }
  | { action: "reply"; text: string };

const NO_REPLY = "NO_REPLY";
const REPLY_PREFIX = "REPLY:";

/**
 * Ask the model to decide whether Edwin should participate in a group chat.
 * Returns either a silence decision or the exact response text to send.
 */
export async function decideGroupResponse(
  history: Message[],
): Promise<GroupDecision> {
  const messages = [
    {
      role: "system" as const,
      content: groupDecisionPrompt,
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

  const response = await aiClient.chat.completions.create({
    model: MODEL,
    messages,
    temperature: 0,
  });

  const output = response.choices[0]?.message?.content?.trim() ?? "";

  if (!output || output.toUpperCase().startsWith(NO_REPLY)) {
    return { action: "no_reply" };
  }

  if (output.toUpperCase().startsWith(REPLY_PREFIX)) {
    const text = output.slice(REPLY_PREFIX.length).trim();

    if (!text) {
      return { action: "no_reply" };
    }

    return { action: "reply", text };
  }

  // The model ignored the protocol. Err on the side of silence.
  return { action: "no_reply" };
}
