import OpenAI from "openai";
import {
  AiMessageContentType,
  AiMessageRole,
  AiMessageSenderType,
  AiMessageStatus,
  AiSessionMessageDocument,
} from "../../models/aiSessionMessageModel";
import { SYSTEM_PROMPT } from "../types/agent";
import {
  AppendConversationMessageInput,
  BuildContextOptions,
  ConversationContextMessageRecord,
  ConversationContextSegment,
  ConversationContextState,
  ConversationMessageContent,
  ConversationMessageParam,
  ConversationMessageRecord,
  ConversationMessageSeed,
  ConversationSnapshot,
  ConversationStoreOptions,
  ConversationSummaryBlock,
} from "./type";

const DEFAULT_MAX_CONTEXT_MESSAGES = 12;

/**
 * ConversationStore 接入方式：
 * 1. 在单个会话开始时由上层创建一个 ConversationStore 实例，并传入 sessionId、ownerUserId、systemPrompt 或 initialMessages。
 * 2. 如果会话需要从数据库或缓存恢复，先调用 hydrate 恢复完整消息时间线，再继续处理新消息。
 * 3. 每次收到用户输入、assistant 输出或 tool 结果时，统一通过 appendMessage / appendUserMessage / appendAssistantMessage / appendToolMessage 写入 messageTimeline。
 * 4. 在调用大模型前，通过 getContextMessages 或 buildContextSnapshot 获取派生上下文；其中 buildContextSnapshot 适合调试和观测上下文分段结果。
 * 5. 当前模块只负责单会话内存态管理；如果后续要支持多会话并发，建议在外层增加 ConversationStoreManager，按 sessionId 缓存和复用实例。
 * 6. 当前模块尚未直接接入持久化层；后续可在上层基于 buildSnapshot、getFullMessages 和 dirty / lastPersistedSeq 做增量落库。
 */
export class ConversationStore {
  /** 固定注入到模型上下文头部的系统提示。 */
  private readonly systemPrompt: string;

  /** 默认上下文窗口大小，未显式指定时用于截取最近消息。 */
  private readonly defaultMaxContextMessages: number;

  /** 当前会话 ID，后续接持久化和多会话管理时作为主键。 */
  private sessionId?: AiSessionMessageDocument["sessionId"];

  /** 当前会话所属用户 ID，用于隔离不同用户的会话状态。 */
  private ownerUserId?: AiSessionMessageDocument["ownerUserId"];

  /** 下一条消息要分配的顺序号，保证时间线内顺序稳定。 */
  private nextSeq: number;

  /** 标记当前内存态是否存在尚未持久化或同步的变更。 */
  private dirty: boolean;

  /** 最近一次完成持久化的消息序号，为后续增量落库预留。 */
  private lastPersistedSeq: number;

  /** 完整消息时间线，是整个模块唯一的可写事实源。 */
  private messageTimeline: ConversationMessageRecord[];

  /** 专供模型调用的派生上下文状态，不直接作为写入源修改。 */
  private contextState: ConversationContextState;

  /**
   * 创建一个单会话的上下文存储实例。
   * @param options 初始化选项，可注入会话标识、系统提示和初始消息。
   */
  public constructor(options: ConversationStoreOptions = {}) {
    this.systemPrompt = options.systemPrompt ?? SYSTEM_PROMPT;
    this.defaultMaxContextMessages = Math.max(1, options.maxContextMessages ?? DEFAULT_MAX_CONTEXT_MESSAGES);
    this.sessionId = options.sessionId;
    this.ownerUserId = options.ownerUserId;
    this.nextSeq = 1;
    this.dirty = false;
    this.lastPersistedSeq = 0;
    this.messageTimeline = [];
    this.contextState = this.createEmptyContextState();

    if (options.initialMessages?.length) {
      this.hydrate(options.initialMessages);
    }
  }

  /**
   * 用外部消息快照重建当前会话状态。
   * @param messages 已存在的会话消息列表，通常来自持久化层或缓存恢复。
   * @returns 重建后的完整会话快照。
   */
  public hydrate(messages: ConversationMessageSeed[]): ConversationSnapshot {
    this.messageTimeline = [];
    this.nextSeq = 1;
    this.dirty = false;
    this.lastPersistedSeq = 0;

    for (const message of messages) {
      const record = this.createMessageRecord(message, true);
      this.messageTimeline.push(record);
      this.nextSeq = Math.max(this.nextSeq, record.seq + 1);
      this.lastPersistedSeq = Math.max(this.lastPersistedSeq, record.seq);
    }

    this.rebuildContextState();
    return this.buildSnapshot();
  }

  /**
   * 追加一条通用消息到完整时间线，并同步刷新派生上下文状态。
   * @param input 消息主体和元信息。
   * @returns 追加后的标准化消息记录。
   */
  public appendMessage(input: AppendConversationMessageInput): ConversationMessageRecord {
    const record = this.createMessageRecord(input, false);
    this.messageTimeline.push(record);
    this.nextSeq = record.seq + 1;
    this.dirty = true;
    this.rebuildContextState();
    return this.cloneMessageRecord(record);
  }

  /**
   * 追加一条用户消息。
   * @param content 用户输入的消息内容。
   * @param extra 附加消息元信息，例如状态、token 消耗或扩展字段。
   * @returns 追加后的标准化消息记录。
   */
  public appendUserMessage(
    content: ConversationMessageContent,
    extra: Omit<AppendConversationMessageInput, "content" | "senderType" | "role"> = {}
  ): ConversationMessageRecord {
    return this.appendMessage({
      ...extra,
      content,
      senderType: AiMessageSenderType.USER,
      role: AiMessageRole.USER,
    });
  }

  /**
   * 追加一条 assistant 消息。
   * @param content 模型或 AI 生成的消息内容。
   * @param extra 附加消息元信息，例如状态、token 消耗或扩展字段。
   * @returns 追加后的标准化消息记录。
   */
  public appendAssistantMessage(
    content: ConversationMessageContent,
    extra: Omit<AppendConversationMessageInput, "content" | "senderType" | "role"> = {}
  ): ConversationMessageRecord {
    return this.appendMessage({
      ...extra,
      content,
      senderType: AiMessageSenderType.AI,
      role: AiMessageRole.ASSISTANT,
    });
  }

  /**
   * 追加一条 tool 消息。
   * @param content 工具执行结果或工具回传内容。
   * @param extra 附加消息元信息，例如 tool_call_id 或状态字段。
   * @returns 追加后的标准化消息记录。
   */
  public appendToolMessage(
    content: ConversationMessageContent,
    extra: Omit<AppendConversationMessageInput, "content" | "senderType" | "role"> = {}
  ): ConversationMessageRecord {
    return this.appendMessage({
      ...extra,
      content,
      senderType: AiMessageSenderType.TOOL,
      role: AiMessageRole.TOOL,
    });
  }

  /**
   * 更新指定消息的状态，例如 sending、success 或 failed。
   * @param seq 会话内消息顺序号。
   * @param status 目标消息状态。
   * @returns 找到时返回更新后的消息记录，未找到时返回 null。
   */
  public markMessageStatus(seq: number, status: AiMessageStatus) {
    const target = this.messageTimeline.find((message) => message.seq === seq);
    if (!target) {
      return null;
    }
    target.messageStatus = status;
    target.updatedAt = new Date();
    this.dirty = true;
    this.rebuildContextState();
    return this.cloneMessageRecord(target);
  }

  /**
   * 用外部摘要块替换当前摘要上下文占位状态。
   * @param summaryBlocks 最新的摘要块列表。
   */
  public replaceSummaryBlocks(summaryBlocks: ConversationSummaryBlock[]) {
    this.contextState.summaryBlocks = summaryBlocks.map((block) => ({
      ...block,
      updatedAt: new Date(block.updatedAt),
    }));
    this.contextState.compressionMeta.compressionVersion += 1;
    this.contextState.compressionMeta.compressedUntilSeq =
      summaryBlocks[summaryBlocks.length - 1]?.endSeq ?? 0;
    this.dirty = true;
    this.rebuildContextState();
  }

  /**
   * 获取完整消息时间线的只读副本。
   * @returns 当前会话的完整消息列表。
   */
  public getFullMessages(): ConversationMessageRecord[] {
    return this.messageTimeline.map((message) => this.cloneMessageRecord(message));
  }

  /**
   * 获取当前派生上下文状态的只读副本。
   * @returns 包含 head、summary、tail 和 compressionMeta 的上下文状态。
   */
  public getContextState(): ConversationContextState {
    return this.cloneContextState(this.contextState);
  }

  /**
   * 获取可直接传给模型接口的消息列表。
   * @param options 上下文构建选项，例如是否包含系统提示和窗口大小。
   * @returns OpenAI 消息格式的上下文数组。
   */
  public getContextMessages(options: BuildContextOptions = {}): ConversationMessageParam[] {
    return this.buildContextSnapshot(options).messages;
  }

  /**
   * 构建当前会话的模型上下文快照。
   * @param options 上下文构建选项，例如是否包含系统提示和窗口大小。
   * @returns 包含模型消息数组与派生上下文状态的快照对象。
   */
  public buildContextSnapshot(options: BuildContextOptions = {}) {
    const contextState = this.composeContextState(options.maxContextMessages);
    const messages: ConversationMessageParam[] = [];

    if (options.includeSystemPrompt ?? true) {
      messages.push({
        role: "system",
        content: this.systemPrompt,
      });
    }

    for (const message of contextState.contextMessages) {
      const openAIMessage = this.toOpenAIMessageParam(message);
      if (openAIMessage) {
        messages.push(openAIMessage);
      }
    }

    return {
      sessionId: this.sessionId,
      ownerUserId: this.ownerUserId,
      dirty: this.dirty,
      nextSeq: this.nextSeq,
      messages,
      contextState,
    };
  }

  /**
   * 构建当前会话的完整快照。
   * @returns 包含完整消息时间线与派生上下文状态的快照对象。
   */
  public buildSnapshot(): ConversationSnapshot {
    return {
      sessionId: this.sessionId,
      ownerUserId: this.ownerUserId,
      nextSeq: this.nextSeq,
      dirty: this.dirty,
      messageTimeline: this.getFullMessages(),
      contextState: this.getContextState(),
    };
  }

  /**
   * 清空当前会话的内存状态并重置序号。
   */
  public reset(): void {
    this.nextSeq = 1;
    this.dirty = false;
    this.lastPersistedSeq = 0;
    this.messageTimeline = [];
    this.contextState = this.createEmptyContextState();
  }

  private createEmptyContextState(): ConversationContextState {
    return {
      headPinnedMessages: [],
      summaryBlocks: [],
      tailWindowMessages: [],
      contextMessages: [],
      compressionMeta: {
        compressionVersion: 0,
        compressedUntilSeq: 0,
        tokenEstimate: 0,
      },
    };
  }

  private createMessageRecord(
    input: ConversationMessageSeed | AppendConversationMessageInput,
    persisted: boolean
  ): ConversationMessageRecord {
    const createdAt = input.createdAt ? new Date(input.createdAt) : new Date();
    const updatedAt = "updatedAt" in input && input.updatedAt ? new Date(input.updatedAt) : createdAt;
    return {
      sessionId: this.sessionId,
      ownerUserId: this.ownerUserId,
      seq: "seq" in input && typeof input.seq === "number" ? input.seq : this.nextSeq,
      senderType: input.senderType,
      role: input.role,
      contentType: input.contentType ?? AiMessageContentType.TEXT,
      content: input.content,
      messageStatus: input.messageStatus ?? AiMessageStatus.SUCCESS,
      tokenUsage: input.tokenUsage,
      extra: input.extra,
      createdAt,
      updatedAt,
      includedInContext: false,
      summaryGroupId: undefined,
      contextSegment: null,
      persisted,
    };
  }

  private rebuildContextState() {
    this.contextState = this.composeContextState();
  }

  private composeContextState(maxContextMessages = this.defaultMaxContextMessages): ConversationContextState {
    for (const message of this.messageTimeline) {
      message.includedInContext = false;
      message.contextSegment = null;
    }

    const headPinnedMessages = this.buildHeadPinnedMessages();
    const tailWindowMessages = this.buildTailWindowMessages(maxContextMessages);
    const summaryMessages = this.buildSummaryContextMessages();
    const contextMessages = [...headPinnedMessages, ...summaryMessages, ...tailWindowMessages];

    return {
      headPinnedMessages,
      summaryBlocks: this.contextState.summaryBlocks.map((block) => ({
        ...block,
        updatedAt: new Date(block.updatedAt),
      })),
      tailWindowMessages,
      contextMessages,
      compressionMeta: {
        ...this.contextState.compressionMeta,
        lastBuildAt: new Date(),
        tokenEstimate: contextMessages.length,
      },
    };
  }

  private buildHeadPinnedMessages(): ConversationContextMessageRecord[] {
    return this.messageTimeline
      .filter((message) => message.role === AiMessageRole.SYSTEM)
      .map((message) => {
        message.includedInContext = true;
        message.contextSegment = "head";
        return this.toContextMessageRecord(message, "head");
      });
  }

  private buildSummaryContextMessages(): ConversationContextMessageRecord[] {
    if (!this.contextState.summaryBlocks.length) {
      return [];
    }

    return this.contextState.summaryBlocks.map((block) => ({
      seq: block.endSeq,
      role: AiMessageRole.SYSTEM,
      senderType: AiMessageSenderType.SYSTEM,
      content: block.content,
      contextSegment: "summary",
      source: "summary",
    }));
  }

  private buildTailWindowMessages(maxContextMessages: number): ConversationContextMessageRecord[] {
    const nonSystemMessages = this.messageTimeline.filter((message) => message.role !== AiMessageRole.SYSTEM);
    const windowMessages = nonSystemMessages.slice(-maxContextMessages);

    return windowMessages.map((message) => {
      message.includedInContext = true;
      message.contextSegment = "tail";
      return this.toContextMessageRecord(message, "tail");
    });
  }

  private toContextMessageRecord(
    message: ConversationMessageRecord,
    contextSegment: Exclude<ConversationContextSegment, null>
  ): ConversationContextMessageRecord {
    return {
      seq: message.seq,
      role: message.role,
      senderType: message.senderType,
      content: this.normalizeContent(message.content),
      toolCallId: this.resolveToolCallId(message.extra),
      contextSegment,
      source: "timeline",
    };
  }

  private toOpenAIMessageParam(message: ConversationContextMessageRecord): ConversationMessageParam | null {
    switch (message.role) {
      case AiMessageRole.SYSTEM:
        return {
          role: "system",
          content: typeof message.content === "string" ? message.content : JSON.stringify(message.content),
        };
      case AiMessageRole.USER:
        return {
          role: "user",
          content: this.normalizeTextOnlyContent(message.content),
        };
      case AiMessageRole.ASSISTANT:
        return {
          role: "assistant",
          content: this.normalizeTextOnlyContent(message.content),
        };
      case AiMessageRole.TOOL:
        if (!message.toolCallId) {
          return null;
        }
        return {
          role: "tool",
          tool_call_id: message.toolCallId,
          content: typeof message.content === "string" ? message.content : JSON.stringify(message.content),
        };
      default:
        return null;
    }
  }

  private normalizeContent(content: ConversationMessageContent): ConversationMessageParam["content"] {
    if (typeof content === "string") {
      return content;
    }

    if (Array.isArray(content)) {
      return content.map((item) => {
        if (typeof item === "string") {
          return { type: "text", text: item };
        }
        return {
          type: "text",
          text: JSON.stringify(item),
        };
      });
    }

    return JSON.stringify(content);
  }

  private resolveToolCallId(extra: AiSessionMessageDocument["extra"]): string | undefined {
    if (!extra || typeof extra !== "object" || Array.isArray(extra)) {
      return undefined;
    }

    const extraRecord = extra as unknown as Record<string, unknown>;
    const candidate = extraRecord.toolCallId ?? extraRecord.tool_call_id;
    return typeof candidate === "string" && candidate ? candidate : undefined;
  }

  private normalizeTextOnlyContent(
    content: ConversationContextMessageRecord["content"]
  ): string | OpenAI.Chat.Completions.ChatCompletionContentPartText[] {
    if (typeof content === "string") {
      return content;
    }

    if (!content) {
      return "";
    }

    if (!Array.isArray(content)) {
      return JSON.stringify(content);
    }

    return content.map((item) => {
      if (
        item &&
        typeof item === "object" &&
        "type" in item &&
        item.type === "text" &&
        "text" in item &&
        typeof item.text === "string"
      ) {
        return {
          type: "text" as const,
          text: item.text,
        };
      }

      return {
        type: "text" as const,
        text: JSON.stringify(item),
      };
    });
  }

  private cloneMessageRecord(message: ConversationMessageRecord): ConversationMessageRecord {
    return {
      ...message,
      createdAt: new Date(message.createdAt),
      updatedAt: new Date(message.updatedAt),
      tokenUsage: message.tokenUsage ? { ...message.tokenUsage } : undefined,
    };
  }

  private cloneContextState(contextState: ConversationContextState): ConversationContextState {
    return {
      headPinnedMessages: contextState.headPinnedMessages.map((message) => ({
        ...message,
      })),
      summaryBlocks: contextState.summaryBlocks.map((block) => ({
        ...block,
        updatedAt: new Date(block.updatedAt),
      })),
      tailWindowMessages: contextState.tailWindowMessages.map((message) => ({
        ...message,
      })),
      contextMessages: contextState.contextMessages.map((message) => ({
        ...message,
      })),
      compressionMeta: {
        ...contextState.compressionMeta,
        lastBuildAt: contextState.compressionMeta.lastBuildAt
          ? new Date(contextState.compressionMeta.lastBuildAt)
          : undefined,
      },
    };
  }
}
