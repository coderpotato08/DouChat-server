import type { ChatMessageEntity } from "../../mongo-repo";
import { estimateTokenCount } from "../../../utils/common-utils";
import type { IPipelineStage, StageStats } from "./types";

/** L2 占位符：旧工具结果已被替换为占位符，原文保留在 DB originalContent */
const ARCHIVED_PLACEHOLDER = "<tool-result-archived>";

/**
 * MicroCompactStage - L2 旧工具结果占位（跨消息）
 *
 * 触发条件：历史工具结果（role=tool）条数超过保留数（keepRecentToolResults）。
 * 动作：只保留最近 N 条工具调用记录，更早的 tool 结果 content 替换为占位符。
 * 与 L3 区别：结果不落盘，原文保留在 DB originalContent 字段（回滚从 DB 取）。
 *
 * 执行顺序：管线第三级（L1 裁剪后执行，对保留段中的旧工具结果做占位）。
 * 详见 docs/plan/conversation-store-v2/compressor-pipeline-design.md 2.1(L2)。
 */
export class MicroCompactStage implements IPipelineStage {
  readonly name = "micro_compact";

  constructor(
    private readonly config: { keepRecentToolResults: number },
  ) {}

  async execute(
    _sessionId: string,
    messages: ChatMessageEntity[],
  ): Promise<{ messages: ChatMessageEntity[]; stats: StageStats }> {
    // 1. 收集所有 tool 消息索引
    const toolIndices: number[] = [];
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role === "tool") {
        toolIndices.push(i);
      }
    }

    // 2. 未超阈值，跳过
    if (toolIndices.length <= this.config.keepRecentToolResults) {
      return {
        messages,
        stats: { stageName: this.name, affectedCount: 0, tokensSaved: 0 },
      };
    }

    // 3. 保留最近 N 条，更早的替换为占位符
    const keepCount = this.config.keepRecentToolResults;
    const toArchive = toolIndices.slice(0, toolIndices.length - keepCount);

    let tokensSaved = 0;
    for (const idx of toArchive) {
      const msg = messages[idx];
      const originalToken = estimateTokenCount(msg.content);
      const placeholderToken = estimateTokenCount(ARCHIVED_PLACEHOLDER);

      // 已压缩过的消息（如 L3 已落盘）不再重复占位
      if (msg.isCompressed) continue;

      msg.originalContent = msg.content as string;
      msg.content = ARCHIVED_PLACEHOLDER;
      msg.isCompressed = true;
      msg.compressMeta = {
        ...msg.compressMeta,
        originalToken,
        compressedToken: placeholderToken,
      };
      tokensSaved += originalToken - placeholderToken;
    }

    return {
      messages,
      stats: {
        stageName: this.name,
        affectedCount: toArchive.length,
        tokensSaved: Math.max(0, tokensSaved),
      },
    };
  }
}