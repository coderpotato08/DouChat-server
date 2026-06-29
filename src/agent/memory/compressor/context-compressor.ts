import { CompressStrategyFactory } from "./strategy-factory";
import { CompressSnapshotManager } from "./snapshot-manager";
import { CompressTriggerJudge } from "./trigger-judge";
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
 * ContextCompressor — 上下文压缩总调度入口（空桩）
 *
 * 串联触发判断、策略分发、原文备份、数据库更新、统计数据上报。
 * 当前为桩实现，所有核心压缩方法抛 "not implemented"。
 */
export class ContextCompressor {
  private strategyFactory: CompressStrategyFactory;
  private snapshotManager: CompressSnapshotManager;
  private triggerJudge: CompressTriggerJudge;
  private repo: MongoConversationRepo;
  private config: StoreGlobalConfig["compress"];

  constructor(config: StoreGlobalConfig["compress"], repo: MongoConversationRepo) {
    this.config = config;
    this.repo = repo;
    this.strategyFactory = new CompressStrategyFactory();
    this.snapshotManager = new CompressSnapshotManager(repo);
    this.triggerJudge = new CompressTriggerJudge(config, repo);
  }

  /**
   * 整会话批量压缩主入口（空桩）
   */
  async compressSession(
    _sessionId: string,
    _forceStrategy?: CompressStrategy,
  ): Promise<CompressResult> {
    throw new Error("ContextCompressor.compressSession is not implemented yet.");
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

  /**
   * 获取触发判定器（供 ConversationStore 使用）
   */
  getTriggerJudge(): CompressTriggerJudge {
    return this.triggerJudge;
  }
}
