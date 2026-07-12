import type { ChatMessageEntity } from "../../mongo-repo";
import { DiskPersistenceStore } from "../utils/disk-persistence-store";
import { estimateTokenCount } from "../../../utils/common-utils";
import type { IPipelineStage, StageStats } from "./types";

/** L3 占位符：工具结果已落盘，原文需从磁盘回滚 */
const PERSISTED_PLACEHOLDER = "<persisted-result>";

/**
 * ToolResultBudgetStage - L3 大结果落盘（跨消息 + 磁盘）
 *
 * 触发条件：工具结果（role=tool）总量超过阈值（toolResultBudgetTokens）。
 * 动作：从占用上下文最大的结果开始，content 替换为占位符，
 *       实际结果落盘到磁盘目录，compressMeta 记录文件路径。
 * 回滚：从磁盘文件读取还原。
 *
 * 执行顺序：管线第一级（最早执行，清理最大体积的噪音）。
 * 详见 docs/plan/conversation-store-v2/compressor-pipeline-design.md 2.1(L3)。
 */
export class ToolResultBudgetStage implements IPipelineStage {
  readonly name = "tool_result_budget";

  constructor(
    private readonly diskStore: DiskPersistenceStore,
    private readonly config: { toolResultBudgetTokens: number },
  ) {}

  async execute(
    sessionId: string,
    messages: ChatMessageEntity[],
  ): Promise<{ messages: ChatMessageEntity[]; stats: StageStats }> {
    // 1. 收集所有 tool 消息及其 token 估算
    const toolEntries: Array<{ index: number; tokens: number }> = [];
    let totalToolTokens = 0;

    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role === "tool") {
        const tokens = estimateTokenCount(messages[i].content);
        toolEntries.push({ index: i, tokens });
        totalToolTokens += tokens;
      }
    }

    // 2. 未达阈值，跳过
    if (totalToolTokens <= this.config.toolResultBudgetTokens) {
      return {
        messages,
        stats: { stageName: this.name, affectedCount: 0, tokensSaved: 0 },
      };
    }

    // 3. 按 token 数降序排列，从最大的开始落盘，直到总量降至阈值以下
    const sorted = [...toolEntries].sort((a, b) => b.tokens - a.tokens);
    let offloaded = 0;
    let tokensSaved = 0;

    for (const entry of sorted) {
      if (totalToolTokens - tokensSaved <= this.config.toolResultBudgetTokens) {
        break;
      }

      const msg = messages[entry.index];
      const toolCallId = msg.tool_call_id;
      if (!toolCallId) continue; // tool 消息必有 tool_call_id，防御性跳过

      try {
        const relPath = await this.diskStore.writeToolResult(
          sessionId,
          toolCallId,
          msg.content,
        );

        msg.content = PERSISTED_PLACEHOLDER;
        msg.isCompressed = true;
        msg.compressMeta = {
          ...msg.compressMeta,
          diskPath: relPath,
          originalToken: entry.tokens,
          compressedToken: estimateTokenCount(PERSISTED_PLACEHOLDER),
        };

        tokensSaved += entry.tokens;
        offloaded++;
      } catch {
        // 写盘失败时静默跳过该条，不阻断管线
      }
    }

    return {
      messages,
      stats: { stageName: this.name, affectedCount: offloaded, tokensSaved },
    };
  }
}