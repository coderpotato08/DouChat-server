import dayjs from "dayjs";
import { Schema, model } from "mongoose";

export enum AiMessageSenderType {
  USER = "user",
  AI = "ai",
  SYSTEM = "system",
  TOOL = "tool",
}

export enum AiMessageRole {
  USER = "user",
  ASSISTANT = "assistant",
  SYSTEM = "system",
  TOOL = "tool",
}

export enum AiMessageContentType {
  TEXT = "text",
  IMAGE = "image",
  FILE = "file",
  JSON = "json",
  MIXED = "mixed",
}

export enum AiMessageStatus {
  SENDING = "sending",
  SUCCESS = "success",
  FAILED = "failed",
  REVOKED = "revoked",
}

interface AiMessageTokenUsage {
  /** 输入 token 数 */
  promptTokens?: number;
  /** 输出 token 数 */
  completionTokens?: number;
  /** 总 token 数 */
  totalTokens?: number;
}

export interface AiSessionMessageDocument {
  /** 所属会话 ID */
  sessionId: Schema.Types.ObjectId;
  /** 所属用户 ID，用于按用户维度隔离消息 */
  ownerUserId: Schema.Types.ObjectId;
  /** 会话内顺序号，保证消息有稳定顺序 */
  seq: number;
  /** 消息发送方类型，例如 user 或 ai */
  senderType: AiMessageSenderType;
  /** 当发送方是用户时，对应的用户 ID */
  senderUserId?: Schema.Types.ObjectId;
  /** 发送方名称，便于展示 */
  senderName?: string;
  /** 当发送方为 AI 时记录模型名 */
  aiModel?: string;
  /** 对话角色，便于组装大模型上下文 */
  role: AiMessageRole;
  /** 内容类型，例如文本、图片、文件 */
  contentType: AiMessageContentType;
  /** 消息内容主体，可存文本或结构化数据 */
  content: Schema.Types.Mixed;
  /** 回复目标消息 ID */
  replyToMessageId?: Schema.Types.ObjectId;
  /** 消息状态，例如成功、失败、撤回 */
  messageStatus: AiMessageStatus;
  /** AI 调用 token 消耗信息 */
  tokenUsage?: AiMessageTokenUsage;
  /** 扩展字段，例如工具调用结果、引用来源等 */
  extra?: Schema.Types.Mixed;
  /** 创建时间 */
  createdAt?: Date;
  /** 更新时间 */
  updatedAt?: Date;
}

const AiSessionMessageSchema = new Schema<AiSessionMessageDocument>(
  {
    /** 所属会话 ID */
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "ai_sessions",
      required: true,
      index: true,
    },
    /** 所属用户 ID，用于按用户维度隔离消息 */
    ownerUserId: {
      type: Schema.Types.ObjectId,
      ref: "Users",
      required: true,
      index: true,
    },
    /** 会话内顺序号，保证消息有稳定顺序 */
    seq: {
      type: Number,
      required: true,
      min: 1,
    },
    /** 消息发送方类型，例如 user 或 ai */
    senderType: {
      type: String,
      enum: Object.values(AiMessageSenderType),
      required: true,
      index: true,
    },
    /** 当发送方是用户时，对应的用户 ID */
    senderUserId: {
      type: Schema.Types.ObjectId,
      ref: "Users",
      default: void 0,
    },
    /** 发送方名称，便于展示 */
    senderName: {
      type: String,
      default: "",
      max: 100,
    },
    /** 当发送方为 AI 时记录模型名 */
    aiModel: {
      type: String,
      default: "",
      max: 100,
    },
    /** 对话角色，便于组装大模型上下文 */
    role: {
      type: String,
      enum: Object.values(AiMessageRole),
      required: true,
    },
    /** 内容类型，例如文本、图片、文件 */
    contentType: {
      type: String,
      enum: Object.values(AiMessageContentType),
      default: AiMessageContentType.TEXT,
    },
    /** 消息内容主体，可存文本或结构化数据 */
    content: {
      type: Schema.Types.Mixed,
      required: true,
    },
    /** 回复目标消息 ID */
    replyToMessageId: {
      type: Schema.Types.ObjectId,
      ref: "ai_session_messages",
      default: void 0,
    },
    /** 消息状态，例如成功、失败、撤回 */
    messageStatus: {
      type: String,
      enum: Object.values(AiMessageStatus),
      default: AiMessageStatus.SUCCESS,
    },
    /** AI 调用 token 消耗信息 */
    tokenUsage: {
      type: {
        /** 输入 token 数 */
        promptTokens: {
          type: Number,
          default: 0,
        },
        /** 输出 token 数 */
        completionTokens: {
          type: Number,
          default: 0,
        },
        /** 总 token 数 */
        totalTokens: {
          type: Number,
          default: 0,
        },
      },
      default: void 0,
    },
    /** 扩展字段，例如工具调用结果、引用来源等 */
    extra: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: {
      getters: true,
    },
    toObject: {
      getters: true,
    },
  }
);

AiSessionMessageSchema.path("createdAt").get((date: Date) =>
  date ? dayjs(date).format("YYYY-MM-DD HH:mm:ss") : date
);

AiSessionMessageSchema.index({ sessionId: 1, seq: 1 }, { unique: true });
AiSessionMessageSchema.index({ ownerUserId: 1, sessionId: 1, createdAt: 1 });
AiSessionMessageSchema.index({ ownerUserId: 1, createdAt: -1 });

export default model<AiSessionMessageDocument>("ai_session_messages", AiSessionMessageSchema);
