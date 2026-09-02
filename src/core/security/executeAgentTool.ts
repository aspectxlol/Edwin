import { ToolRegistry, ToolContext } from "../ai/types";
import { isToolAllowed } from "./acl.evaluator";
import { logger } from "../libs/logger";

/**
 * Guarded tool execution. Resolves the tool, evaluates the additive-union
 * ACL against its inline permissionKey, and only then runs the handler.
 *
 * Never throws — returns error payloads the model can read.
 */
export async function executeAgentTool(
  registry: ToolRegistry,
  toolName: string,
  args: any,
  context: ToolContext,
): Promise<Record<string, any>> {
  const tool = registry[toolName];

  if (!tool) {
    return {
      error: true,
      message: `Tool '${toolName}' not found in registry.`,
    };
  }

  // Guard check against the inline permissionKey.
  const auth = isToolAllowed(tool.permissionKey, context, tool.defaultEffect);

  if (!auth.allowed) {
    logger.warn(
      `Permission denied: ${context.senderId} → ${toolName} (${tool.permissionKey})`,
    );

    return {
      error: true,
      permissionDenied: true,
      message: `Permission Denied: Cannot run '${toolName}' (${tool.permissionKey}). ${auth.reason}.`,
    };
  }

  try {
    return await tool.handler(args, context);
  } catch (error) {
    return {
      error: true,
      message:
        error instanceof Error ? error.message : "Tool execution failed.",
    };
  }
}
