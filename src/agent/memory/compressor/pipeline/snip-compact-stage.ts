import type { ChatMessageEntity } from "../../mongo-repo";
import { DiskPersistenceStore } from "../utils/disk-persistence-store";
import { estimateTokenCount } from "../../../utils/common-utils";
import type { IPipelineStage, StageStats } from "./types";

/**
 * SnipCompactStage - L1 对话裁剪（会话级）
 *
 * 触发条件：消息总数 > 阈值（roundThreshold，默认 50）。
 * 动作：截取中间，保留头部 N 条（初始目标）+ 尾部 M 条（当前任务）。
 * 约束：不拆开 assistant（含 tool_calls）与其后续 tool 消息。
 * 可逆：被裁剪的中间段落落入 .transcript/<sessionId>.jsonl 留档。
 *
 * 执行顺序：管线第二级（L3 落盘大结果后执行）。
 * 详见 docs/plan/conversation-store-v2/compressor-pipeline-design.md 2.1(L1)。
 */
export class SnipCompactStage implements IPipelineStage {
  readonly name = "snip_compact";

  constructor(
    private readonly diskStore: DiskPersistenceStore,
    private readonly config: {
      roundThreshold: number;
      keepHead: number;
      keepTail: number;
    },
  ) {}

  async execute(
    sessionId: string,
    messages: ChatMessageEntity[],
  ): Promise<{ messages: ChatMessageEntity[]; stats: StageStats }> {
    if (messages.length <= this.config.roundThreshold) {
      return {
        messages,
        stats: { stageName: this.name, affectedCount: 0, tokensSaved: 0 },
      };
    }

    const { keepHead, keepTail } = this.config;

    // 1. 确定头部边界（从前往后取 keepHead 条，向后扩展到不拆 assistant+tool）
    let headEnd = this.boundaryForward(messages, keepHead);

    // 2. 确定尾部边界（从后往前取 keepTail 条，向前扩展到不拆 assistant+tool）
    let tailStart = this.boundaryBackward(messages, keepTail);

    // 3. 若头尾重叠，连成一片（保留全部）
    if (headEnd >= tailStart) {
      return {
        messages,
        stats: { stageName: this.name, affectedCount: 0, tokensSaved: 0 },
      };
    }

    // 4. 裁剪中间段
    const trimmed = messages.slice(headEnd, tailStart);
    const kept = [...messages.slice(0, headEnd), ...messages.slice(tailStart)];

    // 5. 被裁剪段落写入 transcript（落盘失败不阻断管线）
    let tokensSaved = 0;
    if (trimmed.length > 0) {
      tokensSaved = trimmed.reduce(
        (sum, m) => sum + estimateTokenCount(m.content),
        0,
      );
      try {
        await this.diskStore.appendTranscript(sessionId, trimmed);
      } catch {
        // 写 transcript 失败时静默降级
      }
    }

    return {
      messages: kept,
      stats: {
        stageName: this.name,
        affectedCount: trimmed.length,
        tokensSaved,
      },
    };
  }

  // ==================== 边界安全（不拆 assistant+tool 对）====================

  /**
   * 从索引 0 向后取 count 条消息，并向后扩展以包含 assistant 关联的 tool 消息。
   * 返回的 endIndex 是头部结束位置（不包含在头部内）。
   */
  private boundaryForward(
    messages: ChatMessageEntity[],
    count: number,
  ): number {
    let end = Math.min(count, messages.length);

    // 如果最后一条头部消息是 assistant（含 tool_calls），将其后续 tool 归入头部
    while (end < messages.length) {
      const prev = messages[end - 1];
      if (
        prev?.role === "assistant" &&
        prev.tool_calls &&
        prev.tool_calls.length > 0
      ) {
        // 将所有紧接着的 tool 消息归入头部
        while (end < messages.length && messages[end].role === "tool") {
          end++;
        }
      }
      break;
    }

    return end;
  }

  /**
   * 从末尾向前取 count 条消息，并向前扩展以保证不拆开 assistant 与其 tool。
   * 返回的 startIndex 是尾部起始位置（包含在尾部内）。
   */
  private boundaryBackward(
    messages: ChatMessageEntity[],
    count: number,
  ): number {
    const clamped = Math.min(count, messages.length);
    let start = messages.length - clamped;

    // 如果尾部第一条是 tool 消息，向前找到其 assistant（含 tool_calls）
    while (start > 0 && messages[start].role === "tool") {
      start--;
    }

    // 再向前检查：如果 start-1 是 assistant（含 tool_calls），也归入尾部
    if (start > 0) {
      const prev = messages[start - 1];
      if (
        prev?.role === "assistant" &&
        prev.tool_calls &&
        prev.tool_calls.length > 0
      ) {
        start--;
      }
    }

    return start;
  }
}