import assert from "node:assert/strict";
import test from "node:test";
import z from "zod";
import { createAgentContext } from "./agent-context";
import { HookManager } from "./hook-manager";
import type { RegisteredTool } from "./tool-manager";
import { ToolManager } from "./tool-manager";

const CONTEXT = createAgentContext({
  requestId: "request_test",
  sessionId: "session_test",
  userId: "user_test",
  modelProvider: "DOUBAO",
});

test("ToolManager validates parameters and forwards AgentContext to tools", async () => {
  const manager = new ToolManager(new HookManager());
  let receivedSessionId: string | undefined;
  const contextTool: RegisteredTool = {
    name: "context_test",
    description: "Test tool context forwarding.",
    parameters: { value: z.string().min(1) },
    execute: async (input, context): Promise<{ value: string; sessionId: string }> => {
      receivedSessionId = context.sessionId;
      return { value: input.value, sessionId: context.sessionId };
    },
  };
  manager.registerTool(contextTool);

  const success = await manager.executeToolHandler(
    CONTEXT,
    "call_success",
    "context_test",
    JSON.stringify({ value: "ok" }),
  );
  assert.equal(success.success, true);
  assert.equal(receivedSessionId, CONTEXT.sessionId);
  assert.deepEqual(success.output, { value: "ok", sessionId: CONTEXT.sessionId });

  const invalid = await manager.executeToolHandler(
    CONTEXT,
    "call_invalid",
    "context_test",
    JSON.stringify({ value: "" }),
  );
  assert.equal(invalid.success, false);
  assert.match(invalid.error ?? "", /工具执行失败/);
});
