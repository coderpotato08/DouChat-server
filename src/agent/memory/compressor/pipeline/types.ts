import type { ChatMessageEntity } from "../../mongo-repo";

/**
 * 单阶段执行统计
 */
export interface StageStats {
  /** 阶段名称 */
  stageName: string;
  /** 受影响的消息条数 */
  affectedCount: number;
  /** 估算节省的 token 数 */
  tokensSaved: number;
}

/**
 * IPipelineStage - 管线阶段统一接口
 *
 * 会话级压缩阶段：接收全量消息，返回压缩后消息 + 统计信息。
 * 取代单消息级 ICompressStrategy 为管线主抽象。
 *
 * 各阶段按顺序串联，前一阶段的输出作为后一阶段的输入。
 * 执行顺序：L3（大结果落盘）-> L1（对话裁剪）-> L2（旧工具结果占位）。
 */
export interface IPipelineStage {
  /** 阶段名称（用于统计与日志） */
  readonly name: string;

  /**
   * 执行本阶段压缩
   * @param sessionId 会话 ID
   * @param messages 当前消息列表（可能已被前置阶段修改）
   * @returns 压缩后的消息列表 + 阶段统计
   */
  execute(
    sessionId: string,
    messages: ChatMessageEntity[],
  ): Promise<{ messages: ChatMessageEntity[]; stats: StageStats }>;
}