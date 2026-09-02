import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isToolAllowed, matchesGlob } from "./acl.evaluator";
import { executeAgentTool } from "./executeAgentTool";
import { AgentTool, ToolContext } from "../ai/types";

function ctx(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    senderId: "user@test",
    senderName: "Tester",
    senderPermissions: {},
    conversationId: "conv@test",
    isGroup: false,
    groupPermissions: {},
    ...overrides,
  };
}

describe("matchesGlob", () => {
  it("exact pattern matches only itself", () => {
    assert.equal(matchesGlob("tools.order.create", "tools.order.create"), true);
    assert.equal(matchesGlob("tools.order.create", "tools.order.read"), false);
  });

  it("segment glob matches one level", () => {
    assert.equal(matchesGlob("tools.order.create", "tools.order.*"), true);
    assert.equal(matchesGlob("tools.order.read", "tools.order.*"), true);
    assert.equal(matchesGlob("tools.notes.save", "tools.order.*"), false);
    // Does not match deeper or shallower paths.
    assert.equal(
      matchesGlob("tools.order.create.item", "tools.order.*"),
      false,
    );
    assert.equal(matchesGlob("tools.order", "tools.order.*"), false);
  });

  it("global wildcard matches everything", () => {
    assert.equal(matchesGlob("anything.at.all", "*"), true);
  });
});

describe("isToolAllowed — additive union", () => {
  const key = "tools.order.create";

  it("user allow overrides group wildcard deny", () => {
    const decision = isToolAllowed(
      key,
      ctx({
        senderPermissions: { [key]: "allow" },
        isGroup: true,
        groupPermissions: { "*": "deny" },
      }),
    );

    assert.equal(decision.allowed, true);
  });

  it("group allow overrides user wildcard deny", () => {
    const decision = isToolAllowed(
      key,
      ctx({
        senderPermissions: { "*": "deny" },
        isGroup: true,
        groupPermissions: { "tools.order.*": "allow" },
      }),
    );

    assert.equal(decision.allowed, true);
  });

  it("double deny is denied", () => {
    const decision = isToolAllowed(
      key,
      ctx({
        senderPermissions: { [key]: "deny" },
        isGroup: true,
        groupPermissions: { "*": "deny" },
      }),
    );

    assert.equal(decision.allowed, false);
  });

  it("no grants at all is denied by default", () => {
    const decision = isToolAllowed(key, ctx({ isGroup: true }));

    assert.equal(decision.allowed, false);
  });

  it("group allow is ignored in private chats", () => {
    const decision = isToolAllowed(
      key,
      ctx({
        senderPermissions: {},
        isGroup: false,
        groupPermissions: { "*": "allow" },
      }),
    );

    assert.equal(decision.allowed, false);
  });

  it("specific deny beats broader user allow within the same map", () => {
    // tools.order.* allow, but tools.order.create explicitly denied.
    const decision = isToolAllowed(
      key,
      ctx({
        senderPermissions: { "tools.order.*": "allow", [key]: "deny" },
        isGroup: false,
      }),
    );

    assert.equal(decision.allowed, false);
  });

  it("exact allow beats specific deny in the other map (additive union)", () => {
    const decision = isToolAllowed(
      key,
      ctx({
        senderPermissions: { [key]: "allow" },
        isGroup: true,
        groupPermissions: { [key]: "deny" },
      }),
    );

    assert.equal(decision.allowed, true);
  });

  it("defaultEffect allow applies when nothing matches", () => {
    const decision = isToolAllowed(key, ctx({}), "allow");

    assert.equal(decision.allowed, true);
  });
});

describe("executeAgentTool", () => {
  const echoTool: AgentTool<{ value: string }> = {
    permissionKey: "tools.echo",
    definition: {
      type: "function",
      function: { name: "echo", parameters: {} },
    },
    handler: async ({ value }) => ({ echoed: value }),
  };

  const registry = { echo: echoTool };

  it("executes when user has explicit allow despite group deny", async () => {
    const result = await executeAgentTool(
      registry,
      "echo",
      { value: "hi" },
      ctx({
        senderPermissions: { "tools.echo": "allow" },
        isGroup: true,
        groupPermissions: { "*": "deny" },
      }),
    );

    assert.deepEqual(result, { echoed: "hi" });
  });

  it("executes when group has allow despite user deny", async () => {
    const result = await executeAgentTool(
      registry,
      "echo",
      { value: "hi" },
      ctx({
        senderPermissions: { "*": "deny" },
        isGroup: true,
        groupPermissions: { "tools.echo": "allow" },
      }),
    );

    assert.deepEqual(result, { echoed: "hi" });
  });

  it("returns permissionDenied payload when neither grants access", async () => {
    const result = await executeAgentTool(
      registry,
      "echo",
      { value: "hi" },
      ctx({ isGroup: true }),
    );

    assert.equal(result.error, true);
    assert.equal(result.permissionDenied, true);
    assert.match(String(result.message), /Permission Denied/);
  });

  it("returns not-found payload for unknown tools", async () => {
    const result = await executeAgentTool(
      registry,
      "missing",
      {},
      ctx({ senderPermissions: { "*": "allow" } }),
    );

    assert.equal(result.error, true);
    assert.equal(result.permissionDenied, undefined);
    assert.match(String(result.message), /not found in registry/);
  });

  it("handler exceptions become error payloads, not throws", async () => {
    const boom: AgentTool = {
      permissionKey: "tools.boom",
      definition: {
        type: "function",
        function: { name: "boom", parameters: {} },
      },
      handler: async () => {
        throw new Error("kaboom");
      },
    };

    const result = await executeAgentTool(
      { boom },
      "boom",
      {},
      ctx({ senderPermissions: { "*": "allow" } }),
    );

    assert.equal(result.error, true);
    assert.equal(result.message, "kaboom");
  });
});
