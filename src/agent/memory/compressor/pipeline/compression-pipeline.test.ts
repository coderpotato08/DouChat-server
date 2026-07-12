import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { CompressionPipeline } from "./compression-pipeline";
import { ToolResultBudgetStage } from "./tool-result-budget-stage";
import { SnipCompactStage } from "./snip-compact-stage";
import { MicroCompactStage } from "./micro-compact-stage";
import { DiskPersistenceStore } from "../utils/disk-persistence-store";
import type { ChatMessageEntity } from "../../mongo-repo";

const SESSION_ID = "pipeline_demo_session";
const OUTPUT_ROOT = join(process.cwd(), "data", ".douchat-compress-test");
const SUMMARY_FILE = join(OUTPUT_ROOT, SESSION_ID, "pipeline-summary.json");

type DemoMessageInput = {
  role: ChatMessageEntity["role"];
  content: string | null;
  toolCallId?: string;
  requestId?: string;
};

function createDemoMessage(input: DemoMessageInput, index: number): ChatMessageEntity {
  return {
    messageId: `msg_${String(index).padStart(2, "0")}`,
    sessionId: SESSION_ID,
    requestId: input.requestId ?? `req_${Math.floor(index / 4)}`,
    role: input.role,
    content: input.content,
    tool_call_id: input.toolCallId ?? null,
    sortIndex: index,
    isCompressed: false,
    originalContent: null,
    compressedVersion: null,
    compressMeta: null,
    mergedRoundIds: [],
  } as ChatMessageEntity;
}

function createDemoMessages(): ChatMessageEntity[] {
  const inputs: DemoMessageInput[] = [
    { role: "system", content: "You are a helpful coding agent.", requestId: "system" },
    { role: "user", content: "请读取长文件并分析。", requestId: "req_1" },
    { role: "assistant", content: null, requestId: "req_1" },
    { role: "tool", content: "A".repeat(2200), toolCallId: "call_1", requestId: "req_1" },
    { role: "assistant", content: "已读取文件，下面开始分析。", requestId: "req_1" },
    { role: "user", content: "继续补充第二个文件。", requestId: "req_2" },
    { role: "assistant", content: null, requestId: "req_2" },
    { role: "tool", content: "B".repeat(1200), toolCallId: "call_2", requestId: "req_2" },
    { role: "assistant", content: "第二个文件也读完了。", requestId: "req_2" },
    { role: "user", content: "列一下目录。", requestId: "req_3" },
    { role: "assistant", content: null, requestId: "req_3" },
    { role: "tool", content: "C".repeat(700), toolCallId: "call_3", requestId: "req_3" },
    { role: "assistant", content: "目录如下。", requestId: "req_3" },
    { role: "user", content: "再查一下 package.json。", requestId: "req_4" },
    { role: "assistant", content: null, requestId: "req_4" },
    { role: "tool", content: "D".repeat(400), toolCallId: "call_4", requestId: "req_4" },
    { role: "assistant", content: "package.json 已分析。", requestId: "req_4" },
    { role: "user", content: "最后总结一下。", requestId: "req_5" },
    { role: "assistant", content: null, requestId: "req_5" },
    { role: "tool", content: "E".repeat(260), toolCallId: "call_5", requestId: "req_5" },
    { role: "assistant", content: "这是最终总结。", requestId: "req_5" },
  ];

  return inputs.map(createDemoMessage);
}

function cloneMessages(messages: ChatMessageEntity[]): ChatMessageEntity[] {
  return messages.map((msg) => ({
    ...msg,
    compressMeta: msg.compressMeta ? { ...msg.compressMeta } : null,
  }));
}

function previewContent(content: string | null): string {
  if (content === null) return "<null>";
  if (content.length <= 48) return content;
  return `${content.slice(0, 18)}...(${content.length} chars)`;
}

function printMessages(title: string, messages: ChatMessageEntity[]): void {
  console.log(`\n========== ${title} (${messages.length} messages) ==========`);
  for (const msg of messages) {
    const compressed = msg.isCompressed ? " compressed" : "";
    const diskPath = msg.compressMeta?.diskPath ? ` disk=${msg.compressMeta.diskPath}` : "";
    const original = msg.originalContent ? ` original=${msg.originalContent.length} chars` : "";
    console.log(
      `${String(msg.sortIndex).padStart(2, "0")} ${msg.role.padEnd(9)}${compressed}${diskPath}${original} :: ${previewContent(msg.content)}`,
    );
  }
}

function toInspectableMessage(msg: ChatMessageEntity): Record<string, unknown> {
  return {
    sortIndex: msg.sortIndex,
    messageId: msg.messageId,
    requestId: msg.requestId,
    role: msg.role,
    tool_call_id: msg.tool_call_id,
    content: msg.content,
    isCompressed: msg.isCompressed,
    originalContentLength: msg.originalContent?.length ?? 0,
    compressMeta: msg.compressMeta,
  };
}

test("compression pipeline demo: L3 -> L1 -> L2", async () => {
  const before = createDemoMessages();

  // 每次运行先清理上一次产物，然后把本次结果保留在 data/.douchat-compress-test 供人工查看。
  await rm(OUTPUT_ROOT, { recursive: true, force: true });

  const diskStore = new DiskPersistenceStore(OUTPUT_ROOT);
  const pipeline = new CompressionPipeline([
    new ToolResultBudgetStage(diskStore, { toolResultBudgetTokens: 400 }),
    new SnipCompactStage(diskStore, { roundThreshold: 12, keepHead: 4, keepTail: 10 }),
    new MicroCompactStage({ keepRecentToolResults: 1 }),
  ]);

  printMessages("Before", before);

  const result = await pipeline.run(SESSION_ID, cloneMessages(before));

  printMessages("After", result.messages);
  console.log("\n========== Stage Stats ==========");
  console.table(result.allStats);

  const persisted = result.messages.filter((msg) => msg.content === "<persisted-result>");
  const archived = result.messages.filter((msg) => msg.content === "<tool-result-archived>");
  const affectedCount = result.allStats.reduce((sum, stat) => sum + stat.affectedCount, 0);
  const tokensSaved = result.allStats.reduce((sum, stat) => sum + stat.tokensSaved, 0);
  const transcript = await diskStore.readTranscript(SESSION_ID);

  const summary = {
    outputRoot: OUTPUT_ROOT,
    beforeCount: before.length,
    afterCount: result.messages.length,
    persistedToolResults: persisted.length,
    archivedToolResults: archived.length,
    transcriptEntries: transcript.length,
    affectedCount,
    estimatedTokensSaved: tokensSaved,
    stageStats: result.allStats,
    before: before.map(toInspectableMessage),
    after: result.messages.map(toInspectableMessage),
  };

  await writeFile(SUMMARY_FILE, JSON.stringify(summary, null, 2), "utf-8");

  console.log("\n========== Summary ==========");
  console.log(`outputRoot: ${OUTPUT_ROOT}`);
  console.log(`summaryFile: ${SUMMARY_FILE}`);
  console.log(`toolResultsDir: ${join(OUTPUT_ROOT, SESSION_ID, "tool-results")}`);
  console.log(`transcriptFile: ${join(OUTPUT_ROOT, SESSION_ID, ".transcript", "messages.jsonl")}`);
  console.log(`before messages: ${before.length}`);
  console.log(`after messages: ${result.messages.length}`);
  console.log(`persisted tool results (L3): ${persisted.length}`);
  console.log(`archived tool results (L2): ${archived.length}`);
  console.log(`transcript entries (L1): ${transcript.length}`);
  console.log(`affectedCount: ${affectedCount}`);
  console.log(`estimated tokens saved: ${tokensSaved}`);

  assert.equal(result.allStats.length, 3);
  assert.ok(result.allStats[0].affectedCount > 0, "L3 should persist at least one tool result");
  assert.ok(result.allStats[1].affectedCount > 0, "L1 should trim middle messages");
  assert.ok(result.allStats[2].affectedCount > 0, "L2 should archive old non-persisted tool results");
  assert.ok(persisted.every((msg) => msg.compressMeta?.diskPath));
  assert.ok(archived.every((msg) => msg.originalContent));
  assert.ok(transcript.length > 0);
  assert.ok(tokensSaved > 0);
});
