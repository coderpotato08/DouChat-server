import { Schema, model } from "mongoose";

export const AI_MESSAGE_ROLES = ["system", "user", "assistant", "tool"] as const;
export type AiMessageRole = (typeof AI_MESSAGE_ROLES)[number];

export const AI_MESSAGE_SENDER_TYPES = ["system", "user", "assistant", "tool"] as const;
export type AiMessageSenderType = (typeof AI_MESSAGE_SENDER_TYPES)[number];

export const AI_MESSAGE_CONTENT_TYPES = ["text", "json", "tool_call", "tool_result"] as const;
export type AiMessageContentType = (typeof AI_MESSAGE_CONTENT_TYPES)[number];

export const AI_MESSAGE_STATUSES = ["pending", "success", "failed"] as const;
export type AiMessageStatus = (typeof AI_MESSAGE_STATUSES)[number];

export const AI_MESSAGE_COMPRESSED_VERSIONS = [
  "token_prune",
  "round_abstract",
  "system_light",
  "llm_summary",
] as const;
export type AiMessageCompressedVersion = (typeof AI_MESSAGE_COMPRESSED_VERSIONS)[number];

export interface AiToolFunctionCall {
  // 工具调用唯一标识，用于与 tool 角色消息建立关联
  id: string;
  // OpenAI function calling 固定类型
  type: "function";
  function: {
    // 被调用的工具名
    name: string;
    // 字符串化后的工具入参
    arguments: string;
  };
}

export interface AiMessageTokenUsage {
  // 本次消息输入消耗的 token
  inputToken?: number;
  // 本次消息输出消耗的 token
  outputToken?: number;
  // 本次消息总 token 消耗
  totalToken?: number;
}

export interface AiMessageCompressMeta {
  // 压缩前 token 数量
  originalToken?: number;
  // 压缩后 token 数量
  compressedToken?: number;
  // 压缩比例
  compressionRatio?: number;
  // 触发压缩时使用的阈值
  triggerThreshold?: number;
}

export interface AiSessionMessageDocument {
  // 单条消息全局唯一 ID
  messageId: string;
  // 会话唯一标识
  sessionId: string;
  // 当前轮次请求 ID，system 消息可为空
  requestId?: string | null;
  // 会话所属用户 ID，便于按用户归档检索
  ownerUserId?: string;
  // 消息发送方类型，用于 UI 或多来源消息区分
  senderType?: AiMessageSenderType;
  // LLM 标准消息角色
  role: AiMessageRole;
  // 原始消息文本，assistant 工具调用场景允许为 null
  content: string | null;
  // 内容类型，区分纯文本、JSON、工具调用和工具结果
  contentType?: AiMessageContentType;
  // assistant 发起的工具调用列表
  tool_calls?: AiToolFunctionCall[];
  // tool 角色消息关联的 assistant 工具调用 ID
  tool_call_id?: string | null;
  // 同一 session 内的稳定顺序号
  sortIndex: number;
  // 消息处理状态
  messageStatus?: AiMessageStatus;
  // token 使用统计
  tokenUsage?: AiMessageTokenUsage;
  // 与模型调用相关的扩展元数据
  meta?: Record<string, unknown>;
  // 业务自定义扩展字段
  extra?: Record<string, unknown>;
  // 消息创建时间
  createdAt?: Date;
  // 是否已被上下文压缩
  isCompressed?: boolean;
  // 压缩前原始内容
  originalContent?: string | null;
  // 压缩策略版本标识
  compressedVersion?: AiMessageCompressedVersion | null;
  // 压缩统计信息
  compressMeta?: AiMessageCompressMeta | null;
  // 多轮合并压缩时覆盖的 requestId 列表
  mergedRoundIds?: string[];
}

const AiToolFunctionCallSchema = new Schema<AiToolFunctionCall>(
  {
    // 工具调用唯一标识
    id: {
      type: String,
      required: true,
      trim: true,
    },
    // 工具调用类型，当前固定为 function
    type: {
      type: String,
      required: true,
      enum: ["function"],
    },
    function: {
      // 工具名称
      name: {
        type: String,
        required: true,
        trim: true,
      },
      // JSON 字符串形式的工具参数
      arguments: {
        type: String,
        required: true,
      },
    },
  },
  { _id: false },
);

const AiSessionMessageSchema = new Schema<AiSessionMessageDocument>(
  {
    // 单条消息全局唯一 ID
    messageId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    // 会话唯一标识
    sessionId: {
      type: String,
      required: true,
      trim: true,
    },
    // 当前问答轮次 ID，system 消息允许为空
    requestId: {
      type: String,
      default: null,
      trim: true,
    },
    // 会话所属用户 ID
    ownerUserId: {
      type: String,
      trim: true,
    },
    // 发送方类型，便于区分 system/user/assistant/tool 来源
    senderType: {
      type: String,
      enum: AI_MESSAGE_SENDER_TYPES,
    },
    // LLM 标准角色字段
    role: {
      type: String,
      required: true,
      enum: AI_MESSAGE_ROLES,
    },
    // 原始消息内容，assistant 调工具时允许为空
    content: {
      type: String,
      default: null,
    },
    // 内容类型标签
    contentType: {
      type: String,
      enum: AI_MESSAGE_CONTENT_TYPES,
    },
    // assistant 发起的工具调用列表
    tool_calls: {
      type: [AiToolFunctionCallSchema],
      default: undefined,
    },
    // tool 角色消息对应的工具调用 ID
    tool_call_id: {
      type: String,
      default: null,
      trim: true,
    },
    // 同一 session 内的递增排序索引
    sortIndex: {
      type: Number,
      required: true,
      min: 0,
    },
    // 消息处理状态
    messageStatus: {
      type: String,
      enum: AI_MESSAGE_STATUSES,
    },
    // token 使用统计
    tokenUsage: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    // 模型、路由目标等扩展元数据
    meta: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    // 业务侧额外信息
    extra: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    // 消息创建时间，用于排序和 TTL 清理
    createdAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    // 是否已进行上下文压缩
    isCompressed: {
      type: Boolean,
      default: false,
    },
    // 压缩前原始文本，用于回滚恢复
    originalContent: {
      type: String,
      default: null,
    },
    // 压缩策略版本标记
    compressedVersion: {
      type: String,
      default: null,
      enum: [...AI_MESSAGE_COMPRESSED_VERSIONS, null],
    },
    // 压缩统计信息
    compressMeta: {
      type: Schema.Types.Mixed,
      default: null,
    },
    // 合并压缩时被覆盖的轮次 ID 列表
    mergedRoundIds: {
      type: [String],
      default: [],
    },
  },
  {
    collection: "ai_chat_messages",
    versionKey: false,
  },
);

AiSessionMessageSchema.index({ sessionId: 1, requestId: 1, sortIndex: 1 });
AiSessionMessageSchema.index({ sessionId: 1, isCompressed: 1 });
AiSessionMessageSchema.index({ messageId: 1 }, { unique: true });
AiSessionMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

AiSessionMessageSchema.pre("validate", function validateMessage(next): void {
  const message = this as AiSessionMessageDocument;

  if (message.role !== "system" && !message.requestId) {
    next(new Error("requestId is required for non-system messages"));
    return;
  }

  if (message.role !== "assistant" && message.content === null) {
    next(new Error("content can only be null for assistant messages"));
    return;
  }

  if (message.role !== "assistant" && message.tool_calls && message.tool_calls.length > 0) {
    next(new Error("tool_calls is only allowed for assistant messages"));
    return;
  }

  if (message.role !== "tool" && message.tool_call_id) {
    next(new Error("tool_call_id is only allowed for tool messages"));
    return;
  }

  if (message.isCompressed && !message.originalContent) {
    next(new Error("originalContent is required when isCompressed is true"));
    return;
  }

  next();
});

export default model<AiSessionMessageDocument>("ai_chat_messages", AiSessionMessageSchema);
