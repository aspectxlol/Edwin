import { PermissionEffect, PermissionMap, ToolContext } from "../ai/types";

export interface AclDecision {
  allowed: boolean;
  reason: string;
}

/**
 * Find the most specific matching pattern for a permission key.
 *
 * Specificity: exact match > glob with more literal segments > "*" wildcard.
 * Returns undefined when nothing matches.
 */
function matchPattern(
  permissionKey: string,
  permissions: PermissionMap,
): { pattern: string; effect: PermissionEffect } | undefined {
  let best: { pattern: string; effect: PermissionEffect } | undefined;
  let bestScore = -1;

  for (const [pattern, effect] of Object.entries(permissions)) {
    if (!matchesGlob(permissionKey, pattern)) {
      continue;
    }

    // Score specificity: exact match always wins; otherwise, the more
    // non-wildcard segments, the more specific.
    let score: number;

    if (pattern === permissionKey) {
      score = Number.MAX_SAFE_INTEGER;
    } else {
      const segments = pattern.split(".");

      // Count literal (non-wildcard) segments; a lone "*" scores 0.
      score =
        pattern === "*"
          ? 0
          : segments.filter((s) => s !== "*" && !s.includes("*")).length;
    }

    if (score > bestScore) {
      best = { pattern, effect };
      bestScore = score;
    }
  }

  return best;
}

/**
 * Glob match where "*" is a wildcard:
 * - pattern "*" matches everything.
 * - "tools.order.*" matches "tools.order.create" but NOT "tools.order"
 *   and NOT "tools.order.create.item".
 * - Wildcard must consume a whole segment.
 */
export function matchesGlob(key: string, pattern: string): boolean {
  if (pattern === "*") {
    return true;
  }

  const keySegments = key.split(".");
  const patternSegments = pattern.split(".");

  // A glob cannot match fewer segments than the pattern provides.
  if (patternSegments.length !== keySegments.length) {
    return false;
  }

  return patternSegments.every(
    (seg, i) => seg === "*" || seg === keySegments[i],
  );
}

/**
 * Evaluate a single subject's permission map against a permission key.
 * Returns undefined when no pattern matches (neutral).
 */
function evaluateSubject(
  permissionKey: string,
  permissions: PermissionMap | undefined,
): PermissionEffect | undefined {
  if (!permissions) {
    return undefined;
  }

  return matchPattern(permissionKey, permissions)?.effect;
}

/**
 * Additive Union ACL evaluator.
 *
 * Access is granted if EITHER the sender OR the group chat grants "allow"
 * for the tool's permission key (directly or via wildcard). The most
 * specific matching pattern wins within each map. Explicit "deny" beats
 * broader wildcards within the same map, but cannot override an "allow"
 * from the OTHER map (additive union).
 *
 * If nothing matches, falls back to the tool's defaultEffect (deny).
 */
export function isToolAllowed(
  permissionKey: string,
  context: ToolContext,
  defaultEffect: PermissionEffect = "deny",
): AclDecision {
  const senderEffect = evaluateSubject(
    permissionKey,
    context.senderPermissions,
  );
  const groupEffect = context.isGroup
    ? evaluateSubject(permissionKey, context.groupPermissions)
    : undefined;

  // 1. Sender allows → granted (additive: group deny cannot veto this).
  if (senderEffect === "allow") {
    return {
      allowed: true,
      reason: `Allowed by sender permission for '${permissionKey}'.`,
    };
  }

  // 2. Group allows (groups only) → granted.
  if (context.isGroup && groupEffect === "allow") {
    return {
      allowed: true,
      reason: `Allowed by group permission for '${permissionKey}'.`,
    };
  }

  // 3. No allow anywhere → denied with the most informative reason.
  if (senderEffect === "deny" || groupEffect === "deny") {
    return {
      allowed: false,
      reason: `Explicitly denied for '${permissionKey}'`,
    };
  }

  return {
    allowed: defaultEffect === "allow",
    reason:
      defaultEffect === "allow"
        ? `No explicit permission found for '${permissionKey}'; granted by default effect.`
        : `No permission grants found for '${permissionKey}'; denied by default.`,
  };
}
