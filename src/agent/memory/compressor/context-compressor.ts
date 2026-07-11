import { CompressStrategyFactory } from "./strategy-factory";
import { CompressSnapshotManager } from "./snapshot-manager";
import type { CompressStrategy, StoreGlobalConfig } from "../constants";
import type { MongoConversationRepo, ChatMessageEntity } from "../mongo-repo";

// ==================== 类型定义 ====================

/** 压缩操作结果 */
export interface CompressResult {
  sessionId: string;
  strategy: string;
  messagesCompressed: number;
  totalTokenSaved: number;
  snapshot?: string;
}

// ==================== 压缩总调度入口 ====================

/**
 * ContextCompressor - 上下文压缩总调度入口
 *
 * 串联触发判定、策略分发、原文备份、数据库更新、统计数据上报。
 * 触发判定（shouldRunPipeline / shouldAutoCompact）内聚为私有方法，不单独成模块；
 * 管线（L3->L1->L2）与 autoCompact 尚未实现，核心压缩方法仍为桩。
 */
export class ContextCompressor {
  private strategyFactory: CompressStrategyFactory;
  private snapshotManager: CompressSnapshotManager;
  private repo: MongoConversationRepo;
  private config: StoreGlobalConfig["compress"];

  constructor(config: StoreGlobalConfig["compress"], repo: MongoConversationRepo) {
    this.config = config;
    this.repo = repo;
    this.strategyFactory = new CompressStrategyFactory();
    this.snapshotManager = new CompressSnapshotManager(repo);
  }

  /**
   * 整会话压缩主入口
   *
   * 每轮 appendMessage 后由 ConversationStore 调用，内部自判触发：
   * 1. shouldRunPipeline 未达阈值 -> 直接返回 no-op；
   * 2. 达阈值 -> 跑 L3->L1->L2 管线（未实现）；
   * 3. 管线后 shouldAutoCompact 仍超阈值 -> autoCompact（未实现，含 CircuitBreaker 熔断）。
   */
  async compressSession(
    sessionId: string,
    _forceStrategy?: CompressStrategy,
  ): Promise<CompressResult> {
    // 每轮自动触发：未达阈值则跳过
    if (!(await this.shouldRunPipeline(sessionId))) {
      return { sessionId, strategy: "none", messagesCompressed: 0, totalTokenSaved: 0 };
    }
    // TODO: L3->L1->L2 管线 + autoCompact（shouldAutoCompact + CircuitBreaker）尚未实现
    throw new Error("ContextCompressor.compressSession pipeline is not implemented yet.");
  }

  /**
   * 单条消息独立压缩（空桩）
   */
  async compressSingleMessage(_msg: ChatMessageEntity): Promise<ChatMessageEntity> {
    throw new Error("ContextCompressor.compressSingleMessage is not implemented yet.");
  }

  /**
   * 整会话压缩内容回滚原始数据（空桩）
   */
  async rollbackSession(_sessionId: string): Promise<boolean> {
    throw new Error("ContextCompressor.rollbackSession is not implemented yet.");
  }

  // ==================== 触发判定（内聚，不单独成模块）====================

  /**
   * 每轮自动触发判定：会话累计 token 超过 tokenTriggerThreshold 才跑管线
   */
  private async shouldRunPipeline(sessionId: string): Promise<boolean> {
    const totalToken = await this.repo.calcSessionTotalToken(sessionId);
    return totalToken > this.config.tokenTriggerThreshold;
  }

  /**
   * 条件触发判定：管线跑完后上下文仍超 tokenTriggerThreshold 才上 autoCompact（LLM 摘要）
   *
   * 注：在管线（L3->L1->L2）执行后调用；管线尚未实现，故当前无调用点。
   * autoCompact 实现时还需叠加 CircuitBreaker 熔断检查。
   */
  private async shouldAutoCompact(sessionId: string): Promise<boolean> {
    const totalToken = await this.repo.calcSessionTotalToken(sessionId);
    return totalToken > this.config.tokenTriggerThreshold;
  }
}
