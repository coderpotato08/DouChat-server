/**
 * AgentLog 单元测试脚本
 * 运行: npx ts-node-dev scripts/_test_agent_log.ts
 */
import assert from "node:assert";
import AgentLog from "../src/console/agent";
import type {
  AgentSessionStartPayload,
  AgentRoundPayload,
  AgentResponsePayload,
  AgentToolStartPayload,
  AgentToolDonePayload,
  AgentSessionDonePayload,
  AgentSessionErrorPayload,
} from "../src/console/agent/type";
import { ArgTypeEnum } from "../src/console/base";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ❌ ${name}`);
    console.error(`     ${(err as Error).message}`);
  }
}

/** 从 AgentLog 实例中提取内部 consoleArgs（利用 protected 属性通过类型断言访问） */
function getArgs(log: AgentLog): Array<readonly [ArgTypeEnum, unknown]> {
  return (log as unknown as { consoleArgs: Array<readonly [ArgTypeEnum, unknown]> }).consoleArgs;
}

function argsToText(log: AgentLog): string {
  return getArgs(log)
    .map((a) => String(a[1]))
    .join(" ");
}

// ─── sessionStart ────────────────────────────────────────────

console.log("\n🔹 sessionStart");

test("基本字段全部输出", () => {
  const log = new AgentLog();
  const payload: AgentSessionStartPayload = {
    sessionId: "sess-001",
    userId: "user-abc",
    model: "gpt-4",
    message: "Hello agent",
  };
  const result = log.sessionStart(payload);
  const text = argsToText(result);
  assert.ok(text.includes("sess-001"), "应包含 sessionId");
  assert.ok(text.includes("user-abc"), "应包含 userId");
  assert.ok(text.includes("gpt-4"), "应包含 model");
  assert.ok(text.includes("Hello agent"), "应包含 message");
});

test("model 缺省时不报错", () => {
  const log = new AgentLog();
  const result = log.sessionStart({
    sessionId: "sess-002",
    userId: "user-xyz",
    message: "Hi",
  });
  const text = argsToText(result);
  assert.ok(text.includes("sess-002"), "应包含 sessionId");
  assert.ok(!text.includes("model="), "不应包含 model=");
});

test("message 为空字符串时显示 empty prompt", () => {
  const log = new AgentLog();
  const result = log.sessionStart({
    sessionId: "sess-003",
    userId: "u1",
    message: "",
  });
  const text = argsToText(result);
  assert.ok(text.includes("empty prompt"), "空消息应显示 empty prompt");
});

test("返回新的 AgentLog 实例（不可变链）", () => {
  const log = new AgentLog();
  const result = log.sessionStart({
    sessionId: "s",
    userId: "u",
    message: "m",
  });
  assert.ok(result instanceof AgentLog, "返回值应为 AgentLog");
  assert.notStrictEqual(result, log, "应返回新实例");
  assert.strictEqual(getArgs(log).length, 0, "原实例 args 不应被修改");
});

// ─── roundStart ──────────────────────────────────────────────

console.log("\n🔹 roundStart");

test("输出轮次和消息数", () => {
  const log = new AgentLog();
  const payload: AgentRoundPayload = { round: 3, messageCount: 12 };
  const text = argsToText(log.roundStart(payload));
  assert.ok(text.includes("ROUND 3"), "应包含 ROUND 3");
  assert.ok(text.includes("12"), "应包含 messageCount");
});

// ─── llmResponse ─────────────────────────────────────────────

console.log("\n🔹 llmResponse");

test("输出 finishReason 和 toolCallCount", () => {
  const log = new AgentLog();
  const payload: AgentResponsePayload = {
    round: 1,
    finishReason: "stop",
    toolCallCount: 2,
    contentPreview: "Some LLM output",
  };
  const text = argsToText(log.llmResponse(payload));
  assert.ok(text.includes("LLM 1"), "应包含轮次");
  assert.ok(text.includes("stop"), "应包含 finishReason");
  assert.ok(text.includes("2"), "应包含 toolCallCount");
  assert.ok(text.includes("Some LLM output"), "应包含 contentPreview");
});

test("finishReason 为 null 时显示 unknown", () => {
  const log = new AgentLog();
  const text = argsToText(
    log.llmResponse({ round: 1, finishReason: null, toolCallCount: 0 })
  );
  assert.ok(text.includes("unknown"), "应显示 unknown");
});

test("contentPreview 为空时显示 empty response", () => {
  const log = new AgentLog();
  const text = argsToText(
    log.llmResponse({ round: 1, finishReason: "stop", toolCallCount: 0 })
  );
  assert.ok(text.includes("empty response"), "应显示 empty response");
});

// ─── toolStart ───────────────────────────────────────────────

console.log("\n🔹 toolStart");

test("输出工具名和输入预览", () => {
  const log = new AgentLog();
  const payload: AgentToolStartPayload = {
    round: 2,
    toolName: "web_search",
    toolCallId: "tc-01",
    input: '{"query":"test"}',
  };
  const text = argsToText(log.toolStart(payload));
  assert.ok(text.includes("TOOL 2"), "应包含轮次");
  assert.ok(text.includes("web_search"), "应包含 toolName");
  assert.ok(text.includes("tc-01"), "应包含 toolCallId");
  assert.ok(text.includes("test"), "应包含 input 内容");
});

test("input 为空时显示 input=empty", () => {
  const log = new AgentLog();
  const text = argsToText(
    log.toolStart({ round: 1, toolName: "noop" })
  );
  assert.ok(text.includes("input=empty"), "应显示 input=empty");
});

// ─── toolDone ────────────────────────────────────────────────

console.log("\n🔹 toolDone");

test("成功时输出 output 预览和执行时间", () => {
  const log = new AgentLog();
  const payload: AgentToolDonePayload = {
    round: 1,
    toolName: "calc",
    success: true,
    executionTime: 150,
    output: "42",
  };
  const text = argsToText(log.toolDone(payload));
  assert.ok(text.includes("calc"), "应包含 toolName");
  assert.ok(text.includes("150ms"), "应包含执行时间");
  assert.ok(text.includes("42"), "应包含 output");
});

test("失败时输出 error 预览", () => {
  const log = new AgentLog();
  const payload: AgentToolDonePayload = {
    round: 1,
    toolName: "calc",
    success: false,
    executionTime: 10,
    error: "division by zero",
  };
  const text = argsToText(log.toolDone(payload));
  assert.ok(text.includes("division by zero"), "应包含 error 信息");
});

test("无 output 和 error 时显示 no output", () => {
  const log = new AgentLog();
  const text = argsToText(
    log.toolDone({ round: 1, toolName: "x", success: true, executionTime: 0 })
  );
  assert.ok(text.includes("no output"), "应显示 no output");
});

// ─── sessionDone ─────────────────────────────────────────────

console.log("\n🔹 sessionDone");

test("正常完成时输出轮次和 finishReason", () => {
  const log = new AgentLog();
  const payload: AgentSessionDonePayload = {
    roundsCompleted: 5,
    finishReason: "stop",
  };
  const text = argsToText(log.sessionDone(payload));
  assert.ok(text.includes("SESSION DONE"), "应包含 SESSION DONE");
  assert.ok(text.includes("5"), "应包含 roundsCompleted");
  assert.ok(text.includes("stop"), "应包含 finishReason");
});

test("达到最大轮次时提示 max rounds reached", () => {
  const log = new AgentLog();
  const text = argsToText(
    log.sessionDone({ roundsCompleted: 10, reachedMaxRounds: true })
  );
  assert.ok(text.includes("max rounds reached"), "应提示 max rounds reached");
});

test("finishReason 缺省且未达上限时显示 stop", () => {
  const log = new AgentLog();
  const text = argsToText(
    log.sessionDone({ roundsCompleted: 1 })
  );
  assert.ok(text.includes("stop"), "默认应显示 stop");
});

// ─── sessionError ────────────────────────────────────────────

console.log("\n🔹 sessionError");

test("Error 实例提取 message", () => {
  const log = new AgentLog();
  const payload: AgentSessionErrorPayload = {
    round: 2,
    error: new Error("timeout"),
  };
  const text = argsToText(log.sessionError(payload));
  assert.ok(text.includes("SESSION ERROR 2"), "应包含轮次");
  assert.ok(text.includes("timeout"), "应包含 Error.message");
});

test("字符串错误直接输出", () => {
  const log = new AgentLog();
  const text = argsToText(
    log.sessionError({ round: 1, error: "something broke" })
  );
  assert.ok(text.includes("something broke"), "应包含字符串错误");
});

test("null/undefined 错误显示 Unknown error", () => {
  const log = new AgentLog();
  const text = argsToText(log.sessionError({ round: 1, error: null }));
  assert.ok(text.includes("Unknown error"), "null 应显示 Unknown error");
});

// ─── 链式调用 ────────────────────────────────────────────────

console.log("\n🔹 链式调用");

test("支持 status + time + printLog 链式组合", () => {
  const log = new AgentLog();
  const chained = log
    .sessionStart({ sessionId: "s1", userId: "u1", message: "hi" })
    .info()
    .time("2026-01-01T00:00:00");

  const args = getArgs(chained);
  assert.ok(args.length > 0, "链式调用应产生多个 args");

  // printLog 不应抛错
  chained.printLog();
});

test("超长 message 被截断", () => {
  const log = new AgentLog();
  const longMsg = "a".repeat(200);
  const text = argsToText(
    log.sessionStart({ sessionId: "s", userId: "u", message: longMsg })
  );
  assert.ok(text.includes("..."), "超长消息应被截断并添加省略号");
  assert.ok(!text.includes("a".repeat(200)), "不应包含完整的超长消息");
});

// ─── 结果汇总 ────────────────────────────────────────────────

console.log("\n" + "─".repeat(40));
console.log(`总计: ${passed + failed} | ✅ ${passed} | ❌ ${failed}`);

if (failed > 0) {
  process.exit(1);
}
