import { CompressStrategyFactory } from "./strategy-factory";
import { CompressSnapshotManager } from "./snapshot-manager";
import { CompressionPipeline } from "./pipeline/compression-pipeline";
import { ToolResultBudgetStage } from "./pipeline/tool-result-budget-stage";
import { SnipCompactStage } from "./pipeline/snip-compact-stage";
import { MicroCompactStage } from "./pipeline/micro-compact-stage";
import { DiskPersistenceStore } from "./utils/disk-persistence-store";
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
 * 串联触发判定、管线执行（L3->L1->L2）、DB 持久化、autoCompact（未实现）。
 * 触发判定（shouldRunPipeline / shouldAutoCompact）内聚为私有方法；
 * 每轮管线（L3 ToolResultBudget -> L1 SnipCompact -> L2 MicroCompact）已实现。
 */
export class ContextCompressor {
  private strategyFactory: CompressStrategyFactory;
  private snapshotManager: CompressSnapshotManager;
  private pipeline: CompressionPipeline;
  private repo: MongoConversationRepo;
  private config: StoreGlobalConfig["compress"];

  constructor(config: StoreGlobalConfig["compress"], repo: MongoConversationRepo) {
    this.config = config;
    this.repo = repo;
    this.strategyFactory = new CompressStrategyFactory();
    this.snapshotManager = new CompressSnapshotManager(repo);

    // 构造底层依赖
    const diskStore = new DiskPersistenceStore(config.diskRootDir);

    // 构造管线三个阶段（执行顺序 L3->L1->L2）
    const l3 = new ToolResultBudgetStage(diskStore, config.pipeline.l3);
    const l1 = new SnipCompactStage(diskStore, config.pipeline.l1);
    const l2 = new MicroCompactStage(config.pipeline.l2);

    this.pipeline = new CompressionPipeline([l3, l1, l2]);
  }

  /**
   * 整会话压缩主入口
   *
   * 每轮 appendMessage 后由 ConversationStore 调用，内部自判触发：
   * 1. shouldRunPipeline 未达阈值 -> 直接返回 no-op；
   * 2. 达阈值 -> 跑 L3->L1->L2 管线；
   * 3. 管线后 shouldAutoCompact 仍超阈值 -> autoCompact（未实现，含 CircuitBreaker 熔断）。
   */
  async compressSession(
    sessionId: string,
    _forceStrategy?: CompressStrategy,
  ): Promise<CompressResult> {
    // 1. 每轮自动触发：未达阈值则跳过
    if (!(await this.shouldRunPipeline(sessionId))) {
      return { sessionId, strategy: "none", messagesCompressed: 0, totalTokenSaved: 0 };
    }

    // 2. 获取会话全量消息
    const messages = await this.repo.getSessionAllMessages(sessionId);

    // 3. 跑管线（L3->L1->L2）
    const { allStats } = await this.pipeline.run(sessionId, messages);

    // 4. 持久化 L2 / L3 修改的消息到 DB
    for (const msg of messages) {
      if (msg.isCompressed) {
        try {
          await this.repo.updateCompressedMessage(msg.messageId, {
            content: msg.content,
            isCompressed: msg.isCompressed,
            originalContent: msg.originalContent,
            compressMeta: msg.compressMeta,
            compressedVersion: msg.compressedVersion,
          });
        } catch {
          // 单条落库失败不阻断管线
        }
      }
    }

    const totalSaved = allStats.reduce((sum, s) => sum + s.tokensSaved, 0);
    const totalAffected = allStats.reduce((sum, s) => sum + s.affectedCount, 0);
    const strategy = allStats
      .filter((s) => s.affectedCount > 0)
      .map((s) => s.stageName)
      .join(",") || "none";

    // TODO: 5. 管线后 shouldAutoCompact 仍超阈值 -> autoCompact（LLM 摘要，含 CircuitBreaker 熔断）

    return {
      sessionId,
      strategy,
      messagesCompressed: totalAffected,
      totalTokenSaved: totalSaved,
    };
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
   * 注：在管线（L3->L1->L2）执行后调用；autoCompact 实现时需叠加 CircuitBreaker 熔断检查。
   */
  private async shouldAutoCompact(sessionId: string): Promise<boolean> {
    const totalToken = await this.repo.calcSessionTotalToken(sessionId);
    return totalToken > this.config.tokenTriggerThreshold;
  }
}