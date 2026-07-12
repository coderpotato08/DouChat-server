import type { ChatMessageEntity } from "../../mongo-repo";
import type { IPipelineStage, StageStats } from "./types";

/**
 * CompressionPipeline - 每轮自动压缩管线编排器
 *
 * 按构造时传入的顺序依次执行各 stage，前一阶段的输出（messages）作为后一阶段的输入。
 * 执行顺序：L3（大结果落盘）-> L1（对话裁剪）-> L2（旧工具结果占位）。
 *
 * 每层内部按自身阈值决定是否动作，无需编排器介入。
 * 详见 docs/plan/conversation-store-v2/compressor-pipeline-design.md 第五章。
 */
export class CompressionPipeline {
  private stages: ReadonlyArray<IPipelineStage>;

  constructor(stages: ReadonlyArray<IPipelineStage>) {
    this.stages = stages;
  }

  /**
   * 串联执行全部阶段，返回最终消息列表与各阶段统计。
   */
  async run(
    sessionId: string,
    messages: ChatMessageEntity[],
  ): Promise<{ messages: ChatMessageEntity[]; allStats: StageStats[] }> {
    let current = messages;
    const allStats: StageStats[] = [];

    for (const stage of this.stages) {
      const result = await stage.execute(sessionId, current);
      current = result.messages;
      allStats.push(result.stats);
    }

    return { messages: current, allStats };
  }
}