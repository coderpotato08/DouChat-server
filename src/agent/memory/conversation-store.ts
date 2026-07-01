import { MongoConversationRepo } from "./mongo-repo";
import type { ChatMessageEntity } from "./mongo-repo";
import { ContextCompressor } from "./compressor/context-compressor";
import type { CompressResult } from "./compressor/context-compressor";
import { MessageValidator } from "./message-validator";
import { ContextTruncator } from "./context-truncator";
import { IdGenerator } from "./id-generator";
import {
  type StoreGlobalConfig,
  DEFAULT_STORE_CONFIG,
  CompressStrategy,
} from "./constants";
import {
  formatToLLMMessage,
  batchFormatToLLMContext,
} from "./formatters/llm-formatter";
import type { RawLLMMessage } from "./formatters/llm-formatter";
import {
  formatToFrontendMessage,
  buildFrontendChatRound,
  buildFrontendSessionData,
} from "./formatters/frontend-formatter";
import type { FrontendBaseMsg, FrontendChatRound } from "./formatters/frontend-formatter";
import { MessageRole } from "./constants";
import { SystemLogger } from "../../console";

// ==================== 类型定义 ====================

/**
 * appendMessage 入参：排除由 Store 自动管理的字段
 * - messageId: 由 IdGenerator 自动生成
 * - sortIndex: 由 Store 自动递增
 * - 压缩扩展字段: 初始写入时为空/未压缩状态
 */
export type AppendMessageInput = Omit<
  ChatMessageEntity,
  | "messageId"
  | "sortIndex"
  | "isCompressed"
  | "originalContent"
  | "compressedVersion"
  | "compressMeta"
  | "mergedRoundIds"
>;

/** 会话压缩统计信息 */
export interface SessionCompressStats {
  sessionId: string;
  totalMessages: number;
  compressedMessages: number;
  totalTokenSaved: number;
  lastCompressTime?: Date;
  snapshots: number;
}

// ==================== 单例管理 ====================

let instance: ConversationStore | null = null;

/**
 * 初始化 ConversationStore 单例
 * 重复调用安全：已初始化时直接返回已有实例
 */
export function initConversationStore(
  config?: Partial<StoreGlobalConfig>,
): ConversationStore {
  if (!instance) {
    instance = new ConversationStore(config);
  }
  return instance;
}

/**
 * 获取 ConversationStore 单例
 * 未初始化时抛出异常
 */
export function getConversationStore(): ConversationStore {
  if (!instance) {
    throw new Error(
      "ConversationStore has not been initialized. Call initConversationStore() first.",
    );
  }
  return instance;
}

// ==================== 主门面类 ====================

/**
 * ConversationStore — 上下文会话管理器（对外唯一 API）
 *
 * 搭载可插拔上下文压缩能力，遵循开闭原则、向下兼容、故障降级。
 */
export class ConversationStore {
  private repo: MongoConversationRepo;
  private compressor: ContextCompressor;
  private config: StoreGlobalConfig;

  constructor(customConfig?: Partial<StoreGlobalConfig>) {
    this.config = { ...DEFAULT_STORE_CONFIG, ...customConfig };
    // 深度合并 compress 配置
    if (customConfig?.compress) {
      this.config.compress = {
        ...DEFAULT_STORE_CONFIG.compress,
        ...customConfig.compress,
      };
    }
    this.repo = new MongoConversationRepo();
    this.compressor = new ContextCompressor(this.config.compress, this.repo);
  }

  // ==================== 消息写入 ====================

  /**
   * 新增单条会话消息
   *
   * 自动补全 messageId（UUIDv7）、sortIndex（自增），
   * 校验消息合法性，入库后触发压缩检测，返回三种格式的消息表示。
   *
   * @param rawPlainMsg 原始消息数据（不含 Store 管理字段）
   * @param sessionId 会话 ID
   * @param requestId 当前轮次请求 ID
   */
  async appendMessage(
    rawPlainMsg: AppendMessageInput,
    sessionId: string,
    requestId: string,
  ): Promise<{
    dbEntity: ChatMessageEntity;
    llmItem: RawLLMMessage;
    frontendItem: FrontendBaseMsg;
  }> {
    // 1. 校验消息合法性
    MessageValidator.validate(rawPlainMsg, this.config.maxRawMessageLength);

    // 2. 组装完整实体（messageId 和 sortIndex 由 repo 自动生成）
    const dbEntity = await this.repo.insertSingleMessage({
      ...rawPlainMsg,
      sessionId,
      requestId,
      // 压缩字段初始为空
      isCompressed: false,
      originalContent: null,
      compressedVersion: null,
      compressMeta: null,
      mergedRoundIds: [],
    } as Omit<ChatMessageEntity, "messageId" | "sortIndex">);

    // 3. 触发压缩检测（桩实现，当前为 no-op）
    if (this.config.compress.enableAutoCompress) {
      const { should } = await this.compressor
        .getTriggerJudge()
        .shouldCompress(sessionId);
      if (should) {
        // 压缩模块未实现，此路径当前不可达
        try {
          await this.compressor.compressSession(sessionId);
        } catch {
          // 压缩异常时静默降级，不影响消息写入
        }
      }
    }

    // 4. 格式化返回
    const llmItem = formatToLLMMessage(dbEntity, false);
    const frontendItem = formatToFrontendMessage(dbEntity);

    // 日志：消息写入
    SystemLogger.agent()
      .storeAppendMessage({
        sessionId,
        requestId,
        messageId: dbEntity.messageId,
        role: dbEntity.role,
        sortIndex: dbEntity.sortIndex,
        contentPreview: (dbEntity.content ?? "").slice(0, 100),
        hasToolCalls: !!(dbEntity.tool_calls && dbEntity.tool_calls.length > 0),
        toolCallId: dbEntity.tool_call_id,
      })
      .printLog();

    return { dbEntity, llmItem, frontendItem };
  }

  // ==================== 上下文读取 ====================

  /**
   * 获取 LLM 可用上下文
   *
   * 从数据库拉取会话全量消息，可选 Token 上限截断，
   * 支持压缩内容 / 原始内容切换读取。
   *
   * @param sessionId 会话 ID
   * @param maxToken 可选 Token 上限，超限时触发兜底截断
   * @param useCompressed 是否使用压缩后内容，默认 true
   */
  async getLLMContext(
    sessionId: string,
    maxToken?: number,
    useCompressed: boolean = true,
  ): Promise<RawLLMMessage[]> {
    const allMsgs = await this.repo.getSessionAllMessages(sessionId);
    const beforeCount = allMsgs.length;

    let finalMsgs = allMsgs;

    // 兜底截断
    if (maxToken) {
      finalMsgs = ContextTruncator.truncate(
        allMsgs,
        maxToken,
        this.config.compress.reserveLatestRounds,
      );
    }

    // 格式化
    const context = batchFormatToLLMContext(finalMsgs, useCompressed);

    // 日志：LLM 上下文构建
    const systemCount = finalMsgs.filter((m) => m.role === MessageRole.SYSTEM).length;
    const chatCount = finalMsgs.length - systemCount;
    const compressedCount = finalMsgs.filter((m) => m.isCompressed).length;

    // 估算 Token（简易启发式）
    const estimatedTokens = finalMsgs.reduce(
      (sum, m) => sum + Math.ceil((m.content ?? "").length / 4),
      0,
    );

    SystemLogger.agent()
      .storeLLMContext({
        sessionId,
        totalMessages: allMsgs.length,
        useCompressed,
        maxToken,
        truncated: finalMsgs.length < beforeCount,
        beforeTruncate: beforeCount,
        afterTruncate: finalMsgs.length,
        estimatedTokens,
        systemCount,
        chatCount,
        compressedCount,
      })
      .printLog();

    // 原生 console.log 输出暴露给 LLM 的完整消息内容
    console.log(
      `\n========== LLM Context [session=${sessionId}] — ${context.length} messages ==========`,
    );
    console.log(JSON.stringify(context, null, 2));
    console.log(
      `========== LLM Context End [session=${sessionId}] ==========\n`,
    );

    return context;
  }

  /**
   * 获取前端全会话结构化渲染数据
   *
   * 按 requestId 分组轮次，解析工具调用链，返回可直接渲染的结构。
   */
  async getFrontendSessionData(sessionId: string): Promise<FrontendChatRound[]> {
    const allMsgs = await this.repo.getSessionAllMessages(sessionId);
    const rounds = buildFrontendSessionData(allMsgs);

    // 日志：前端数据构建
    const compressedCount = allMsgs.filter((m) => m.isCompressed).length;
    SystemLogger.agent()
      .storeFrontendData({
        sessionId,
        totalMessages: allMsgs.length,
        totalRounds: rounds.length,
        compressedCount,
      })
      .printLog();

    return rounds;
  }

  /**
   * 获取单轮完整交互链路
   *
   * 用于调试、工具重试等场景，返回单轮 requestId 对应的完整消息链。
   */
  async getSingleRoundChat(
    sessionId: string,
    requestId: string,
  ): Promise<FrontendChatRound> {
    const roundMsgs = await this.repo.getSingleRoundMessages(
      sessionId,
      requestId,
    );
    const round = buildFrontendChatRound(roundMsgs, requestId, sessionId);

    // 日志：单轮查询
    const hasToolChain = roundMsgs.some(
      (m) => m.role === MessageRole.TOOL || (m.tool_calls && m.tool_calls.length > 0),
    );
    SystemLogger.agent()
      .storeSingleRound({
        sessionId,
        requestId,
        messageCount: roundMsgs.length,
        hasToolChain,
      })
      .printLog();

    return round;
  }

  // ==================== 压缩操作 ====================

  /**
   * 触发会话压缩（桩实现）
   *
   * @param sessionId 会话 ID
   * @param strategy 可选强制压缩策略，不传则使用默认策略
   */
  async triggerSessionCompress(
    sessionId: string,
    strategy?: CompressStrategy,
  ): Promise<CompressResult> {
    return this.compressor.compressSession(sessionId, strategy);
  }

  /**
   * 回滚会话压缩（桩实现）
   *
   * 将会话压缩内容恢复为原始数据
   */
  async rollbackSession(sessionId: string): Promise<boolean> {
    return this.compressor.rollbackSession(sessionId);
  }

  /**
   * 获取会话压缩统计信息
   */
  async getSessionCompressStats(sessionId: string): Promise<SessionCompressStats> {
    const [totalMessages, compressedMessages, totalToken, snapshots] =
      await Promise.all([
        this.repo.countMessages(sessionId),
        this.repo.countCompressedMessages(sessionId),
        this.repo.calcSessionTotalToken(sessionId),
        this.repo.getSessionSnapshots(sessionId),
      ]);

    const totalTokenSaved = snapshots.reduce(
      (sum, s) => sum + s.totalSaveToken,
      0,
    );
    const lastCompressTime =
      snapshots.length > 0 ? snapshots[0].createTime : undefined;

    // 日志：压缩统计
    SystemLogger.agent()
      .storeCompressStats({
        sessionId,
        totalMessages,
        compressedMessages,
        totalTokenSaved,
        snapshotCount: snapshots.length,
      })
      .printLog();

    return {
      sessionId,
      totalMessages,
      compressedMessages,
      totalTokenSaved,
      lastCompressTime,
      snapshots: snapshots.length,
    };
  }

  // ==================== 会话生命周期 ====================

  /**
   * 清空会话全部消息
   */
  async clearSession(sessionId: string): Promise<boolean> {
    return this.repo.clearSession(sessionId);
  }

  // ==================== 配置管理 ====================

  /**
   * 动态更新压缩运行时配置
   *
   * 支持运行时热更新，无需重启服务
   */
  updateCompressConfig(
    partialConfig: Partial<StoreGlobalConfig["compress"]>,
  ): void {
    this.config.compress = { ...this.config.compress, ...partialConfig };
  }
}
